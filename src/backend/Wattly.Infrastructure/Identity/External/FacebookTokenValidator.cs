using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using Wattly.Application.Common;

namespace Wattly.Infrastructure.Identity.External;

/// <summary>
/// Verifies Facebook user access tokens with the Graph API: <c>debug_token</c> confirms the token is valid and was
/// issued for our app (prevents tokens obtained by other apps from being replayed), then <c>/me</c> returns the profile.
/// </summary>
/// <param name="http">HTTP client for graph.facebook.com.</param>
/// <param name="options">External authentication options.</param>
public sealed class FacebookTokenValidator(HttpClient http, IOptions<ExternalAuthOptions> options) : IExternalTokenValidator
{
    /// <summary>Name of the HTTP client registered for this validator.</summary>
    public const string HttpClientName = "facebook-graph";

    /// <inheritdoc />
    public string Provider => ExternalProviders.Facebook;

    /// <inheritdoc />
    public async Task<ExternalIdentity> ValidateAsync(string token, string? nonce, CancellationToken cancellationToken)
    {
        var settings = options.Value.Facebook;
        if (string.IsNullOrWhiteSpace(token) || !settings.IsEnabled)
            throw Invalid();

        try
        {
            var appToken = $"{settings.AppId}|{settings.AppSecret}";
            var debug = await http.GetFromJsonAsync<DebugTokenResponse>(
                $"debug_token?input_token={Uri.EscapeDataString(token)}&access_token={Uri.EscapeDataString(appToken)}", cancellationToken);
            if (debug?.Data is not { IsValid: true } data || data.AppId != settings.AppId || string.IsNullOrEmpty(data.UserId))
                throw Invalid();

            var me = await http.GetFromJsonAsync<MeResponse>(
                $"me?fields=id,name,email&access_token={Uri.EscapeDataString(token)}", cancellationToken);
            if (me is null || me.Id != data.UserId)
                throw Invalid();

            // Facebook only returns e-mail addresses the user has confirmed.
            var email = string.IsNullOrWhiteSpace(me.Email) ? null : me.Email.Trim().ToLowerInvariant();
            return new ExternalIdentity(Provider, me.Id, email, email is not null, me.Name);
        }
        catch (Exception e) when (e is HttpRequestException or System.Text.Json.JsonException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
        {
            throw Invalid();
        }
    }

    /// <summary>Error returned for every rejected token.</summary>
    private static AuthenticationFailedException Invalid() =>
        new("external.invalid_token", "Nie udało się potwierdzić logowania. Spróbuj ponownie.");

    /// <summary>Response of <c>debug_token</c>.</summary>
    private sealed record DebugTokenResponse([property: JsonPropertyName("data")] DebugTokenData? Data);

    /// <summary>Token details returned by <c>debug_token</c>.</summary>
    private sealed record DebugTokenData(
        [property: JsonPropertyName("app_id")] string? AppId,
        [property: JsonPropertyName("is_valid")] bool IsValid,
        [property: JsonPropertyName("user_id")] string? UserId);

    /// <summary>Profile returned by <c>/me</c>.</summary>
    private sealed record MeResponse(
        [property: JsonPropertyName("id")] string Id,
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("email")] string? Email);
}
