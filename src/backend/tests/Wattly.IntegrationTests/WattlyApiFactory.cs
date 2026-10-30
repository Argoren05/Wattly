using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
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

    public string ConnectionString => new NpgsqlConnectionStringBuilder(_serverConnection) { Database = _databaseName }.ConnectionString;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Wattly", ConnectionString);
        builder.UseSetting("Database:MigrateOnStartup", "true");
        builder.UseSetting("RateLimiting:AuthPerMinute", "10000");
        builder.UseSetting("RateLimiting:GlobalPerMinute", "10000");
        builder.UseSetting("Storage:LocalPath", _storagePath);
        builder.UseSetting("Seed:AdminEmail", "admin@wattly.test");
        builder.UseSetting("Seed:AdminPassword", "AdminPassword123");
    }

    public Task InitializeAsync() => Task.CompletedTask;

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

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<WattlyApiFactory>
{
    public const string Name = "api";
}
