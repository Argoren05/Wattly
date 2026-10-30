using Wattly.Domain.Common;
using Wattly.Domain.Tariffs;

namespace Wattly.Domain.Households;

/// <summary>
/// Energy contract of a property for a given time span. Supplier (seller) and distribution operator are separate roles.
/// </summary>
public class EnergyContract : Entity, IAuditable
{
    public Guid PropertyId { get; set; }
    public Property Property { get; set; } = null!;

    public Guid? SupplierId { get; set; }
    public EnergySupplier? Supplier { get; set; }

    public Guid? OperatorId { get; set; }
    public EnergyOperator? Operator { get; set; }

    public Guid TariffId { get; set; }
    public Tariff Tariff { get; set; } = null!;

    public decimal? ContractedPowerKw { get; set; }

    public DateOnly ValidFrom { get; set; }

    /// <summary>Inclusive last day of validity; null means open-ended.</summary>
    public DateOnly? ValidTo { get; set; }

    public bool IsValidOn(DateOnly date) => date >= ValidFrom && (ValidTo is null || date <= ValidTo);
}
