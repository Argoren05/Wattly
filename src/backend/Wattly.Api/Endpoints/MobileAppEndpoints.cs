using Wattly.Application.MobileApp;

namespace Wattly.Api.Endpoints;

/// <summary>Endpoints used by the mobile app itself (no authentication – called before sign-in).</summary>
public static class MobileAppEndpoints
{
    /// <summary>Maps <c>GET /app/release</c>.</summary>
    /// <param name="api">The <c>/api/v1</c> route group.</param>
    public static void MapMobileAppEndpoints(this RouteGroupBuilder api)
    {
        // Example: GET /api/v1/app/release?platform=android&version=1.0.0
        api.MapGet("/app/release", (string? platform, string? version, MobileReleaseService s) => s.GetStatus(platform, version))
            .WithTags("Mobile app")
            .AllowAnonymous();
    }
}
