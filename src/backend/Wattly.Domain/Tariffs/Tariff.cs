using Wattly.Domain.Common;

namespace Wattly.Domain.Tariffs;

/// <summary>Tariff group (e.g. G11, G12, G12w, G13) with its time zones.</summary>
public class Tariff : Entity
{
    public required string Code { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>Empty for single-zone tariffs.</summary>
    public List<TariffZone> Zones { get; set; } = [];
}

public class TariffZone
{
    public required string Code { get; set; }
    public required string Name { get; set; }

    /// <summary>Human-readable schedule; exact hours depend on the operator's tariff and are configured per rate plan source.</summary>
    public string? ScheduleDescription { get; set; }
}
