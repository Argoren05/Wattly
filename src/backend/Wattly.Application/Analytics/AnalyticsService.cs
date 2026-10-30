using Wattly.Application.Calculations;
using Wattly.Application.Common;

namespace Wattly.Application.Analytics;

public sealed class AnalyticsService(IWattlyDbContext db, ICurrentUser currentUser, TimeProvider clock)
{
    public const int MaxPoints = 400;

    private const string SparseReadingsNotice =
        "Wartości pomiędzy odczytami są estymacją liniową – rzeczywisty rozkład zużycia w poszczególnych dniach nie jest znany.";

    public async Task<SeriesDto> ConsumptionAsync(Guid propertyId, DateOnly from, DateOnly to, Granularity granularity, CancellationToken ct) =>
        await SeriesAsync(propertyId, from, to, granularity, includeCost: false, ct);

    public async Task<SeriesDto> CostsAsync(Guid propertyId, DateOnly from, DateOnly to, Granularity granularity, CancellationToken ct) =>
        await SeriesAsync(propertyId, from, to, granularity, includeCost: true, ct);

    /// <summary>Dashboard figures for the current billing period: consumption and cost so far plus forecast to the end of the period.</summary>
    public async Task<ForecastDto> ForecastAsync(Guid propertyId, CancellationToken ct)
    {
        var data = await PropertyEnergyData.LoadAsync(db, currentUser.UserId, propertyId, ct);
        var now = clock.GetUtcNow();
        var tz = data.TimeZone;
        var property = data.Property;

        var today = TimeZones.LocalDate(now, tz);
        var (periodStart, periodEndExclusive) = property.GetBillingPeriod(today);
        var start = TimeZones.StartOfDay(periodStart, tz);
        var end = TimeZones.StartOfDay(periodEndExclusive, tz);

        var lastReading = data.LastReadingAt;
        var toDate = lastReading is { } last ? Clamp(last, start, now) : start;

        var forecast = CostEngine.Calculate(data, start, end, now);
        var toDateResult = toDate > start ? CostEngine.Calculate(data, start, toDate, now) : null;

        var daysTotal = periodEndExclusive.DayNumber - periodStart.DayNumber;
        var daysElapsed = Math.Clamp(today.DayNumber - periodStart.DayNumber + 1, 0, daysTotal);
        var elapsedDays = (decimal)(toDate - start).Ticks / TimeSpan.TicksPerDay;

        decimal? averageDailyKwh = null;
        decimal? averageDailyCost = null;
        if (toDateResult is not null && elapsedDays >= 1)
        {
            averageDailyKwh = Math.Round(toDateResult.ConsumptionKwh / elapsedDays, 2, MidpointRounding.AwayFromZero);
            averageDailyCost = Math.Round(toDateResult.TotalGross / elapsedDays, 2, MidpointRounding.AwayFromZero);
        }
        else if (daysTotal > 0 && forecast.ConsumptionKwh > 0)
        {
            averageDailyKwh = Math.Round(forecast.ConsumptionKwh / daysTotal, 2, MidpointRounding.AwayFromZero);
            averageDailyCost = Math.Round(forecast.TotalGross / daysTotal, 2, MidpointRounding.AwayFromZero);
        }

        decimal? budget = property.MonthlyBudget is { } monthly ? monthly * property.BillingPeriodMonths : null;
        decimal? budgetUsage = budget is > 0 ? Math.Round(forecast.TotalGross / budget.Value * 100m, 1, MidpointRounding.AwayFromZero) : null;

        var contract = data.ContractOn(today);
        var assumptions = forecast.Assumptions.ToList();
        assumptions.Insert(1, "Prognoza zakłada, że do końca okresu zużycie będzie zbliżone do średniej z ostatnich odczytów.");

        return new ForecastDto(
            propertyId,
            periodStart,
            periodEndExclusive.AddDays(-1),
            daysTotal,
            daysElapsed,
            lastReading,
            toDateResult?.ConsumptionKwh ?? 0m,
            toDateResult?.TotalGross ?? 0m,
            forecast.ConsumptionKwh,
            forecast.TotalNet,
            forecast.TotalGross,
            averageDailyKwh,
            averageDailyCost,
            budget,
            budgetUsage,
            property.CurrencyCode,
            contract is not null,
            contract is not null && data.RatePlansOn(contract, today).Count > 0,
            data.ImportRegisters.Sum(r => r.Series.Points.Count),
            IsEstimate: true,
            forecast.IsComplete,
            assumptions);
    }

    private async Task<SeriesDto> SeriesAsync(Guid propertyId, DateOnly from, DateOnly to, Granularity granularity, bool includeCost, CancellationToken ct)
    {
        new Validation()
            .Require(Enum.IsDefined(granularity), nameof(granularity), "Nieznana granulacja.")
            .Require(to >= from, nameof(to), "Data końcowa musi być późniejsza lub równa początkowej.")
            .ThrowIfInvalid();

        var buckets = Buckets(from, to, granularity).ToList();
        new Validation().Require(buckets.Count <= MaxPoints, nameof(to), $"Zakres jest zbyt duży – maksymalnie {MaxPoints} punktów.").ThrowIfInvalid();

        var data = await PropertyEnergyData.LoadAsync(db, currentUser.UserId, propertyId, ct);
        var tz = data.TimeZone;
        var now = clock.GetUtcNow();
        var points = new List<SeriesPointDto>();
        var assumptions = new List<string>();
        var anyEstimate = false;

        foreach (var (bucketStart, bucketEndExclusive) in buckets)
        {
            var start = TimeZones.StartOfDay(bucketStart, tz);
            if (start >= now)
                break;

            var end = TimeZones.StartOfDay(bucketEndExclusive, tz);
            var isPartial = end > now;
            if (isPartial)
                end = now;

            decimal? consumption = null;
            decimal? cost = null;
            bool isEstimate;

            if (includeCost)
            {
                var result = CostEngine.Calculate(data, start, end, now);
                var hasData = result.SourceValues.Any(v => v.Value is not null && v.At == end);
                consumption = hasData ? result.ConsumptionKwh : null;
                cost = result.Lines.Count > 0 ? result.TotalGross : null;
                isEstimate = result.IsEstimate;
                assumptions.AddRange(result.Assumptions.Skip(1));
            }
            else
            {
                isEstimate = false;
                foreach (var register in data.ImportRegisters)
                {
                    var estimate = register.Series.Consumption(start, end);
                    if (estimate is null)
                        continue;
                    consumption = (consumption ?? 0m) + estimate.Kwh;
                    isEstimate |= estimate.IsEstimate;
                }

                if (consumption is not null)
                    consumption = Math.Round(consumption.Value, 3, MidpointRounding.AwayFromZero);
            }

            anyEstimate |= isEstimate;
            points.Add(new SeriesPointDto(bucketStart, bucketEndExclusive.AddDays(-1), consumption, cost, isEstimate, isPartial));
        }

        if (anyEstimate)
            assumptions.Insert(0, SparseReadingsNotice);

        return new SeriesDto(
            propertyId,
            granularity,
            from,
            to,
            data.Property.CurrencyCode,
            points.Sum(p => p.ConsumptionKwh ?? 0m),
            includeCost ? points.Sum(p => p.CostGross ?? 0m) : null,
            anyEstimate,
            points,
            assumptions.Distinct().ToList());
    }

    /// <summary>Calendar buckets covering [from, to] (inclusive dates); weeks start on Monday.</summary>
    public static IEnumerable<(DateOnly Start, DateOnly EndExclusive)> Buckets(DateOnly from, DateOnly to, Granularity granularity)
    {
        var start = granularity switch
        {
            Granularity.Week => from.AddDays(-(((int)from.DayOfWeek + 6) % 7)),
            Granularity.Month => new DateOnly(from.Year, from.Month, 1),
            Granularity.Year => new DateOnly(from.Year, 1, 1),
            _ => from,
        };

        while (start <= to)
        {
            var next = granularity switch
            {
                Granularity.Week => start.AddDays(7),
                Granularity.Month => start.AddMonths(1),
                Granularity.Year => start.AddYears(1),
                _ => start.AddDays(1),
            };
            yield return (start, next);
            start = next;
        }
    }

    private static DateTimeOffset Clamp(DateTimeOffset value, DateTimeOffset min, DateTimeOffset max) =>
        value < min ? min : value > max ? max : value;
}
