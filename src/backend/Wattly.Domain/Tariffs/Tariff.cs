using Wattly.Domain.Common;

namespace Wattly.Domain.Tariffs;

/// <summary>Tariff group (e.g. G11, G12, G12w, G13) with its time zones.</summary>
public class Tariff : Entity
{
    /// <summary>Unique code, e.g. "G12".</summary>
    public required string Code { get; set; }

    /// <summary>Display name.</summary>
    public required string Name { get; set; }

    /// <summary>Optional description for users.</summary>
    public string? Description { get; set; }

    /// <summary>Inactive tariffs cannot be selected for new contracts.</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>Empty for single-zone tariffs.</summary>
    public List<TariffZone> Zones { get; set; } = [];
}

/// <summary>Time zone of a multi-zone tariff (e.g. day/night). Stored as JSON inside the tariff.</summary>
public class TariffZone
{
    /// <summary>Zone code matched against register and rate component zone codes, e.g. "NIGHT".</summary>
    public required string Code { get; set; }

    /// <summary>Display name, e.g. "Nocna".</summary>
    public required string Name { get; set; }

    /// <summary>Human-readable schedule; exact hours depend on the operator's tariff and are configured per rate plan source.</summary>
    public string? ScheduleDescription { get; set; }
}
