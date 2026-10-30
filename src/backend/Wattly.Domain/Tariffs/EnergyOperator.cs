using Wattly.Domain.Common;

namespace Wattly.Domain.Tariffs;

/// <summary>Distribution system operator (OSD).</summary>
public class EnergyOperator : Entity
{
    public required string Name { get; set; }
    public required string Code { get; set; }
    public string CountryCode { get; set; } = "PL";
    public bool IsActive { get; set; } = true;
}
