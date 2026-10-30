using Wattly.Domain.Common;
using Wattly.Domain.Households;

namespace Wattly.Domain.Metering;

/// <summary>Physical electricity meter installed in a property.</summary>
public class Meter : Entity
{
    /// <summary>Property where the meter is installed.</summary>
    public Guid PropertyId { get; set; }

    /// <summary>Navigation to the property.</summary>
    public Property Property { get; set; } = null!;

    /// <summary>Serial number printed on the meter (optional).</summary>
    public string? SerialNumber { get; set; }

    /// <summary>Display name.</summary>
    public required string Name { get; set; }

    /// <summary>Meter technology.</summary>
    public MeterType MeterType { get; set; }

    /// <summary>Import only or bidirectional.</summary>
    public MeterDirectionality Directionality { get; set; }

    /// <summary>Installation date (optional).</summary>
    public DateOnly? InstalledAt { get; set; }

    /// <summary>Removal date, e.g. after replacement (optional).</summary>
    public DateOnly? RemovedAt { get; set; }

    /// <summary>Inactive meters are hidden from reading entry.</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>Registers (counters) of the meter.</summary>
    public List<MeterRegister> Registers { get; set; } = [];
}
