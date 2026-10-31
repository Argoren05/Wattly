using Wattly.Domain.Common;

namespace Wattly.Domain.Audit;

/// <summary>Immutable record of a change to an <see cref="IAuditable"/> entity.</summary>
public class AuditEvent : Entity
{
    /// <summary>User who made the change; null for system operations.</summary>
    public Guid? ActorUserId { get; set; }

    /// <summary>CLR type name of the changed entity.</summary>
    public required string EntityType { get; set; }

    /// <summary>Identifier of the changed entity.</summary>
    public Guid EntityId { get; set; }

    /// <summary>Added, Modified or Deleted.</summary>
    public required string Action { get; set; }

    /// <summary>Time of the change (UTC).</summary>
    public DateTimeOffset OccurredAt { get; set; }

    /// <summary>JSON with changed values (old/new for modifications).</summary>
    public string? ChangesJson { get; set; }
}
