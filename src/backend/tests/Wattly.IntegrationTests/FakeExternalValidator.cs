using Wattly.Application.Common;
using Wattly.Infrastructure.Identity.External;

namespace Wattly.IntegrationTests;

/// <summary>
/// Test provider "test": accepts tokens in the form <c>subject|email|verified</c> and rejects everything else,
/// so the external login endpoint can be exercised end to end without real Google/Microsoft accounts.
/// </summary>
public sealed class FakeExternalValidator : IExternalTokenValidator
{
    /// <summary>Provider name used by tests.</summary>
    public const string Name = "test";

    /// <inheritdoc />
    public string Provider => Name;

    /// <inheritdoc />
    public Task<ExternalIdentity> ValidateAsync(string token, string? nonce, CancellationToken cancellationToken)
    {
        var parts = token.Split('|');
        if (parts.Length != 3)
            throw new AuthenticationFailedException("external.invalid_token", "Nie udało się potwierdzić logowania. Spróbuj ponownie.");
        return Task.FromResult(new ExternalIdentity(Name, parts[0], parts[1], parts[2] == "true", null));
    }
}
