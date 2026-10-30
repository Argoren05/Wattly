using Wattly.Domain.Common;
using Wattly.Domain.Tariffs;

namespace Wattly.Domain.Households;

/// <summary>
/// Energy contract of a property for a given time span. Supplier (seller) and distribution operator are separate roles.
/// </summary>
public class EnergyContract : Entity, IAuditable
{
    /// <summary>Property the contract belongs to.</summary>
    public Guid PropertyId { get; set; }

    /// <summary>Navigation to the property.</summary>
    public Property Property { get; set; } = null!;

    /// <summary>Energy seller (optional – the user may not know it yet).</summary>
    public Guid? SupplierId { get; set; }

    /// <summary>Navigation to the seller.</summary>
    public EnergySupplier? Supplier { get; set; }

    /// <summary>Distribution system operator (optional).</summary>
    public Guid? OperatorId { get; set; }

    /// <summary>Navigation to the operator.</summary>
    public EnergyOperator? Operator { get; set; }

    /// <summary>Tariff group (G11, G12…) – determines which rate plans apply.</summary>
    public Guid TariffId { get; set; }

    /// <summary>Navigation to the tariff.</summary>
    public Tariff Tariff { get; set; } = null!;

    /// <summary>Contracted power in kW, needed by per-kW components.</summary>
    public decimal? ContractedPowerKw { get; set; }

    /// <summary>First day of validity.</summary>
    public DateOnly ValidFrom { get; set; }

    /// <summary>Inclusive last day of validity; null means open-ended.</summary>
    public DateOnly? ValidTo { get; set; }

    /// <summary>Checks whether the contract is in force on the given calendar day.</summary>
    /// <param name="date">Calendar date in the property time zone.</param>
    public bool IsValidOn(DateOnly date) => date >= ValidFrom && (ValidTo is null || date <= ValidTo);
}
