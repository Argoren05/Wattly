using Wattly.Domain.Common;

namespace Wattly.Domain.Tariffs;

/// <summary>Single price component. Rates are net; <see cref="TaxRate"/> is a fraction (0.23 = 23% VAT).</summary>
public class TariffRateComponent : Entity
{
    /// <summary>Owning rate plan.</summary>
    public Guid TariffRatePlanId { get; set; }

    /// <summary>Kind of the fee.</summary>
    public RateComponentType ComponentType { get; set; }

    /// <summary>Name as printed on the bill, e.g. "Opłata sieciowa stała".</summary>
    public required string Name { get; set; }

    /// <summary>Tariff zone the rate applies to; null means the whole consumption / not zone dependent.</summary>
    public string? ZoneCode { get; set; }

    /// <summary>Unit of the rate.</summary>
    public RateUnit Unit { get; set; }

    /// <summary>Net rate per unit.</summary>
    public decimal NetRate { get; set; }

    /// <summary>VAT as a fraction (0–1).</summary>
    public decimal TaxRate { get; set; }
}
