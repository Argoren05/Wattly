namespace Wattly.Infrastructure.Identity.External;

/// <summary>
/// Configuration of sign-in with external identity providers (section <c>Auth:External</c>).
/// A provider is enabled only when its client identifiers are configured; secrets belong in environment
/// variables or a secret store, never in the repository.
/// </summary>
public sealed class ExternalAuthOptions
{
    /// <summary>Configuration section name.</summary>
    public const string SectionName = "Auth:External";

    /// <summary>Google: accepted audiences of ID tokens (the web client ID used by the mobile Google Sign-In SDK).</summary>
    public OidcProviderOptions Google { get; set; } = new();

    /// <summary>Microsoft (Entra ID, personal and work accounts): application (client) IDs.</summary>
    public OidcProviderOptions Microsoft { get; set; } = new();

    /// <summary>Apple: accepted audiences (the iOS bundle identifier, e.g. app.wattly.mobile).</summary>
    public OidcProviderOptions Apple { get; set; } = new();

    /// <summary>Facebook (Meta) application credentials.</summary>
    public FacebookProviderOptions Facebook { get; set; } = new();
}

/// <summary>Settings of an OpenID Connect provider.</summary>
public sealed class OidcProviderOptions
{
    /// <summary>Client identifiers accepted as the <c>aud</c> claim; the provider is disabled when empty.</summary>
    public List<string> ClientIds { get; set; } = [];

    /// <summary>True when at least one non-empty client ID is configured.</summary>
    public bool IsEnabled => ClientIds.Any(id => !string.IsNullOrWhiteSpace(id));
}

/// <summary>Settings of Facebook Login.</summary>
public sealed class FacebookProviderOptions
{
    /// <summary>Meta application ID.</summary>
    public string? AppId { get; set; }

    /// <summary>Meta application secret (needed to verify user access tokens); keep it out of the repository.</summary>
    public string? AppSecret { get; set; }

    /// <summary>True when both the app ID and the secret are configured.</summary>
    public bool IsEnabled => !string.IsNullOrWhiteSpace(AppId) && !string.IsNullOrWhiteSpace(AppSecret);
}
