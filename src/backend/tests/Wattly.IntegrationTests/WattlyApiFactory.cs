using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Wattly.Infrastructure.Identity.External;
using Npgsql;

namespace Wattly.IntegrationTests;

/// <summary>
/// Runs the API against a real, temporary PostgreSQL database created from migrations.
/// Connection to the server: <c>WATTLY_TEST_POSTGRES</c> (default: local postgres/postgres).
/// </summary>
public sealed class WattlyApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly string _databaseName = $"wattly_test_{Guid.NewGuid():N}";
    private readonly string _serverConnection = Environment.GetEnvironmentVariable("WATTLY_TEST_POSTGRES")
                                                ?? "Host=localhost;Port=5432;Username=postgres;Password=postgres";
    private readonly string _storagePath = Path.Combine(Path.GetTempPath(), $"wattly_test_{Guid.NewGuid():N}");

    /// <summary>Connection string of the temporary database.</summary>
    public string ConnectionString => new NpgsqlConnectionStringBuilder(_serverConnection) { Database = _databaseName }.ConnectionString;

    /// <summary>Points the API at the temporary database and relaxes rate limits for tests.</summary>
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Wattly", ConnectionString);
        builder.UseSetting("Database:MigrateOnStartup", "true");
        builder.UseSetting("RateLimiting:AuthPerMinute", "10000");
        builder.UseSetting("RateLimiting:GlobalPerMinute", "10000");
        builder.UseSetting("Storage:LocalPath", _storagePath);
        // Same attachment storage as the production deployment (DEC-026, DEC-027).
        builder.UseSetting("Storage:Provider", "Database");
        builder.UseSetting("Seed:AdminEmail", "admin@wattly.test");
        builder.UseSetting("Seed:AdminPassword", "AdminPassword123");
        builder.ConfigureTestServices(services => services.AddSingleton<IExternalTokenValidator, FakeExternalValidator>());
    }

    /// <summary>Nothing to prepare – the API migrates the database on start.</summary>
    public Task InitializeAsync() => Task.CompletedTask;

    /// <summary>Drops the temporary database and storage directory.</summary>
    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        NpgsqlConnection.ClearAllPools();
        await using var connection = new NpgsqlConnection(_serverConnection);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{_databaseName}\" WITH (FORCE)", connection);
        await command.ExecuteNonQueryAsync();
        if (Directory.Exists(_storagePath))
            Directory.Delete(_storagePath, recursive: true);
    }
}

/// <summary>xUnit collection sharing one API host and database between test classes.</summary>
[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<WattlyApiFactory>
{
    /// <summary>Collection name.</summary>
    public const string Name = "api";
}
