using Microsoft.Extensions.DependencyInjection;
using Wattly.Application.Analytics;
using Wattly.Application.Calculations;
using Wattly.Application.Catalog;
using Wattly.Application.Invoices;
using Wattly.Application.Metering;
using Wattly.Application.MobileApp;
using Wattly.Application.Properties;

namespace Wattly.Application;

/// <summary>Registration of the application layer.</summary>
public static class DependencyInjection
{
    /// <summary>Registers application services (scoped per request).</summary>
    /// <param name="services">Service collection.</param>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<PropertyService>();
        services.AddScoped<EnergyContractService>();
        services.AddScoped<CatalogService>();
        services.AddScoped<RatePlanService>();
        services.AddScoped<MeterService>();
        services.AddScoped<ReadingService>();
        services.AddScoped<CalculationService>();
        services.AddScoped<AnalyticsService>();
        services.AddScoped<InvoiceService>();
        services.AddSingleton<MobileReleaseService>();
        return services;
    }
}
