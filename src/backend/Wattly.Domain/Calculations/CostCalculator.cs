using Wattly.Domain.Tariffs;

namespace Wattly.Domain.Calculations;

/// <summary>Rate component prepared for calculation (copied from a rate plan).</summary>
/// <param name="RatePlanId">Source rate plan.</param>
/// <param name="RatePlanName">Source rate plan name.</param>
/// <param name="ComponentType">Component kind.</param>
/// <param name="Name">Component name.</param>
/// <param name="ZoneCode">Tariff zone or null for the whole consumption.</param>
/// <param name="Unit">Rate unit.</param>
/// <param name="NetRate">Net rate.</param>
/// <param name="TaxRate">VAT fraction.</param>
public sealed record RateComponentInput(
    Guid RatePlanId,
    string RatePlanName,
    RateComponentType ComponentType,
    string Name,
    string? ZoneCode,
    RateUnit Unit,
    decimal NetRate,
    decimal TaxRate);

/// <summary>
/// Time slice with a constant set of rate components. <see cref="ZoneConsumption"/> maps tariff zone codes
/// to consumption in kWh; <see cref="TotalConsumption"/> is the consumption of all import registers.
/// </summary>
/// <param name="Start">Segment start (inclusive).</param>
/// <param name="End">Segment end (exclusive).</param>
/// <param name="Components">Rate components applicable in the whole segment.</param>
/// <param name="ZoneConsumption">Consumption per tariff zone.</param>
/// <param name="TotalConsumption">Consumption of all import registers.</param>
/// <param name="ContractedPowerKw">Contracted power for per-kW components.</param>
public sealed record CostSegment(
    DateTimeOffset Start,
    DateTimeOffset End,
    IReadOnlyList<RateComponentInput> Components,
    IReadOnlyDictionary<string, decimal> ZoneConsumption,
    decimal TotalConsumption,
    decimal? ContractedPowerKw);

/// <summary>Calculated amount of one component in one segment.</summary>
/// <param name="RatePlanId">Source rate plan.</param>
/// <param name="RatePlanName">Source rate plan name.</param>
/// <param name="ComponentType">Component kind.</param>
/// <param name="Category">Summary category.</param>
/// <param name="ComponentName">Component name.</param>
/// <param name="ZoneCode">Tariff zone or null.</param>
/// <param name="Unit">Rate unit.</param>
/// <param name="Quantity">Quantity in the rate unit.</param>
/// <param name="NetRate">Net rate.</param>
/// <param name="TaxRate">VAT fraction.</param>
/// <param name="NetAmount">Rounded net amount.</param>
/// <param name="SegmentStart">Segment start.</param>
/// <param name="SegmentEnd">Segment end.</param>
public sealed record CostLine(
    Guid RatePlanId,
    string RatePlanName,
    RateComponentType ComponentType,
    CostCategory Category,
    string ComponentName,
    string? ZoneCode,
    RateUnit Unit,
    decimal Quantity,
    decimal NetRate,
    decimal TaxRate,
    decimal NetAmount,
    DateTimeOffset SegmentStart,
    DateTimeOffset SegmentEnd);

/// <summary>VAT summary for one tax rate.</summary>
/// <param name="TaxRate">VAT fraction.</param>
/// <param name="NetAmount">Sum of net amounts with this rate.</param>
/// <param name="TaxAmount">Rounded VAT.</param>
public sealed record TaxSummary(decimal TaxRate, decimal NetAmount, decimal TaxAmount);

/// <summary>Result of <see cref="CostCalculator.Calculate"/>.</summary>
/// <param name="Lines">Component lines.</param>
/// <param name="Taxes">VAT per rate.</param>
/// <param name="EnergyCostNet">Net energy cost.</param>
/// <param name="DistributionCostNet">Net distribution cost.</param>
/// <param name="OtherCostNet">Net other fees.</param>
/// <param name="TotalNet">Total net.</param>
/// <param name="TaxAmount">Total VAT.</param>
/// <param name="TotalGross">Total gross.</param>
/// <param name="Assumptions">Skipped components and other notes.</param>
public sealed record CostResult(
    IReadOnlyList<CostLine> Lines,
    IReadOnlyList<TaxSummary> Taxes,
    decimal EnergyCostNet,
    decimal DistributionCostNet,
    decimal OtherCostNet,
    decimal TotalNet,
    decimal TaxAmount,
    decimal TotalGross,
    IReadOnlyList<string> Assumptions);

/// <summary>
/// Pure cost calculation based on explicit bill components.
/// Rounding rules (see DEC-013): each line net amount is rounded to 0.01 (half away from zero);
/// VAT is computed on the sum of net amounts per tax rate and rounded to 0.01; gross = net + VAT.
/// Monthly components are prorated by the share of each calendar month (wall-clock time in the property time zone).
/// </summary>
public static class CostCalculator
{
    /// <summary>Algorithm version stored with saved calculations; bump when rules change.</summary>
    public const int Version = 1;

    /// <summary>Calculates all component lines, VAT and totals for the given segments.</summary>
    /// <param name="segments">Time segments with constant rates.</param>
    /// <param name="timeZone">Property time zone (for month/day proration).</param>
    public static CostResult Calculate(IEnumerable<CostSegment> segments, TimeZoneInfo timeZone)
    {
        var lines = new List<CostLine>();
        var assumptions = new List<string>();

        foreach (var segment in segments)
        {
            foreach (var component in segment.Components)
            {
                var quantity = Quantity(component, segment, timeZone, assumptions);
                if (quantity is null)
                    continue;

                var net = RoundMoney(quantity.Value * component.NetRate);
                lines.Add(new CostLine(
                    component.RatePlanId,
                    component.RatePlanName,
                    component.ComponentType,
                    component.ComponentType.ToCategory(),
                    component.Name,
                    component.ZoneCode,
                    component.Unit,
                    quantity.Value,
                    component.NetRate,
                    component.TaxRate,
                    net,
                    segment.Start,
                    segment.End));
            }
        }

        // VAT is calculated on the sum of net amounts per tax rate, not per line.
        var taxes = lines
            .GroupBy(l => l.TaxRate)
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                var net = g.Sum(l => l.NetAmount);
                return new TaxSummary(g.Key, net, RoundMoney(net * g.Key));
            })
            .ToList();

        var totalNet = lines.Sum(l => l.NetAmount);
        var taxAmount = taxes.Sum(t => t.TaxAmount);

        return new CostResult(
            lines,
            taxes,
            SumCategory(lines, CostCategory.Energy),
            SumCategory(lines, CostCategory.Distribution),
            SumCategory(lines, CostCategory.Other),
            totalNet,
            taxAmount,
            totalNet + taxAmount,
            assumptions.Distinct().ToList());
    }

    /// <summary>Rounds money to 0.01 half away from zero (DEC-013).</summary>
    /// <param name="value">Amount to round.</param>
    public static decimal RoundMoney(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);

    /// <summary>Sums net amounts of lines in one category.</summary>
    private static decimal SumCategory(IEnumerable<CostLine> lines, CostCategory category) =>
        lines.Where(l => l.Category == category).Sum(l => l.NetAmount);

    /// <summary>Quantity of a component in a segment, or null when it cannot be applied (the reason is added to assumptions).</summary>
    private static decimal? Quantity(RateComponentInput component, CostSegment segment, TimeZoneInfo timeZone, List<string> assumptions)
    {
        switch (component.Unit)
        {
            case RateUnit.Kwh when component.ZoneCode is null:
                return Math.Round(segment.TotalConsumption, 3, MidpointRounding.AwayFromZero);

            case RateUnit.Kwh:
                if (segment.ZoneConsumption.TryGetValue(component.ZoneCode, out var zoneKwh))
                    return Math.Round(zoneKwh, 3, MidpointRounding.AwayFromZero);

                assumptions.Add($"Składnik „{component.Name}” dotyczy strefy {component.ZoneCode}, dla której brak rejestru licznika – pominięto go w kalkulacji.");
                return null;

            case RateUnit.Month:
                return MonthFraction(segment.Start, segment.End, timeZone);

            case RateUnit.Day:
                return DayCount(segment.Start, segment.End, timeZone);

            case RateUnit.Kw when segment.ContractedPowerKw is { } power:
                return Math.Round(power * MonthFraction(segment.Start, segment.End, timeZone), 4, MidpointRounding.AwayFromZero);

            case RateUnit.Kw:
                assumptions.Add($"Składnik „{component.Name}” wymaga mocy umownej, której nie podano w umowie – pominięto go w kalkulacji.");
                return null;

            default:
                throw new ArgumentOutOfRangeException(nameof(component), component.Unit, "Unsupported rate unit.");
        }
    }

    /// <summary>Number of (fractional) calendar months covered by [start, end) in the given time zone.</summary>
    /// <param name="start">Start (inclusive).</param>
    /// <param name="end">End (exclusive).</param>
    /// <param name="timeZone">Time zone whose calendar months are used.</param>
    public static decimal MonthFraction(DateTimeOffset start, DateTimeOffset end, TimeZoneInfo timeZone)
    {
        if (end <= start)
            return 0m;

        var localStart = TimeZoneInfo.ConvertTime(start, timeZone).DateTime;
        var localEnd = TimeZoneInfo.ConvertTime(end, timeZone).DateTime;

        var total = 0m;
        var monthStart = new DateTime(localStart.Year, localStart.Month, 1);
        // Each calendar month contributes the share of its length covered by the period.
        while (monthStart < localEnd)
        {
            var monthEnd = monthStart.AddMonths(1);
            var overlapStart = localStart > monthStart ? localStart : monthStart;
            var overlapEnd = localEnd < monthEnd ? localEnd : monthEnd;
            if (overlapEnd > overlapStart)
                total += (decimal)(overlapEnd - overlapStart).Ticks / (monthEnd - monthStart).Ticks;
            monthStart = monthEnd;
        }

        return Math.Round(total, 4, MidpointRounding.AwayFromZero);
    }

    /// <summary>Number of (fractional) days covered by [start, end), measured in wall-clock time of the time zone.</summary>
    /// <param name="start">Start (inclusive).</param>
    /// <param name="end">End (exclusive).</param>
    /// <param name="timeZone">Time zone of the wall clock.</param>
    public static decimal DayCount(DateTimeOffset start, DateTimeOffset end, TimeZoneInfo timeZone)
    {
        if (end <= start)
            return 0m;

        var localStart = TimeZoneInfo.ConvertTime(start, timeZone).DateTime;
        var localEnd = TimeZoneInfo.ConvertTime(end, timeZone).DateTime;
        return Math.Round((decimal)(localEnd - localStart).Ticks / TimeSpan.TicksPerDay, 4, MidpointRounding.AwayFromZero);
    }
}
