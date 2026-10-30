using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Wattly.Application.Common;
using Wattly.Infrastructure.Identity;
using Wattly.Infrastructure.Persistence;
using Wattly.Infrastructure.Storage;

namespace Wattly.Infrastructure;

public static class DependencyInjection
{
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
