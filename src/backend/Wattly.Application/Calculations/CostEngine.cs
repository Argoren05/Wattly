using System.Globalization;
using Wattly.Application.Common;
using Wattly.Domain.Calculations;

namespace Wattly.Application.Calculations;

/// <summary>
/// Builds time segments with constant contract and rate plans, estimates consumption per tariff zone
/// from register readings and runs the pure <see cref="CostCalculator"/>.
/// </summary>
public static class CostEngine
{
    public const string NotAnInvoiceNotice = "Kalkulacja ma charakter informacyjny i szacunkowy – nie jest fakturą sprzedawcy.";

    public static CalculationResultDto Calculate(PropertyEnergyData data, DateTimeOffset from, DateTimeOffset to, DateTimeOffset calculatedAt)
    {
        from = from.ToUniversalTime();
        to = to.ToUniversalTime();
        var tz = data.TimeZone;
        var assumptions = new List<string> { NotAnInvoiceNotice };
        var isComplete = true;
        var isEstimate = to > calculatedAt;

        var segments = new List<CostSegment>();
        var usedPlans = new Dictionary<Guid, AppliedRatePlanDto>();
        var zoneTotals = new Dictionary<string, decimal>(StringComparer.Ordinal);
        decimal totalConsumption = 0;
        var anyInterpolated = false;
        var anyExtrapolated = false;
        var clampedRegisters = new HashSet<string>();
        var missingRegisters = new HashSet<string>();

        if (data.ImportRegisters.Count == 0)
        {
            isComplete = false;
            assumptions.Add("Nieruchomość nie ma skonfigurowanego licznika z rejestrem poboru.");
        }

        foreach (var (start, end) in Boundaries(data, from, to))
        {
            var zoneConsumption = new Dictionary<string, decimal>(StringComparer.Ordinal);
            decimal segmentTotal = 0;

            foreach (var register in data.ImportRegisters)
            {
                var estimate = register.Series.Consumption(start, end);
                if (estimate is null)
                {
                    missingRegisters.Add(register.Register.Name);
                    continue;
                }

                segmentTotal += estimate.Kwh;
                if (register.Register.ZoneCode is { } zone)
                    zoneConsumption[zone] = zoneConsumption.GetValueOrDefault(zone) + estimate.Kwh;

                anyInterpolated |= estimate.StartKind == ValueKind.Interpolated || estimate.EndKind == ValueKind.Interpolated;
                anyExtrapolated |= estimate.StartKind == ValueKind.Extrapolated || estimate.EndKind == ValueKind.Extrapolated;
                if (estimate.StartClamped)
                    clampedRegisters.Add(register.Register.Name);
            }

            totalConsumption += segmentTotal;
            foreach (var (zone, kwh) in zoneConsumption)
                zoneTotals[zone] = zoneTotals.GetValueOrDefault(zone) + kwh;

            var date = TimeZones.LocalDate(start, tz);
            var contract = data.ContractOn(date);
            if (contract is null)
            {
                isComplete = false;
                assumptions.Add($"Brak umowy obowiązującej od {date:yyyy-MM-dd} – koszt tego okresu nie został naliczony.");
                continue;
            }

            var plans = data.RatePlansOn(contract, date);
            if (plans.Count == 0)
            {
                isComplete = false;
                assumptions.Add($"Brak cennika dla taryfy umowy obowiązującego {date:yyyy-MM-dd} – koszt tego okresu nie został naliczony.");
                continue;
            }

            foreach (var plan in plans)
                usedPlans.TryAdd(plan.Id, new AppliedRatePlanDto(plan.Id, plan.Name, plan.ValidFrom, plan.ValidTo, plan.SourceReference));

            var components = plans
                .SelectMany(p => p.Components.Select(c => new RateComponentInput(p.Id, p.Name, c.ComponentType, c.Name, c.ZoneCode, c.Unit, c.NetRate, c.TaxRate)))
                .ToList();
            segments.Add(new CostSegment(start, end, components, zoneConsumption, segmentTotal, contract.ContractedPowerKw));
        }

        if (missingRegisters.Count > 0)
        {
            isComplete = false;
            isEstimate = true;
            assumptions.Add($"Za mało odczytów, aby wyznaczyć zużycie rejestru: {string.Join(", ", missingRegisters.Order())}. Potrzebny jest odczyt na początku okresu lub co najmniej dwa odczyty.");
        }

        if (clampedRegisters.Count > 0)
        {
            isEstimate = true;
            assumptions.Add($"Okres zaczyna się przed pierwszym odczytem ({string.Join(", ", clampedRegisters.Order())}) – zużycie liczone jest od pierwszego odczytu.");
        }

        if (anyInterpolated)
        {
            isEstimate = true;
            assumptions.Add("Granice okresu nie pokrywają się z odczytami – zużycie oszacowano liniowo pomiędzy sąsiednimi odczytami.");
        }

        if (anyExtrapolated)
        {
            isEstimate = true;
            var last = data.LastReadingAt is { } l ? TimeZoneInfo.ConvertTime(l, tz).ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture) : "-";
            assumptions.Add($"Zużycie po ostatnim odczycie ({last}) prognozowano na podstawie średniego dziennego zużycia z ostatnich {RegisterSeries.DefaultExtrapolationWindow.Days} dni.");
        }

        var result = CostCalculator.Calculate(segments, tz);
        assumptions.AddRange(result.Assumptions);
        if (result.Lines.Count > 0)
            assumptions.Add("Kwoty netto składników zaokrąglono do 0,01; VAT naliczono od sumy netto dla każdej stawki.");

        var sourceValues = new List<SourceValueDto>();
        foreach (var register in data.ImportRegisters)
        {
            foreach (var at in new[] { from, to })
            {
                var value = register.Series.ValueAt(at);
                sourceValues.Add(new SourceValueDto(register.Register.Id, register.Register.Name, register.Register.ZoneCode, at,
                    value is null ? null : Math.Round(value.Value.Value, 3, MidpointRounding.AwayFromZero), value?.Kind));
            }
        }

        return new CalculationResultDto(
            null,
            data.Property.Id,
            from,
            to,
            calculatedAt,
            CostCalculator.Version,
            Math.Round(totalConsumption, 3, MidpointRounding.AwayFromZero),
            zoneTotals.OrderBy(z => z.Key).Select(z => new ZoneConsumptionDto(z.Key, Math.Round(z.Value, 3, MidpointRounding.AwayFromZero))).ToList(),
            sourceValues,
            usedPlans.Values.ToList(),
            result.Lines.Select(l => new CostLineDto(l.RatePlanId, l.RatePlanName, l.ComponentType, l.Category, l.ComponentName, l.ZoneCode,
                l.Unit, l.Quantity, l.NetRate, l.TaxRate, l.NetAmount, l.SegmentStart, l.SegmentEnd)).ToList(),
            result.Taxes.Select(t => new TaxSummaryDto(t.TaxRate, t.NetAmount, t.TaxAmount)).ToList(),
            result.EnergyCostNet,
            result.DistributionCostNet,
            result.OtherCostNet,
            result.TotalNet,
            result.TaxAmount,
            result.TotalGross,
            data.Property.CurrencyCode,
            isEstimate,
            isComplete,
            assumptions.Distinct().ToList());
    }

    /// <summary>Splits [from, to) at every contract and rate plan validity boundary.</summary>
    private static IEnumerable<(DateTimeOffset Start, DateTimeOffset End)> Boundaries(PropertyEnergyData data, DateTimeOffset from, DateTimeOffset to)
    {
        var tz = data.TimeZone;
        var dates = data.Contracts.SelectMany(c => new[] { (DateOnly?)c.ValidFrom, c.ValidTo?.AddDays(1) })
            .Concat(data.RatePlans.SelectMany(p => new[] { (DateOnly?)p.ValidFrom, p.ValidTo?.AddDays(1) }))
            .OfType<DateOnly>()
            .Distinct();

        var points = dates.Select(d => TimeZones.StartOfDay(d, tz))
            .Where(p => p > from && p < to)
            .Append(from)
            .Append(to)
            .Distinct()
            .Order()
            .ToList();

        for (var i = 0; i < points.Count - 1; i++)
            yield return (points[i], points[i + 1]);
    }
}
