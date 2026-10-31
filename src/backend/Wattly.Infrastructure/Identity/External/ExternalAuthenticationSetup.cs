using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace Wattly.Infrastructure.Identity.External;

/// <summary>Registers validators of the external providers that are configured.</summary>
public static class ExternalAuthenticationSetup
{
    /// <summary>OpenID configuration documents of the providers.</summary>
    private static readonly Dictionary<string, string> MetadataAddresses = new()
    {
        [ExternalProviders.Google] = "https://accounts.google.com/.well-known/openid-configuration",
        [ExternalProviders.Microsoft] = "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
        [ExternalProviders.Apple] = "https://appleid.apple.com/.well-known/openid-configuration",
    };

    /// <summary>Adds the external login service and validators for every enabled provider.</summary>
    /// <param name="services">Service collection.</param>
    /// <param name="configuration">Application configuration.</param>
    public static IServiceCollection AddExternalAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection(ExternalAuthOptions.SectionName);
        services.Configure<ExternalAuthOptions>(section);
        var options = section.Get<ExternalAuthOptions>() ?? new ExternalAuthOptions();

        AddOidc(services, ExternalProviders.Google, options.Google, OidcTokenValidator.IsGoogleIssuer);
        AddOidc(services, ExternalProviders.Microsoft, options.Microsoft, OidcTokenValidator.IsMicrosoftIssuer);
        AddOidc(services, ExternalProviders.Apple, options.Apple, OidcTokenValidator.IsAppleIssuer);

        if (options.Facebook.IsEnabled)
        {
            services.AddHttpClient(FacebookTokenValidator.HttpClientName, c =>
            {
                c.BaseAddress = new Uri("https://graph.facebook.com/");
                c.Timeout = TimeSpan.FromSeconds(10);
            });
            services.AddSingleton<IExternalTokenValidator>(sp => new FacebookTokenValidator(
                sp.GetRequiredService<IHttpClientFactory>().CreateClient(FacebookTokenValidator.HttpClientName),
                sp.GetRequiredService<IOptions<ExternalAuthOptions>>()));
        }

        services.AddScoped<ExternalLoginService>();
        return services;
    }

    /// <summary>Registers an OpenID Connect validator with cached, automatically refreshed signing keys.</summary>
    private static void AddOidc(IServiceCollection services, string provider, OidcProviderOptions options, Func<string, Microsoft.IdentityModel.JsonWebTokens.JsonWebToken, bool> issuerRule)
    {
        if (!options.IsEnabled)
            return;

        var audiences = options.ClientIds.Where(id => !string.IsNullOrWhiteSpace(id)).Select(id => id.Trim()).ToArray();
        services.AddSingleton<IExternalTokenValidator>(_ => new OidcTokenValidator(
            provider,
            new ConfigurationManager<OpenIdConnectConfiguration>(
                MetadataAddresses[provider], new OpenIdConnectConfigurationRetriever(), new HttpDocumentRetriever { RequireHttps = true }),
            audiences,
            issuerRule));
    }
}
