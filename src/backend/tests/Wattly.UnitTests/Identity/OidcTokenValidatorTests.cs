using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Wattly.Application.Common;
using Wattly.Infrastructure.Identity.External;

namespace Wattly.UnitTests.Identity;

/// <summary>Tests of <see cref="OidcTokenValidator"/> with tokens signed by a test RSA key.</summary>
public class OidcTokenValidatorTests
{
    private const string Audience = "wattly-client";
    private static readonly RsaSecurityKey ProviderKey = new(RSA.Create(2048)) { KeyId = "provider-key" };
    private static readonly RsaSecurityKey AttackerKey = new(RSA.Create(2048)) { KeyId = "provider-key" };

    /// <summary>Configuration manager returning the provider's published keys.</summary>
    private static IConfigurationManager<OpenIdConnectConfiguration> Keys()
    {
        var config = new OpenIdConnectConfiguration();
        config.SigningKeys.Add(ProviderKey);
        return new StaticConfigurationManager<OpenIdConnectConfiguration>(config);
    }

    private static OidcTokenValidator Google() =>
        new(ExternalProviders.Google, Keys(), [Audience], OidcTokenValidator.IsGoogleIssuer);

    private static OidcTokenValidator Microsoft() =>
        new(ExternalProviders.Microsoft, Keys(), [Audience], OidcTokenValidator.IsMicrosoftIssuer);

    /// <summary>Creates a signed ID token.</summary>
    private static string Token(
        string issuer = "https://accounts.google.com",
        string audience = Audience,
        IDictionary<string, object>? claims = null,
        SecurityKey? key = null,
        DateTime? expires = null)
    {
        var payload = new Dictionary<string, object> { ["sub"] = "user-123", ["email"] = "Jan@Example.com", ["email_verified"] = true, ["name"] = "Jan" };
        foreach (var (k, v) in claims ?? new Dictionary<string, object>())
            payload[k] = v;

        var now = DateTime.UtcNow;
        return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = issuer,
            Audience = audience,
            Claims = payload,
            IssuedAt = (expires ?? now.AddMinutes(10)).AddMinutes(-20),
            NotBefore = (expires ?? now.AddMinutes(10)).AddMinutes(-20),
            Expires = expires ?? now.AddMinutes(10),
            SigningCredentials = new SigningCredentials(key ?? ProviderKey, SecurityAlgorithms.RsaSha256),
        });
    }

    [Fact]
    public async Task Valid_google_token_returns_normalised_identity()
    {
        var identity = await Google().ValidateAsync(Token(), null, CancellationToken.None);

        Assert.Equal(new ExternalIdentity(ExternalProviders.Google, "user-123", "jan@example.com", true, "Jan"), identity);
    }

    [Fact]
    public async Task Unverified_email_is_reported_as_unverified()
    {
        var identity = await Google().ValidateAsync(Token(claims: new Dictionary<string, object> { ["email_verified"] = false }), null, CancellationToken.None);

        Assert.False(identity.EmailVerified);
    }

    [Theory]
    [InlineData("other-app", "https://accounts.google.com", false, false)] // token issued for another application
    [InlineData(Audience, "https://evil.example", false, false)]          // wrong issuer
    [InlineData(Audience, "https://accounts.google.com", true, false)]    // forged signature
    [InlineData(Audience, "https://accounts.google.com", false, true)]    // expired
    public async Task Invalid_tokens_are_rejected(string audience, string issuer, bool forged, bool expired)
    {
        var token = Token(issuer, audience, key: forged ? AttackerKey : null, expires: expired ? DateTime.UtcNow.AddMinutes(-10) : null);

        var error = await Assert.ThrowsAsync<AuthenticationFailedException>(() => Google().ValidateAsync(token, null, CancellationToken.None));
        Assert.Equal("external.invalid_token", error.Code);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-a-jwt")]
    public async Task Malformed_tokens_are_rejected(string token)
    {
        await Assert.ThrowsAsync<AuthenticationFailedException>(() => Google().ValidateAsync(token, null, CancellationToken.None));
    }

    [Fact]
    public async Task Nonce_must_match_raw_or_sha256_hashed()
    {
        var hashed = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes("raw-nonce")));

        await Google().ValidateAsync(Token(claims: new Dictionary<string, object> { ["nonce"] = "raw-nonce" }), "raw-nonce", CancellationToken.None);
        await Google().ValidateAsync(Token(claims: new Dictionary<string, object> { ["nonce"] = hashed }), "raw-nonce", CancellationToken.None);
        await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            Google().ValidateAsync(Token(claims: new Dictionary<string, object> { ["nonce"] = "other" }), "raw-nonce", CancellationToken.None));
        await Assert.ThrowsAsync<AuthenticationFailedException>(() => Google().ValidateAsync(Token(), "raw-nonce", CancellationToken.None));
    }

    [Fact]
    public async Task Microsoft_issuer_must_match_token_tenant_and_email_is_never_verified()
    {
        const string tenant = "9188040d-6c67-4c5b-b112-36a304b66dad";

        var token = Token($"https://login.microsoftonline.com/{tenant}/v2.0", claims: new Dictionary<string, object> { ["tid"] = tenant, ["preferred_username"] = "jan@outlook.com", ["email_verified"] = "x" });
        var identity = await Microsoft().ValidateAsync(token, null, CancellationToken.None);
        Assert.Equal(ExternalProviders.Microsoft, identity.Provider);
        Assert.False(identity.EmailVerified);

        var otherTenant = Token("https://login.microsoftonline.com/00000000-0000-0000-0000-000000000001/v2.0", claims: new Dictionary<string, object> { ["tid"] = tenant });
        await Assert.ThrowsAsync<AuthenticationFailedException>(() => Microsoft().ValidateAsync(otherTenant, null, CancellationToken.None));
    }

    [Fact]
    public void Issuer_rules_of_providers()
    {
        var token = new JsonWebToken(Token());

        Assert.True(OidcTokenValidator.IsGoogleIssuer("accounts.google.com", token));
        Assert.True(OidcTokenValidator.IsAppleIssuer("https://appleid.apple.com", token));
        Assert.False(OidcTokenValidator.IsAppleIssuer("https://accounts.google.com", token));
        Assert.False(OidcTokenValidator.IsMicrosoftIssuer("https://login.microsoftonline.com/common/v2.0", token));
    }
}
