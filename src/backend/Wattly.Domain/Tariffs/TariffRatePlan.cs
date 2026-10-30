using Wattly.Domain.Common;

namespace Wattly.Domain.Tariffs;

/// <summary>
/// Versioned price list for a tariff. Catalog plans have no <see cref="PropertyId"/>; plans entered by a user belong to one property.
/// Rate plans are immutable after creation except for closing their validity – a price change is a new plan.
/// </summary>
public class TariffRatePlan : Entity, IAuditable
{
    public Guid TariffId { get; set; }
    public Tariff Tariff { get; set; } = null!;

    public Guid? SupplierId { get; set; }
    public Guid? OperatorId { get; set; }

    /// <summary>Set for user-defined plans (own rates for a property).</summary>
    public Guid? PropertyId { get; set; }

    public required string Name { get; set; }
    public DateOnly ValidFrom { get; set; }

    /// <summary>Inclusive last day of validity; null means open-ended.</summary>
    public DateOnly? ValidTo { get; set; }

    public string CurrencyCode { get; set; } = "PLN";

    /// <summary>Where the rates come from (document name, URL, invoice number…).</summary>
    public required string SourceReference { get; set; }

    public DateOnly? PublishedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public List<TariffRateComponent> Components { get; set; } = [];

    public bool IsValidOn(DateOnly date) => date >= ValidFrom && (ValidTo is null || date <= ValidTo);

    public bool Overlaps(DateOnly from, DateOnly? to) =>
        (to is null || ValidFrom <= to) && (ValidTo is null || from <= ValidTo);
}
