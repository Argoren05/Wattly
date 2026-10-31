using Wattly.Domain.Common;

namespace Wattly.Domain.Households;

/// <summary>
/// Group of properties owned by one user. All access control on user data is derived from <see cref="OwnerUserId"/>.
/// </summary>
public class Household : Entity
{
    /// <summary>Identifier of the owning user account.</summary>
    public Guid OwnerUserId { get; set; }

    /// <summary>Display name of the household.</summary>
    public required string Name { get; set; }

    /// <summary>Creation time (UTC).</summary>
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Last modification time (UTC).</summary>
    public DateTimeOffset UpdatedAt { get; set; }

    /// <summary>Properties belonging to the household.</summary>
    public List<Property> Properties { get; set; } = [];
}
