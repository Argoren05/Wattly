using Wattly.Domain.Common;

namespace Wattly.Domain.Tariffs;

/// <summary>Distribution system operator (OSD) – catalog entry managed by administrators.</summary>
public class EnergyOperator : Entity
{
    /// <summary>Full company name.</summary>
    public required string Name { get; set; }

    /// <summary>Unique, upper-case catalog code.</summary>
    public required string Code { get; set; }

    /// <summary>ISO 3166-1 alpha-2 country code.</summary>
    public string CountryCode { get; set; } = "PL";

    /// <summary>Inactive entries are hidden from users but kept for history.</summary>
    public bool IsActive { get; set; } = true;
}
