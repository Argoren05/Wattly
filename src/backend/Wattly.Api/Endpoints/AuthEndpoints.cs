using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Wattly.Infrastructure.Identity;
using Wattly.Infrastructure.Identity.External;

namespace Wattly.Api.Endpoints;

/// <summary>Account endpoints: Identity API, logout and current user.</summary>
public static class AuthEndpoints
{
    /// <summary>Current user.</summary>
    /// <param name="Id">Identifier.</param>
    /// <param name="Email">E-mail.</param>
    /// <param name="Roles">Roles.</param>
    public sealed record UserDto(Guid Id, string? Email, IReadOnlyList<string> Roles);

    /// <summary>Maps <c>/auth/*</c> and <c>/users/me</c>.</summary>
    /// <param name="api">The <c>/api/v1</c> route group.</param>
    public static void MapAuthEndpoints(this RouteGroupBuilder api)
    {
        var auth = api.MapGroup("/auth").WithTags("Auth").RequireRateLimiting(RateLimitPolicies.Auth);
        auth.MapIdentityApi<AppUser>();

        // Sign-in with Google, Microsoft, Apple or Facebook: the app sends the provider's token and receives
        // the same Wattly bearer/refresh tokens as after password sign-in.
        auth.MapPost("/external", async (ExternalLoginRequest request, ExternalLoginService service, SignInManager<AppUser> signIn, CancellationToken ct) =>
        {
            var user = await service.SignInAsync(request, ct);
            signIn.AuthenticationScheme = IdentityConstants.BearerScheme;
            await signIn.SignInAsync(user, isPersistent: false);
            return Results.Empty;
        });

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
