using Wattly.Domain.Common;

namespace Wattly.Domain.Tariffs;

/// <summary>Energy seller.</summary>
public class EnergySupplier : Entity
{
    public required string Name { get; set; }
    public required string Code { get; set; }
    public string CountryCode { get; set; } = "PL";
    public bool IsActive { get; set; } = true;
}
