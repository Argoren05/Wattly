namespace Wattly.Application.Common;

/// <summary>Identity of the user making the current request.</summary>
public interface ICurrentUser
{
    /// <summary>Identifier of the authenticated user; throws when the request is anonymous.</summary>
    Guid UserId { get; }

    /// <summary>True for authenticated requests.</summary>
    bool IsAuthenticated { get; }

    /// <summary>True when the user has the Admin role.</summary>
    bool IsAdmin { get; }
}

/// <summary>Role names.</summary>
public static class Roles
{
    /// <summary>Catalog administrator.</summary>
    public const string Admin = "Admin";
}
