using Wattly.Domain.Common;
using Wattly.Domain.Households;

namespace Wattly.Domain.Appliances;

/// <summary>Where the consumption data of an appliance comes from.</summary>
public enum ApplianceSource
{
    /// <summary>Entered by the user (e.g. monthly kWh read from the SmartThings app).</summary>
    Manual,

    /// <summary>TP-Link Tapo smart plug with energy monitoring, read by the phone in the home network.</summary>
    Tapo,
}

/// <summary>
/// Device whose consumption is tracked separately (a fridge, a plug with a washing machine…), so the property's
/// consumption can be split into "what uses the electricity" (DEC-034).
/// </summary>
public class Appliance : Entity
{
    /// <summary>Property the appliance belongs to.</summary>
    public Guid PropertyId { get; set; }

    /// <summary>Navigation to the property.</summary>
    public Property Property { get; set; } = null!;

    /// <summary>Display name, e.g. "Lodówka".</summary>
    public required string Name { get; set; }

    /// <summary>Source of the data.</summary>
    public ApplianceSource Source { get; set; }

    /// <summary>Identifier in the source system (Tapo device_id); unique within the property.</summary>
    public string? ExternalId { get; set; }

    /// <summary>Device model, e.g. "P110".</summary>
    public string? Model { get; set; }

    /// <summary>Hidden appliances are kept but left out of the breakdown.</summary>
    public bool IsHidden { get; set; }

    /// <summary>Creation time (UTC).</summary>
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Consumption entries.</summary>
    public List<ApplianceUsage> Usage { get; set; } = [];
}

/// <summary>
/// Energy used by an appliance in a period of whole days (inclusive). Tapo plugs give one entry per day; manual
/// entries may span a month. Entries of one appliance should not overlap; the same period is replaced on upload.
/// </summary>
public class ApplianceUsage : Entity
{
    /// <summary>Appliance.</summary>
    public Guid ApplianceId { get; set; }

    /// <summary>First day.</summary>
    public DateOnly PeriodStart { get; set; }

    /// <summary>Last day (inclusive).</summary>
    public DateOnly PeriodEnd { get; set; }

    /// <summary>Energy in the period (kWh).</summary>
    public decimal EnergyKwh { get; set; }

    /// <summary>Last upload/modification time (UTC).</summary>
    public DateTimeOffset UpdatedAt { get; set; }

    /// <summary>Number of days of the period.</summary>
    public int Days => PeriodEnd.DayNumber - PeriodStart.DayNumber + 1;
}
