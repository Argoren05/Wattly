using System.Security.Claims;
using Wattly.Application.Common;

namespace Wattly.Api.Infrastructure;

public sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public Guid UserId =>
        Guid.TryParse(Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) && IsAuthenticated
            ? id
            : throw new UnauthorizedAccessException("Request is not authenticated.");

    public bool IsAdmin => Principal?.IsInRole(Roles.Admin) == true;
}
