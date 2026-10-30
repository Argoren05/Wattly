using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Wattly.Infrastructure.Persistence;

/// <summary>Used only by <c>dotnet ef</c> tooling to create migrations.</summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<WattlyDbContext>
{
    public WattlyDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("WATTLY_DESIGN_CONNECTION")
                               ?? "Host=localhost;Port=5432;Database=wattly;Username=wattly;Password=design-time-only";
        var options = new DbContextOptionsBuilder<WattlyDbContext>().UseNpgsql(connectionString).Options;
        return new WattlyDbContext(options);
    }
}
