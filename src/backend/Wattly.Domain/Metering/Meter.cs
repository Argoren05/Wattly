using Wattly.Domain.Common;
using Wattly.Domain.Households;

namespace Wattly.Domain.Metering;

public class Meter : Entity
{
    public Guid PropertyId { get; set; }
    public Property Property { get; set; } = null!;

    public string? SerialNumber { get; set; }
    public required string Name { get; set; }
    public MeterType MeterType { get; set; }
    public MeterDirectionality Directionality { get; set; }
    public DateOnly? InstalledAt { get; set; }
    public DateOnly? RemovedAt { get; set; }
    public bool IsActive { get; set; } = true;

    public List<MeterRegister> Registers { get; set; } = [];
}
