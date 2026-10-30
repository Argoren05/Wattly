namespace Wattly.Application.Common;

public interface ICurrentUser
{
    /// <summary>Identifier of the authenticated user; throws when the request is anonymous.</summary>
    Guid UserId { get; }

    bool IsAuthenticated { get; }

    bool IsAdmin { get; }
}

public static class Roles
{
    public const string Admin = "Admin";
}
