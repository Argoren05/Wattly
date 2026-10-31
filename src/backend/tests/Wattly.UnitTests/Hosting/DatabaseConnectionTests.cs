using Microsoft.Extensions.Configuration;
using Npgsql;
using Wattly.Infrastructure.Hosting;

namespace Wattly.UnitTests.Hosting;

/// <summary>Tests of <see cref="DatabaseConnection"/>.</summary>
public class DatabaseConnectionTests
{
    private static IConfiguration Config(Dictionary<string, string?> values) => new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    [Fact]
    public void Railway_database_url_is_converted_with_low_resource_pool_defaults()
    {
        var value = DatabaseConnection.Resolve(Config(new() { ["DATABASE_URL"] = "postgresql://postgres:p%40ss@postgres.railway.internal:5432/railway" }));

        var builder = new NpgsqlConnectionStringBuilder(value);
        Assert.Equal("postgres.railway.internal", builder.Host);
        Assert.Equal(5432, builder.Port);
        Assert.Equal("railway", builder.Database);
        Assert.Equal("postgres", builder.Username);
        Assert.Equal("p@ss", builder.Password);
        Assert.Equal(DatabaseConnection.DefaultIdleLifetimeSeconds, builder.ConnectionIdleLifetime);
        Assert.Equal(DatabaseConnection.DefaultMaxPoolSize, builder.MaxPoolSize);
    }

    [Fact]
    public void Explicit_connection_string_wins_and_keeps_its_own_pool_settings()
    {
        var value = DatabaseConnection.Resolve(Config(new()
        {
            ["ConnectionStrings:Wattly"] = "Host=db;Database=wattly;Username=u;Password=p;Maximum Pool Size=3",
            ["DATABASE_URL"] = "postgresql://x:y@other:5432/other",
        }));

        var builder = new NpgsqlConnectionStringBuilder(value);
        Assert.Equal("db", builder.Host);
        Assert.Equal(3, builder.MaxPoolSize);
        Assert.Equal(DatabaseConnection.DefaultIdleLifetimeSeconds, builder.ConnectionIdleLifetime);
    }

    [Fact]
    public void Url_query_and_default_port_are_supported()
    {
        var builder = DatabaseConnection.FromUrl("postgres://user@host/db?sslmode=require");

        Assert.Equal(5432, builder.Port);
        Assert.Equal(SslMode.Require, builder.SslMode);
        Assert.Null(builder.Password);
    }

    [Fact]
    public void Neon_url_with_tls_and_channel_binding_is_supported()
    {
        var builder = DatabaseConnection.FromUrl(
            "postgresql://neondb_owner:secret@ep-cool-name-a1b2c3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require");

        Assert.Equal("ep-cool-name-a1b2c3.eu-central-1.aws.neon.tech", builder.Host);
        Assert.Equal(5432, builder.Port);
        Assert.Equal("neondb", builder.Database);
        Assert.Equal("neondb_owner", builder.Username);
        Assert.Equal(SslMode.Require, builder.SslMode);
        Assert.Equal(ChannelBinding.Require, builder.ChannelBinding);
    }

    [Theory]
    [InlineData("verify-full", SslMode.VerifyFull)]
    [InlineData("disable", SslMode.Disable)]
    public void Dashed_ssl_modes_are_mapped(string value, SslMode expected)
    {
        Assert.Equal(expected, DatabaseConnection.FromUrl($"postgres://u:p@h/db?sslmode={value}").SslMode);
    }

    [Fact]
    public void Unknown_and_malformed_query_parameters_are_ignored()
    {
        var builder = DatabaseConnection.FromUrl("postgres://u:p@h/db?options=x&flag&sslmode=bogus");

        Assert.Equal("db", builder.Database);
        Assert.Equal(new NpgsqlConnectionStringBuilder().SslMode, builder.SslMode);
    }

    [Theory]
    [InlineData("mysql://u:p@h/db")]
    [InlineData("not a url")]
    public void Non_postgres_urls_are_rejected(string url)
    {
        Assert.Throws<InvalidOperationException>(() => DatabaseConnection.FromUrl(url));
    }

    [Fact]
    public void Missing_configuration_returns_null()
    {
        Assert.Null(DatabaseConnection.Resolve(Config([])));
        Assert.Null(DatabaseConnection.Resolve(Config(new() { ["ConnectionStrings:Wattly"] = " ", ["DATABASE_URL"] = "" })));
    }
}
