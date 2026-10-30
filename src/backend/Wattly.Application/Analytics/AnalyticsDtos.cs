namespace Wattly.Application.Analytics;

/// <summary>Size of buckets of a time series.</summary>
public enum Granularity
{
    /// <summary>Calendar days.</summary>
    Day,

    /// <summary>Weeks starting on Monday.</summary>
    Week,

    /// <summary>Calendar months.</summary>
    Month,

    /// <summary>Calendar years.</summary>
    Year,
}

/// <summary>One bucket of a series.</summary>
/// <param name="PeriodStart">First day.</param>
/// <param name="PeriodEnd">Last day (inclusive).</param>
/// <param name="ConsumptionKwh">Consumption, or null without data.</param>
/// <param name="CostGross">Gross cost (cost series only).</param>
/// <param name="IsEstimate">Whether values are estimated.</param>
/// <param name="IsPartial">Bucket cut at the current moment.</param>
public sealed record SeriesPointDto(
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    decimal? ConsumptionKwh,
    decimal? CostGross,
    bool IsEstimate,
    bool IsPartial);

/// <summary>Consumption or cost series.</summary>
/// <param name="PropertyId">Property.</param>
/// <param name="Granularity">Bucket size.</param>
/// <param name="From">Requested start.</param>
/// <param name="To">Requested end.</param>
/// <param name="CurrencyCode">Currency.</param>
/// <param name="TotalConsumptionKwh">Sum of consumption.</param>
/// <param name="TotalCostGross">Sum of cost (cost series only).</param>
/// <param name="IsEstimate">Whether any bucket is estimated.</param>
/// <param name="Points">Buckets.</param>
/// <param name="Assumptions">Assumptions.</param>
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

/// <summary>Dashboard figures for the current billing period.</summary>
/// <param name="PropertyId">Property.</param>
/// <param name="PeriodStart">First day of the period.</param>
/// <param name="PeriodEnd">Last day of the period (inclusive).</param>
/// <param name="PeriodStartAt">Exact start instant in the property time zone.</param>
/// <param name="PeriodEndAt">Exact end instant (exclusive).</param>
/// <param name="DaysTotal">Days in the period.</param>
/// <param name="DaysElapsed">Days elapsed including today.</param>
/// <param name="LastReadingAt">Latest reading.</param>
/// <param name="ConsumptionToDateKwh">Consumption from period start to the last reading.</param>
/// <param name="CostToDateGross">Cost from period start to the last reading.</param>
/// <param name="ForecastConsumptionKwh">Forecast consumption for the whole period.</param>
/// <param name="ForecastCostNet">Forecast net cost.</param>
/// <param name="ForecastCostGross">Forecast gross cost.</param>
/// <param name="AverageDailyKwh">Average daily consumption.</param>
/// <param name="AverageDailyCostGross">Average daily cost.</param>
/// <param name="BudgetForPeriod">Monthly budget × period length.</param>
/// <param name="BudgetUsagePercent">Forecast as a percentage of the budget.</param>
/// <param name="CurrencyCode">Currency.</param>
/// <param name="HasContract">Whether a contract is in force today.</param>
/// <param name="HasRatePlans">Whether rates exist for today.</param>
/// <param name="ReadingsCount">Number of active import readings.</param>
/// <param name="IsEstimate">Always true – a forecast is never an invoice.</param>
/// <param name="IsComplete">Whether data were sufficient.</param>
/// <param name="Assumptions">Assumptions.</param>
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
