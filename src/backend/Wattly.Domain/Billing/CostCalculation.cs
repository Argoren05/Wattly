using Wattly.Domain.Common;
using Wattly.Domain.Tariffs;

namespace Wattly.Domain.Billing;

/// <summary>
/// Persisted calculation result. Lines keep a snapshot of the rates used, so later price list changes never alter history.
/// </summary>
public class CostCalculation : Entity
{
    public Guid PropertyId { get; set; }
    public DateTimeOffset PeriodStart { get; set; }
    public DateTimeOffset PeriodEnd { get; set; }
    public DateTimeOffset CalculatedAt { get; set; }
    public int CalculationVersion { get; set; }

    public decimal ConsumptionKwh { get; set; }
    public decimal EnergyCostNet { get; set; }
    public decimal DistributionCostNet { get; set; }
    public decimal OtherCostNet { get; set; }
    public decimal TotalNet { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalGross { get; set; }
    public string CurrencyCode { get; set; } = "PLN";

    public bool IsEstimate { get; set; }
    public bool IsComplete { get; set; }
    public List<string> Assumptions { get; set; } = [];

    public Guid CreatedByUserId { get; set; }

    public List<CostCalculationLine> Lines { get; set; } = [];
}

public class CostCalculationLine : Entity
{
    public Guid CostCalculationId { get; set; }

    public Guid TariffRatePlanId { get; set; }
    public required string RatePlanName { get; set; }
    public RateComponentType ComponentType { get; set; }
    public CostCategory Category { get; set; }
    public required string ComponentName { get; set; }
    public string? ZoneCode { get; set; }
    public RateUnit Unit { get; set; }
    public decimal Quantity { get; set; }
    public decimal NetRate { get; set; }
    public decimal TaxRate { get; set; }
    public decimal NetAmount { get; set; }
    public DateTimeOffset SegmentStart { get; set; }
    public DateTimeOffset SegmentEnd { get; set; }
}
