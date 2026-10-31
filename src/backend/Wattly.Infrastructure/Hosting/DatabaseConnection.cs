using Microsoft.Extensions.Configuration;
using Npgsql;

namespace Wattly.Infrastructure.Hosting;

/// <summary>
/// Builds the PostgreSQL connection string. Supports the explicit <c>ConnectionStrings:Wattly</c> setting and the
/// <c>DATABASE_URL</c> variable in URL form (<c>postgresql://user:pass@host:port/db?sslmode=require</c>) as given by
/// Neon and similar services. On Cloud Run the URL comes from Secret Manager (DEC-027).
/// </summary>
public static class DatabaseConnection
{
    /// <summary>
    /// Seconds after which an idle pooled connection is closed. Short on purpose: an open connection is network
    /// traffic that keeps a scale-to-zero host (Cloud Run) and a scale-to-zero database (Neon) awake and billed
    /// (DEC-026, DEC-027).
    /// </summary>
    public const int DefaultIdleLifetimeSeconds = 60;

    /// <summary>Upper bound of pooled connections; a few users never need more and each costs database memory.</summary>
    public const int DefaultMaxPoolSize = 10;

    /// <summary>Returns the connection string, or null when neither setting is present.</summary>
    /// <param name="configuration">Application configuration.</param>
    public static string? Resolve(IConfiguration configuration)
    {
        var explicitValue = configuration.GetConnectionString("Wattly");
        var url = configuration["DATABASE_URL"];

        var builder = !string.IsNullOrWhiteSpace(explicitValue)
            ? new NpgsqlConnectionStringBuilder(explicitValue)
            : !string.IsNullOrWhiteSpace(url) ? FromUrl(url) : null;
        if (builder is null)
            return null;

        // Defaults only – values written explicitly in the connection string always win.
        if (!HasKey(explicitValue, "Connection Idle Lifetime", "ConnectionIdleLifetime"))
            builder.ConnectionIdleLifetime = DefaultIdleLifetimeSeconds;
        if (!HasKey(explicitValue, "Maximum Pool Size", "MaxPoolSize", "Max Pool Size"))
            builder.MaxPoolSize = DefaultMaxPoolSize;
        return builder.ConnectionString;
    }

    /// <summary>Converts a <c>postgres://</c> / <c>postgresql://</c> URL into Npgsql settings.</summary>
    /// <param name="url">Database URL.</param>
    /// <exception cref="InvalidOperationException">The URL is not a PostgreSQL URL.</exception>
    public static NpgsqlConnectionStringBuilder FromUrl(string url)
    {
        if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri) || uri.Scheme is not ("postgres" or "postgresql"))
            throw new InvalidOperationException("DATABASE_URL must be a postgres:// or postgresql:// URL.");

        var credentials = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort || uri.Port <= 0 ? 5432 : uri.Port,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            Username = Uri.UnescapeDataString(credentials[0]),
            Password = credentials.Length > 1 ? Uri.UnescapeDataString(credentials[1]) : null,
        };

        // Optional query parameters, e.g. Neon's ?sslmode=require&channel_binding=require. Unknown ones are ignored.
        foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = pair.Split('=', 2);
            if (parts.Length != 2)
                continue;
            // "verify-full" -> "VerifyFull", "require" -> "Require" (enum names without the dash).
            var value = Uri.UnescapeDataString(parts[1]).Replace("-", string.Empty);
            if (parts[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase)
                && Enum.TryParse<SslMode>(value, ignoreCase: true, out var mode))
                builder.SslMode = mode;
            else if (parts[0].Equals("channel_binding", StringComparison.OrdinalIgnoreCase)
                && Enum.TryParse<ChannelBinding>(value, ignoreCase: true, out var binding))
                builder.ChannelBinding = binding;
        }

        return builder;
    }

    /// <summary>Checks whether a connection string mentions any of the given keys.</summary>
    private static bool HasKey(string? connectionString, params string[] keys) =>
        !string.IsNullOrEmpty(connectionString) && keys.Any(k => connectionString.Contains(k, StringComparison.OrdinalIgnoreCase));
}
