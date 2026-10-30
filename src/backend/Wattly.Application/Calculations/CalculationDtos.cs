using Wattly.Domain.Calculations;
using Wattly.Domain.Tariffs;

namespace Wattly.Application.Calculations;

public sealed record CalculationRequest(DateTimeOffset From, DateTimeOffset To);

public sealed record ZoneConsumptionDto(string? ZoneCode, decimal ConsumptionKwh);

public sealed record SourceValueDto(Guid RegisterId, string RegisterName, string? ZoneCode, DateTimeOffset At, decimal? Value, ValueKind? Kind);

public sealed record AppliedRatePlanDto(Guid Id, string Name, DateOnly? ValidFrom, DateOnly? ValidTo, string? SourceReference);

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

public sealed record TaxSummaryDto(decimal TaxRate, decimal NetAmount, decimal TaxAmount);

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
