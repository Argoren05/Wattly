using Microsoft.AspNetCore.Identity;

namespace Wattly.Infrastructure.Identity;

public class AppUser : IdentityUser<Guid>
{
    public AppUser() => Id = Guid.CreateVersion7();

    public DateTimeOffset CreatedAt { get; set; }
}
