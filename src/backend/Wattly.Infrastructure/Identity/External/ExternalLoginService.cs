using Microsoft.AspNetCore.Identity;
using Wattly.Application.Common;

namespace Wattly.Infrastructure.Identity.External;

/// <summary>Request of <c>POST /auth/external</c>.</summary>
/// <param name="Provider">google, microsoft, apple or facebook.</param>
/// <param name="Token">ID token (Google, Microsoft, Apple) or access token (Facebook) obtained by the app.</param>
/// <param name="Nonce">Nonce the app sent to the provider, if any.</param>
public sealed record ExternalLoginRequest(string Provider, string Token, string? Nonce);

/// <summary>
/// Signs users in with an external provider: verifies the provider token, then finds the linked account,
/// links an existing account with the same <b>verified</b> e-mail address, or creates a new account (DEC-024).
/// </summary>
/// <param name="validators">Validators of the configured providers.</param>
/// <param name="users">Identity user manager.</param>
/// <param name="clock">Time source.</param>
public sealed class ExternalLoginService(IEnumerable<IExternalTokenValidator> validators, UserManager<AppUser> users, TimeProvider clock)
{
    /// <summary>Verifies the token and returns the Wattly account to sign in.</summary>
    /// <param name="request">Provider and token.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <exception cref="ValidationFailedException">Unknown or disabled provider.</exception>
    /// <exception cref="AuthenticationFailedException">Invalid token or no e-mail address shared.</exception>
    /// <exception cref="ConflictException">An account with the same unverified e-mail address already exists.</exception>
    /// <exception cref="ForbiddenException">The account is locked out.</exception>
    public async Task<AppUser> SignInAsync(ExternalLoginRequest request, CancellationToken cancellationToken)
    {
        var providerName = request.Provider?.Trim().ToLowerInvariant() ?? string.Empty;
        var validator = validators.FirstOrDefault(v => v.Provider == providerName);
        new Validation()
            .Require(validator is not null, nameof(request.Provider), "Ten sposób logowania nie jest dostępny.")
            .RequireText(request.Token, nameof(request.Token), 16_384)
            .ThrowIfInvalid();

        var identity = await validator!.ValidateAsync(request.Token, request.Nonce, cancellationToken);

        var user = await users.FindByLoginAsync(identity.Provider, identity.Subject)
                   ?? await LinkOrCreateAsync(identity);

        if (await users.IsLockedOutAsync(user))
            throw new ForbiddenException("Konto jest tymczasowo zablokowane. Spróbuj później.");
        return user;
    }

    /// <summary>Links the login to an account with the same verified e-mail address, or creates a new account.</summary>
    private async Task<AppUser> LinkOrCreateAsync(ExternalIdentity identity)
    {
        if (identity.Email is null)
            throw new AuthenticationFailedException("external.email_missing",
                "Konto nie udostępnia adresu e-mail, a jest on wymagany. Zezwól na udostępnienie adresu e-mail i spróbuj ponownie.");

        var existing = await users.FindByEmailAsync(identity.Email);
        if (existing is not null)
        {
            // Linking by an address the provider has not verified would let anyone take over an account.
            if (!identity.EmailVerified)
                throw new ConflictException("external.email_in_use",
                    "Konto z tym adresem e-mail już istnieje. Zaloguj się e-mailem i hasłem.");

            Ensure(await users.AddLoginAsync(existing, new UserLoginInfo(identity.Provider, identity.Subject, identity.Provider)));
            if (!existing.EmailConfirmed)
            {
                existing.EmailConfirmed = true;
                Ensure(await users.UpdateAsync(existing));
            }

            return existing;
        }

        var user = new AppUser
        {
            UserName = identity.Email,
            Email = identity.Email,
            EmailConfirmed = identity.EmailVerified,
            CreatedAt = clock.GetUtcNow(),
        };
        Ensure(await users.CreateAsync(user));
        Ensure(await users.AddLoginAsync(user, new UserLoginInfo(identity.Provider, identity.Subject, identity.Provider)));
        return user;
    }

    /// <summary>Throws when an Identity operation failed (unexpected – inputs are already validated).</summary>
    private static void Ensure(IdentityResult result)
    {
        if (!result.Succeeded)
            throw new InvalidOperationException("Identity operation failed: " + string.Join("; ", result.Errors.Select(e => e.Code)));
    }
}
