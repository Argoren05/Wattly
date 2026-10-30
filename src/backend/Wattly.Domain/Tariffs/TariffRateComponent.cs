using Wattly.Domain.Common;

namespace Wattly.Domain.Tariffs;

/// <summary>Single price component. Rates are net; <see cref="TaxRate"/> is a fraction (0.23 = 23% VAT).</summary>
public class TariffRateComponent : Entity
{
    public Guid TariffRatePlanId { get; set; }

    public RateComponentType ComponentType { get; set; }
    public required string Name { get; set; }

    /// <summary>Tariff zone the rate applies to; null means the whole consumption / not zone dependent.</summary>
    public string? ZoneCode { get; set; }

    public RateUnit Unit { get; set; }
    public decimal NetRate { get; set; }
    public decimal TaxRate { get; set; }
}
