using Microsoft.Extensions.DependencyInjection;
using Wattly.Application.Analytics;
using Wattly.Application.Calculations;
using Wattly.Application.Catalog;
using Wattly.Application.Invoices;
using Wattly.Application.Metering;
using Wattly.Application.Properties;

namespace Wattly.Application;

public static class DependencyInjection
{
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
        return services;
    }
}
