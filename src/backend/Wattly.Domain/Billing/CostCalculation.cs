using Wattly.Domain.Common;
using Wattly.Domain.Tariffs;

namespace Wattly.Domain.Billing;

/// <summary>
/// Persisted calculation result. Lines keep a snapshot of the rates used, so later price list changes never alter history.
/// </summary>
public class CostCalculation : Entity
{
    /// <summary>Property the calculation belongs to.</summary>
    public Guid PropertyId { get; set; }

    /// <summary>Start of the calculated period (UTC, inclusive).</summary>
    public DateTimeOffset PeriodStart { get; set; }

    /// <summary>End of the calculated period (UTC, exclusive).</summary>
    public DateTimeOffset PeriodEnd { get; set; }

    /// <summary>When the calculation was made.</summary>
    public DateTimeOffset CalculatedAt { get; set; }

    /// <summary>Version of the calculation algorithm (see <c>CostCalculator.Version</c>).</summary>
    public int CalculationVersion { get; set; }

    /// <summary>Total consumption of import registers (kWh).</summary>
    public decimal ConsumptionKwh { get; set; }

    /// <summary>Net cost of energy.</summary>
    public decimal EnergyCostNet { get; set; }

    /// <summary>Net cost of distribution.</summary>
    public decimal DistributionCostNet { get; set; }

    /// <summary>Net cost of other fees.</summary>
    public decimal OtherCostNet { get; set; }

    /// <summary>Total net amount.</summary>
    public decimal TotalNet { get; set; }

    /// <summary>Total VAT.</summary>
    public decimal TaxAmount { get; set; }

    /// <summary>Total gross amount.</summary>
    public decimal TotalGross { get; set; }

    /// <summary>Currency of the amounts.</summary>
    public string CurrencyCode { get; set; } = "PLN";

    /// <summary>True when any value was interpolated/extrapolated or the period extends into the future.</summary>
    public bool IsEstimate { get; set; }

    /// <summary>False when readings, contract or rates were missing for part of the period.</summary>
    public bool IsComplete { get; set; }

    /// <summary>Explanations of estimates and omissions, shown to the user.</summary>
    public List<string> Assumptions { get; set; } = [];

    /// <summary>User who saved the calculation.</summary>
    public Guid CreatedByUserId { get; set; }

    /// <summary>Calculated components with rate snapshots.</summary>
    public List<CostCalculationLine> Lines { get; set; } = [];
}

/// <summary>One component of a saved calculation – a snapshot of the rate and quantity used.</summary>
public class CostCalculationLine : Entity
{
    /// <summary>Owning calculation.</summary>
    public Guid CostCalculationId { get; set; }

    /// <summary>Rate plan the rate came from (informational, no FK).</summary>
    public Guid TariffRatePlanId { get; set; }

    /// <summary>Snapshot of the rate plan name.</summary>
    public required string RatePlanName { get; set; }

    /// <summary>Component kind.</summary>
    public RateComponentType ComponentType { get; set; }

    /// <summary>Summary category.</summary>
    public CostCategory Category { get; set; }

    /// <summary>Snapshot of the component name.</summary>
    public required string ComponentName { get; set; }

    /// <summary>Tariff zone, if zone dependent.</summary>
    public string? ZoneCode { get; set; }

    /// <summary>Unit of the rate.</summary>
    public RateUnit Unit { get; set; }

    /// <summary>Quantity (kWh, months, days or kW·months).</summary>
    public decimal Quantity { get; set; }

    /// <summary>Snapshot of the net rate.</summary>
    public decimal NetRate { get; set; }

    /// <summary>Snapshot of the VAT rate.</summary>
    public decimal TaxRate { get; set; }

    /// <summary>Rounded net amount of the line.</summary>
    public decimal NetAmount { get; set; }

    /// <summary>Start of the segment the line was calculated for.</summary>
    public DateTimeOffset SegmentStart { get; set; }

    /// <summary>End of the segment the line was calculated for.</summary>
    public DateTimeOffset SegmentEnd { get; set; }
}
