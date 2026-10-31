using System.Security.Claims;
using Wattly.Application.Common;

namespace Wattly.Api.Infrastructure;

/// <summary><see cref="ICurrentUser"/> based on the claims of the current HTTP request.</summary>
/// <param name="accessor">HTTP context accessor.</param>
public sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    /// <summary>Principal of the current request.</summary>
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    /// <inheritdoc />
    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    /// <inheritdoc />
    public Guid UserId =>
        Guid.TryParse(Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) && IsAuthenticated
            ? id
            : throw new UnauthorizedAccessException("Request is not authenticated.");

    /// <inheritdoc />
    public bool IsAdmin => Principal?.IsInRole(Roles.Admin) == true;
}
