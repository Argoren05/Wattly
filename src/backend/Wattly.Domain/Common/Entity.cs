namespace Wattly.Domain.Common;

/// <summary>
/// Base class of all persisted domain entities.
/// </summary>
public abstract class Entity
{
    /// <summary>
    /// Unique identifier. UUID v7 is time-ordered, which keeps B-tree indexes compact and makes inserts cheap.
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();
}
