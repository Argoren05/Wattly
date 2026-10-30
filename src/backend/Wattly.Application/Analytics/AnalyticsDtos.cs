namespace Wattly.Application.Analytics;

public enum Granularity
{
    Day,
    Week,
    Month,
    Year,
}

public sealed record SeriesPointDto(
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    decimal? ConsumptionKwh,
    decimal? CostGross,
    bool IsEstimate,
    bool IsPartial);

public sealed record SeriesDto(
    Guid PropertyId,
    Granularity Granularity,
    DateOnly From,
    DateOnly To,
    string CurrencyCode,
    decimal TotalConsumptionKwh,
    decimal? TotalCostGross,
    bool IsEstimate,
    IReadOnlyList<SeriesPointDto> Points,
    IReadOnlyList<string> Assumptions);

public sealed record ForecastDto(
    Guid PropertyId,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    DateTimeOffset PeriodStartAt,
    DateTimeOffset PeriodEndAt,
    int DaysTotal,
    int DaysElapsed,
    DateTimeOffset? LastReadingAt,
    decimal ConsumptionToDateKwh,
    decimal CostToDateGross,
    decimal ForecastConsumptionKwh,
    decimal ForecastCostNet,
    decimal ForecastCostGross,
    decimal? AverageDailyKwh,
    decimal? AverageDailyCostGross,
    decimal? BudgetForPeriod,
    decimal? BudgetUsagePercent,
    string CurrencyCode,
    bool HasContract,
    bool HasRatePlans,
    int ReadingsCount,
    bool IsEstimate,
    bool IsComplete,
    IReadOnlyList<string> Assumptions);
