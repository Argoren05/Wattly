using Microsoft.AspNetCore.Identity;

namespace Wattly.Infrastructure.Identity;

/// <summary>User account (ASP.NET Core Identity) with a time-ordered identifier.</summary>
public class AppUser : IdentityUser<Guid>
{
    /// <summary>Creates a user with a new UUID v7.</summary>
    public AppUser() => Id = Guid.CreateVersion7();

    /// <summary>Registration time (UTC).</summary>
    public DateTimeOffset CreatedAt { get; set; }
}
