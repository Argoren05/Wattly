using Wattly.Domain.Common;

namespace Wattly.Domain.Tariffs;

/// <summary>
/// Versioned price list for a tariff. Catalog plans have no <see cref="PropertyId"/>; plans entered by a user belong to one property.
/// Rate plans are immutable after creation except for closing their validity – a price change is a new plan.
/// </summary>
public class TariffRatePlan : Entity, IAuditable
{
    /// <summary>Tariff the prices apply to.</summary>
    public Guid TariffId { get; set; }

    /// <summary>Navigation to the tariff.</summary>
    public Tariff Tariff { get; set; } = null!;

    /// <summary>Supplier the plan is limited to; null = any supplier.</summary>
    public Guid? SupplierId { get; set; }

    /// <summary>Operator the plan is limited to; null = any operator.</summary>
    public Guid? OperatorId { get; set; }

    /// <summary>Set for user-defined plans (own rates for a property).</summary>
    public Guid? PropertyId { get; set; }

    /// <summary>Display name.</summary>
    public required string Name { get; set; }

    /// <summary>First day of validity.</summary>
    public DateOnly ValidFrom { get; set; }

    /// <summary>Inclusive last day of validity; null means open-ended.</summary>
    public DateOnly? ValidTo { get; set; }

    /// <summary>Currency of the rates.</summary>
    public string CurrencyCode { get; set; } = "PLN";

    /// <summary>Where the rates come from (document name, URL, invoice number…).</summary>
    public required string SourceReference { get; set; }

    /// <summary>Publication date of the source price list, if known.</summary>
    public DateOnly? PublishedAt { get; set; }

    /// <summary>Creation time (UTC).</summary>
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Price components of the plan.</summary>
    public List<TariffRateComponent> Components { get; set; } = [];

    /// <summary>Checks whether the plan is valid on the given calendar day.</summary>
    /// <param name="date">Calendar date in the property time zone.</param>
    public bool IsValidOn(DateOnly date) => date >= ValidFrom && (ValidTo is null || date <= ValidTo);

    /// <summary>Checks whether the plan's validity overlaps the inclusive range [<paramref name="from"/>, <paramref name="to"/>].</summary>
    /// <param name="from">First day of the other range.</param>
    /// <param name="to">Last day of the other range; null = open-ended.</param>
    public bool Overlaps(DateOnly from, DateOnly? to) =>
        (to is null || ValidFrom <= to) && (ValidTo is null || from <= ValidTo);
}
