using Wattly.Domain.Common;

namespace Wattly.Domain.Audit;

public class AuditEvent : Entity
{
    public Guid? ActorUserId { get; set; }
    public required string EntityType { get; set; }
    public Guid EntityId { get; set; }
    public required string Action { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
    public string? ChangesJson { get; set; }
}
