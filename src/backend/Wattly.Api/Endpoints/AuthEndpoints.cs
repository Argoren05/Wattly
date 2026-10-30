using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Wattly.Infrastructure.Identity;

namespace Wattly.Api.Endpoints;

public static class AuthEndpoints
{
    public sealed record UserDto(Guid Id, string? Email, IReadOnlyList<string> Roles);

    public static void MapAuthEndpoints(this RouteGroupBuilder api)
    {
        var auth = api.MapGroup("/auth").WithTags("Auth").RequireRateLimiting(RateLimitPolicies.Auth);
        auth.MapIdentityApi<AppUser>();

        // Bearer access tokens are stateless; changing the security stamp invalidates all refresh tokens of the user.
        auth.MapPost("/logout", async (ClaimsPrincipal principal, UserManager<AppUser> users) =>
        {
            var user = await users.GetUserAsync(principal);
            if (user is not null)
                await users.UpdateSecurityStampAsync(user);
            return Results.NoContent();
        }).RequireAuthorization();

        api.MapGet("/users/me", async (ClaimsPrincipal principal, UserManager<AppUser> users) =>
        {
            var user = await users.GetUserAsync(principal);
            if (user is null)
                return Results.Unauthorized();
            var roles = await users.GetRolesAsync(user);
            return Results.Ok(new UserDto(user.Id, user.Email, roles.ToList()));
        }).RequireAuthorization().WithTags("Auth");
    }
}
