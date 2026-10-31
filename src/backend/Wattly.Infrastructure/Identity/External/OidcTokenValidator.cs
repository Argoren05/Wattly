using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Wattly.Application.Common;

namespace Wattly.Infrastructure.Identity.External;

/// <summary>
/// Validates OpenID Connect ID tokens (Google, Microsoft, Apple): signature with the provider's published keys,
/// issuer, audience (our client IDs), lifetime and – when the app sent one – the nonce.
/// </summary>
/// <param name="provider">Provider name.</param>
/// <param name="configuration">Source of the provider's OpenID configuration and signing keys (cached and refreshed).</param>
/// <param name="audiences">Accepted <c>aud</c> values.</param>
/// <param name="isValidIssuer">Issuer rule of the provider; receives the issuer and the token.</param>
public sealed partial class OidcTokenValidator(
    string provider,
    IConfigurationManager<OpenIdConnectConfiguration> configuration,
    IReadOnlyCollection<string> audiences,
    Func<string, JsonWebToken, bool> isValidIssuer) : IExternalTokenValidator
{
    /// <summary>Allowed clock difference between our server and the provider.</summary>
    private static readonly TimeSpan ClockSkew = TimeSpan.FromMinutes(2);

    private readonly JsonWebTokenHandler _handler = new();

    /// <inheritdoc />
    public string Provider { get; } = provider;

    /// <inheritdoc />
    public async Task<ExternalIdentity> ValidateAsync(string token, string? nonce, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw Invalid();

        var result = await ValidateWithCurrentKeysAsync(token, cancellationToken);
        if (!result.IsValid && result.Exception is SecurityTokenSignatureKeyNotFoundException)
        {
            // The provider rotated its keys – reload them once.
            configuration.RequestRefresh();
            result = await ValidateWithCurrentKeysAsync(token, cancellationToken);
        }

        if (!result.IsValid || result.SecurityToken is not JsonWebToken jwt)
            throw Invalid();

        if (!NonceMatches(jwt, nonce))
            throw Invalid();

        var subject = jwt.Subject;
        if (string.IsNullOrWhiteSpace(subject))
            throw Invalid();

        var email = Claim(jwt, "email") ?? (Provider == ExternalProviders.Microsoft ? EmailLike(Claim(jwt, "preferred_username")) : null);
        var verified = string.Equals(Claim(jwt, "email_verified"), "true", StringComparison.OrdinalIgnoreCase);

        return new ExternalIdentity(Provider, subject, email?.Trim().ToLowerInvariant(), verified && email is not null, Claim(jwt, "name"));
    }

    /// <summary>Validates the token with the currently cached provider configuration.</summary>
    private async Task<TokenValidationResult> ValidateWithCurrentKeysAsync(string token, CancellationToken cancellationToken)
    {
        var oidc = await configuration.GetConfigurationAsync(cancellationToken);
        return await _handler.ValidateTokenAsync(token, new TokenValidationParameters
        {
            IssuerSigningKeys = oidc.SigningKeys,
            ValidAudiences = audiences,
            ValidateIssuer = true,
            IssuerValidator = (issuer, securityToken, _) =>
                securityToken is JsonWebToken jwt && isValidIssuer(issuer, jwt)
                    ? issuer
                    : throw new SecurityTokenInvalidIssuerException($"Issuer '{issuer}' is not accepted."),
            ValidateLifetime = true,
            RequireExpirationTime = true,
            ClockSkew = ClockSkew,
        });
    }

    /// <summary>
    /// When the app sent a nonce, the token must carry it – either raw or SHA-256 hashed (Apple hashes it on the device).
    /// </summary>
    private static bool NonceMatches(JsonWebToken jwt, string? nonce)
    {
        if (string.IsNullOrEmpty(nonce))
            return true;

        var claim = Claim(jwt, "nonce");
        if (claim is null)
            return false;

        var hashed = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(nonce)));
        return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(claim), Encoding.UTF8.GetBytes(nonce))
               || CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(claim), Encoding.UTF8.GetBytes(hashed));
    }

    /// <summary>Value of a claim, or null.</summary>
    private static string? Claim(JsonWebToken jwt, string type) =>
        jwt.TryGetPayloadValue<object>(type, out var value) ? Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture) : null;

    /// <summary>Returns the value only when it looks like an e-mail address.</summary>
    private static string? EmailLike(string? value) => value is not null && EmailPattern().IsMatch(value) ? value : null;

    /// <summary>Error returned for every rejected token (no details that would help an attacker).</summary>
    private AuthenticationFailedException Invalid() =>
        new("external.invalid_token", "Nie udało się potwierdzić logowania. Spróbuj ponownie.");

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailPattern();

    /// <summary>Issuer rule of Google ID tokens.</summary>
    /// <param name="issuer">Token issuer.</param>
    /// <param name="token">Token.</param>
    public static bool IsGoogleIssuer(string issuer, JsonWebToken token) => issuer is "https://accounts.google.com" or "accounts.google.com";

    /// <summary>Issuer rule of Apple ID tokens.</summary>
    /// <param name="issuer">Token issuer.</param>
    /// <param name="token">Token.</param>
    public static bool IsAppleIssuer(string issuer, JsonWebToken token) => issuer == "https://appleid.apple.com";

    /// <summary>
    /// Issuer rule of Microsoft identity platform v2 tokens from the multi-tenant "common" endpoint:
    /// the issuer must be the v2 issuer of the tenant named in the token's <c>tid</c> claim.
    /// </summary>
    /// <param name="issuer">Token issuer.</param>
    /// <param name="token">Token.</param>
    public static bool IsMicrosoftIssuer(string issuer, JsonWebToken token) =>
        token.TryGetPayloadValue<string>("tid", out var tenant)
        && MicrosoftIssuer().IsMatch(issuer)
        && issuer == $"https://login.microsoftonline.com/{tenant}/v2.0";

    [GeneratedRegex("^https://login\\.microsoftonline\\.com/[0-9a-f-]{36}/v2\\.0$")]
    private static partial Regex MicrosoftIssuer();
}
