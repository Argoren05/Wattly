namespace Wattly.Infrastructure.Identity.External;

/// <summary>Names of supported external providers (also used as Identity login provider keys).</summary>
public static class ExternalProviders
{
    /// <summary>Google account.</summary>
    public const string Google = "google";

    /// <summary>Microsoft account (personal, work or school).</summary>
    public const string Microsoft = "microsoft";

    /// <summary>Apple ID.</summary>
    public const string Apple = "apple";

    /// <summary>Facebook account.</summary>
    public const string Facebook = "facebook";
}

/// <summary>Identity confirmed by an external provider.</summary>
/// <param name="Provider">Provider name (see <see cref="ExternalProviders"/>).</param>
/// <param name="Subject">Stable user identifier at the provider.</param>
/// <param name="Email">E-mail address, if shared by the user.</param>
/// <param name="EmailVerified">True only when the provider guarantees that the address belongs to the user.</param>
/// <param name="DisplayName">Name shown by the provider (optional).</param>
public sealed record ExternalIdentity(string Provider, string Subject, string? Email, bool EmailVerified, string? DisplayName);

/// <summary>Verifies a token issued by one external provider.</summary>
public interface IExternalTokenValidator
{
    /// <summary>Provider handled by this validator.</summary>
    string Provider { get; }

    /// <summary>Validates the token and returns the confirmed identity.</summary>
    /// <param name="token">ID token (OpenID Connect providers) or access token (Facebook).</param>
    /// <param name="nonce">Nonce sent by the app with the sign-in request, if any.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <exception cref="Wattly.Application.Common.AuthenticationFailedException">The token is invalid, expired or issued for another application.</exception>
    Task<ExternalIdentity> ValidateAsync(string token, string? nonce, CancellationToken cancellationToken);
}
