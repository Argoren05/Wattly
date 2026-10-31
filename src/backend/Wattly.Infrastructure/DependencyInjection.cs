using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Wattly.Application.Common;
using Wattly.Infrastructure.Identity;
using Wattly.Infrastructure.Persistence;
using Wattly.Infrastructure.Storage;

namespace Wattly.Infrastructure;

/// <summary>Registration of the infrastructure layer.</summary>
public static class DependencyInjection
{
    /// <summary>Registers EF Core (PostgreSQL), Identity, file storage, clock and health checks.</summary>
    /// <param name="services">Service collection.</param>
    /// <param name="configuration">Application configuration.</param>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Wattly")
                               ?? throw new InvalidOperationException("Connection string 'ConnectionStrings:Wattly' is not configured.");

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

        services.Configure<StorageOptions>(configuration.GetSection(StorageOptions.SectionName));
        services.AddSingleton<IFileStorage, LocalFileStorage>();
        services.AddSingleton(TimeProvider.System);

        services.AddHealthChecks().AddDbContextCheck<WattlyDbContext>("database", tags: ["ready"]);
        return services;
    }
}
