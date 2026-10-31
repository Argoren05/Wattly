namespace Wattly.Api.Endpoints;

/// <summary>Authorization policy names.</summary>
public static class AuthorizationPolicies
{
    /// <summary>Requires the Admin role.</summary>
    public const string Admin = "Admin";
}

/// <summary>Rate limiting policy names.</summary>
public static class RateLimitPolicies
{
    /// <summary>Sign-in / registration limit per IP.</summary>
    public const string Auth = "auth";
}
