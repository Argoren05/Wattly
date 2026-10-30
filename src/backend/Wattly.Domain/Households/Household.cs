using Wattly.Domain.Common;

namespace Wattly.Domain.Households;

public class Household : Entity
{
    public Guid OwnerUserId { get; set; }
    public required string Name { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public List<Property> Properties { get; set; } = [];
}
