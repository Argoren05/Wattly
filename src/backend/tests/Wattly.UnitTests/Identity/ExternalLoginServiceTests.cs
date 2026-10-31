using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wattly.Application.Common;
using Wattly.Infrastructure.Identity;
using Wattly.Infrastructure.Identity.External;
using Wattly.Infrastructure.Persistence;
using Wattly.UnitTests.Support;

namespace Wattly.UnitTests.Identity;

/// <summary>Tests of account lookup, linking and creation in <see cref="ExternalLoginService"/>.</summary>
public sealed class ExternalLoginServiceTests : IDisposable
{
    /// <summary>Validator returning a preset identity for any token.</summary>
    private sealed class StubValidator(string provider) : IExternalTokenValidator
    {
        public ExternalIdentity Identity { get; set; } = new(provider, "sub-1", "jan@example.com", true, "Jan");

        public string Provider { get; } = provider;

        public Task<ExternalIdentity> ValidateAsync(string token, string? nonce, CancellationToken cancellationToken) => Task.FromResult(Identity);
    }

    private readonly ServiceProvider _services;
    private readonly StubValidator _google = new(ExternalProviders.Google);
    private readonly StubValidator _microsoft = new(ExternalProviders.Microsoft);

    public ExternalLoginServiceTests()
    {
        var name = Guid.NewGuid().ToString();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<WattlyDbContext>(o => o.UseInMemoryDatabase(name));
        services.AddIdentityCore<AppUser>(o => o.User.RequireUniqueEmail = true).AddEntityFrameworkStores<WattlyDbContext>();
        _services = services.BuildServiceProvider();
    }

    private UserManager<AppUser> Users => _services.GetRequiredService<UserManager<AppUser>>();

    private ExternalLoginService Service() =>
        new([_google, _microsoft], Users, new FixedClock(TestContext.DefaultNow));

    private static ExternalLoginRequest Request(string provider = "google") => new(provider, "provider-token", null);

    [Fact]
    public async Task First_sign_in_creates_account_with_confirmed_email_and_linked_login()
    {
        var user = await Service().SignInAsync(Request(), CancellationToken.None);

        Assert.Equal("jan@example.com", user.Email);
        Assert.True(user.EmailConfirmed);
        Assert.Equal(TestContext.DefaultNow, user.CreatedAt);
        Assert.Equal(user.Id, (await Users.FindByLoginAsync("google", "sub-1"))!.Id);
        Assert.False(await Users.HasPasswordAsync(user));
    }

    [Fact]
    public async Task Next_sign_in_returns_the_same_account()
    {
        var first = await Service().SignInAsync(Request(), CancellationToken.None);
        var second = await Service().SignInAsync(Request(" Google "), CancellationToken.None);

        Assert.Equal(first.Id, second.Id);
    }

    [Fact]
    public async Task Verified_email_links_to_existing_password_account()
    {
        var existing = new AppUser { UserName = "jan@example.com", Email = "jan@example.com" };
        Assert.True((await Users.CreateAsync(existing, "Password123!")).Succeeded);

        var user = await Service().SignInAsync(Request(), CancellationToken.None);

        Assert.Equal(existing.Id, user.Id);
        Assert.True(user.EmailConfirmed);
        Assert.Single(await Users.GetLoginsAsync(user));
    }

    [Fact]
    public async Task Unverified_email_never_takes_over_existing_account()
    {
        Assert.True((await Users.CreateAsync(new AppUser { UserName = "jan@example.com", Email = "jan@example.com" }, "Password123!")).Succeeded);
        _microsoft.Identity = _microsoft.Identity with { EmailVerified = false };

        var error = await Assert.ThrowsAsync<ConflictException>(() => Service().SignInAsync(Request("microsoft"), CancellationToken.None));

        Assert.Equal("external.email_in_use", error.Code);
        Assert.Null(await Users.FindByLoginAsync("microsoft", "sub-1"));
    }

    [Fact]
    public async Task Unverified_email_creates_new_unconfirmed_account_when_address_is_free()
    {
        _microsoft.Identity = _microsoft.Identity with { EmailVerified = false };

        var user = await Service().SignInAsync(Request("microsoft"), CancellationToken.None);

        Assert.False(user.EmailConfirmed);
    }

    [Fact]
    public async Task Missing_email_and_unknown_provider_are_rejected()
    {
        _google.Identity = _google.Identity with { Email = null, EmailVerified = false };
        var missing = await Assert.ThrowsAsync<AuthenticationFailedException>(() => Service().SignInAsync(Request(), CancellationToken.None));
        Assert.Equal("external.email_missing", missing.Code);

        var unknown = await Assert.ThrowsAsync<ValidationFailedException>(() => Service().SignInAsync(Request("myspace"), CancellationToken.None));
        Assert.Contains("Provider", unknown.Errors.Keys);
        await Assert.ThrowsAsync<ValidationFailedException>(() => Service().SignInAsync(new ExternalLoginRequest("google", "", null), CancellationToken.None));
    }

    [Fact]
    public async Task Locked_out_account_cannot_sign_in()
    {
        var user = await Service().SignInAsync(Request(), CancellationToken.None);
        await Users.SetLockoutEnabledAsync(user, true);
        await Users.SetLockoutEndDateAsync(user, DateTimeOffset.UtcNow.AddHours(1));

        await Assert.ThrowsAsync<ForbiddenException>(() => Service().SignInAsync(Request(), CancellationToken.None));
    }

    /// <inheritdoc />
    public void Dispose() => _services.Dispose();
}
