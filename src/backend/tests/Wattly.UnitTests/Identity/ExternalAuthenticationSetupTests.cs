using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Wattly.Infrastructure.Identity.External;

namespace Wattly.UnitTests.Identity;

/// <summary>Tests that only configured providers are enabled.</summary>
public class ExternalAuthenticationSetupTests
{
    private static string[] Providers(Dictionary<string, string?> settings)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        using var provider = new ServiceCollection().AddLogging().AddExternalAuthentication(configuration).BuildServiceProvider();
        return provider.GetServices<IExternalTokenValidator>().Select(v => v.Provider).Order().ToArray();
    }

    [Fact]
    public void Nothing_is_enabled_without_configuration()
    {
        Assert.Empty(Providers([]));
        Assert.Empty(Providers(new() { ["Auth:External:Google:ClientIds:0"] = " ", ["Auth:External:Facebook:AppId"] = "only-id" }));
    }

    [Fact]
    public void Configured_providers_are_enabled()
    {
        var enabled = Providers(new()
        {
            ["Auth:External:Google:ClientIds:0"] = "google-web",
            ["Auth:External:Microsoft:ClientIds:0"] = "ms-app",
            ["Auth:External:Apple:ClientIds:0"] = "app.wattly.mobile",
            ["Auth:External:Facebook:AppId"] = "fb",
            ["Auth:External:Facebook:AppSecret"] = "secret",
        });

        Assert.Equal(["apple", "facebook", "google", "microsoft"], enabled);
    }
}
