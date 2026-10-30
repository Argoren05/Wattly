using Wattly.Domain.Calculations;
using Wattly.Domain.Tariffs;

namespace Wattly.Application.Calculations;

/// <summary>Calculation period.</summary>
/// <param name="From">Start (inclusive).</param>
/// <param name="To">End (exclusive).</param>
public sealed record CalculationRequest(DateTimeOffset From, DateTimeOffset To);

/// <summary>Consumption of one tariff zone.</summary>
/// <param name="ZoneCode">Zone code.</param>
/// <param name="ConsumptionKwh">Consumption.</param>
public sealed record ZoneConsumptionDto(string? ZoneCode, decimal ConsumptionKwh);

/// <summary>Register value used at a period boundary.</summary>
/// <param name="RegisterId">Register.</param>
/// <param name="RegisterName">Register name.</param>
/// <param name="ZoneCode">Zone.</param>
/// <param name="At">Boundary moment.</param>
/// <param name="Value">Value, or null when unknown.</param>
/// <param name="Kind">Actual, interpolated or extrapolated.</param>
public sealed record SourceValueDto(Guid RegisterId, string RegisterName, string? ZoneCode, DateTimeOffset At, decimal? Value, ValueKind? Kind);

/// <summary>Rate plan used by a calculation.</summary>
/// <param name="Id">Rate plan.</param>
/// <param name="Name">Name.</param>
/// <param name="ValidFrom">First day of validity (null for stored snapshots).</param>
/// <param name="ValidTo">Last day of validity.</param>
/// <param name="SourceReference">Source of rates (null for stored snapshots).</param>
public sealed record AppliedRatePlanDto(Guid Id, string Name, DateOnly? ValidFrom, DateOnly? ValidTo, string? SourceReference);

/// <summary>Calculated component.</summary>
/// <param name="RatePlanId">Source plan.</param>
/// <param name="RatePlanName">Plan name.</param>
/// <param name="ComponentType">Kind.</param>
/// <param name="Category">Category.</param>
/// <param name="ComponentName">Name.</param>
/// <param name="ZoneCode">Zone.</param>
/// <param name="Unit">Unit.</param>
/// <param name="Quantity">Quantity.</param>
/// <param name="NetRate">Net rate.</param>
/// <param name="TaxRate">VAT fraction.</param>
/// <param name="NetAmount">Net amount.</param>
/// <param name="SegmentStart">Segment start.</param>
/// <param name="SegmentEnd">Segment end.</param>
public sealed record CostLineDto(
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

/// <summary>VAT for one rate.</summary>
/// <param name="TaxRate">VAT fraction.</param>
/// <param name="NetAmount">Net base.</param>
/// <param name="TaxAmount">VAT.</param>
public sealed record TaxSummaryDto(decimal TaxRate, decimal NetAmount, decimal TaxAmount);

/// <summary>Full, explainable calculation result.</summary>
/// <param name="Id">Identifier when saved; null for previews.</param>
/// <param name="PropertyId">Property.</param>
/// <param name="PeriodStart">Period start.</param>
/// <param name="PeriodEnd">Period end.</param>
/// <param name="CalculatedAt">Calculation time.</param>
/// <param name="CalculationVersion">Algorithm version.</param>
/// <param name="ConsumptionKwh">Total consumption.</param>
/// <param name="ConsumptionByZone">Consumption per zone.</param>
/// <param name="SourceValues">Register values at period boundaries.</param>
/// <param name="RatePlans">Rate plans used.</param>
/// <param name="Lines">Component lines.</param>
/// <param name="Taxes">VAT summary.</param>
/// <param name="EnergyCostNet">Net energy cost.</param>
/// <param name="DistributionCostNet">Net distribution cost.</param>
/// <param name="OtherCostNet">Net other cost.</param>
/// <param name="TotalNet">Total net.</param>
/// <param name="TaxAmount">Total VAT.</param>
/// <param name="TotalGross">Total gross.</param>
/// <param name="CurrencyCode">Currency.</param>
/// <param name="IsEstimate">Whether any value is estimated.</param>
/// <param name="IsComplete">Whether data were sufficient for the whole period.</param>
/// <param name="Assumptions">Assumptions and limitations.</param>
public sealed record CalculationResultDto(
    Guid? Id,
    Guid PropertyId,
    DateTimeOffset PeriodStart,
    DateTimeOffset PeriodEnd,
    DateTimeOffset CalculatedAt,
    int CalculationVersion,
    decimal ConsumptionKwh,
    IReadOnlyList<ZoneConsumptionDto> ConsumptionByZone,
    IReadOnlyList<SourceValueDto> SourceValues,
    IReadOnlyList<AppliedRatePlanDto> RatePlans,
    IReadOnlyList<CostLineDto> Lines,
    IReadOnlyList<TaxSummaryDto> Taxes,
    decimal EnergyCostNet,
    decimal DistributionCostNet,
    decimal OtherCostNet,
    decimal TotalNet,
    decimal TaxAmount,
    decimal TotalGross,
    string CurrencyCode,
    bool IsEstimate,
    bool IsComplete,
    IReadOnlyList<string> Assumptions);

/// <summary>Saved calculation on a list.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="PeriodStart">Period start.</param>
/// <param name="PeriodEnd">Period end.</param>
/// <param name="CalculatedAt">Calculation time.</param>
/// <param name="ConsumptionKwh">Consumption.</param>
/// <param name="TotalGross">Gross total.</param>
/// <param name="CurrencyCode">Currency.</param>
/// <param name="IsEstimate">Estimate flag.</param>
/// <param name="IsComplete">Completeness flag.</param>
public sealed record CalculationSummaryDto(
    Guid Id,
    DateTimeOffset PeriodStart,
    DateTimeOffset PeriodEnd,
    DateTimeOffset CalculatedAt,
    decimal ConsumptionKwh,
    decimal TotalGross,
    string CurrencyCode,
    bool IsEstimate,
    bool IsComplete);
