using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Wattly.Application.Common;
using Wattly.Infrastructure.Hosting;
using Wattly.Infrastructure.Identity;
using Wattly.Infrastructure.Identity.External;
using Wattly.Infrastructure.Persistence;
using Wattly.Infrastructure.Storage;

namespace Wattly.Infrastructure;

/// <summary>Registration of the infrastructure layer.</summary>
public static class DependencyInjection
{
    /// <summary>Registers EF Core (PostgreSQL), Identity, Data Protection key storage, file storage, clock and health checks.</summary>
    /// <param name="services">Service collection.</param>
    /// <param name="configuration">Application configuration.</param>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = DatabaseConnection.Resolve(configuration)
                               ?? throw new InvalidOperationException("Database is not configured: set ConnectionStrings:Wattly or DATABASE_URL.");

        services.AddDbContext<WattlyDbContext>(options => options.UseNpgsql(connectionString));
        services.AddScoped<IWattlyDbContext>(sp => sp.GetRequiredService<WattlyDbContext>());

        services.AddIdentityCore<AppUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Password.RequiredLength = 10;
                options.Password.RequireNonAlphanumeric = false;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<WattlyDbContext>()
            .AddDefaultTokenProviders()
            .AddApiEndpoints();

        // Token encryption keys live in the database: containers are stateless and restart often (scale to zero),
        // and a fresh key ring would invalidate every issued access and refresh token (DEC-027).
        services.AddDataProtection()
            .SetApplicationName("Wattly")
            .PersistKeysToDbContext<WattlyDbContext>();

        services.AddExternalAuthentication(configuration);

        services.Configure<StorageOptions>(configuration.GetSection(StorageOptions.SectionName));
        var storageProvider = configuration[$"{StorageOptions.SectionName}:Provider"] ?? "Local";
        if (storageProvider.Equals("Database", StringComparison.OrdinalIgnoreCase))
            services.AddScoped<IFileStorage, DatabaseFileStorage>();
        else
            services.AddSingleton<IFileStorage, LocalFileStorage>();
        services.AddSingleton(TimeProvider.System);

        services.AddHealthChecks().AddDbContextCheck<WattlyDbContext>("database", tags: ["ready"]);
        return services;
    }
}
