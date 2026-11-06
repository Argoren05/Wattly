using Wattly.Application.Appliances;
using Wattly.Application.Common;
using Wattly.Domain.Appliances;
using Wattly.UnitTests.Support;
using static Wattly.UnitTests.Support.TestContext;

namespace Wattly.UnitTests.Services;

/// <summary>Tests of <see cref="ApplianceService"/>.</summary>
public class ApplianceServiceTests
{
    private static readonly DateOnly Sep1 = new(2026, 9, 1);

    /// <summary>Property with rates and September readings: 150 kWh day + 100 kWh night = 250 kWh.</summary>
    private static (TestContext T, Guid PropertyId, ApplianceService Service) Setup(bool withReadings = true)
    {
        var t = new TestContext();
        var property = t.AddProperty();
        var tariff = t.AddTariff();
        t.AddContract(property, tariff);
        t.AddRatePlan(property, tariff);
        var meter = t.AddMeter(property);
        if (withReadings)
        {
            foreach (var r in meter.Registers)
            {
                t.AddReading(r, Warsaw(2026, 9, 1), 0);
                t.AddReading(r, Warsaw(2026, 10, 1), r.ZoneCode == "DAY" ? 150 : 100);
            }
        }

        return (t, property.Id, new ApplianceService(t.Db, t.User, t.Clock));
    }

    private static ApplianceUsageRequest Daily(DateOnly from, int days, decimal kwhPerDay) =>
        new(Enumerable.Range(0, days).Select(i => new ApplianceUsageEntry(from.AddDays(i), from.AddDays(i), kwhPerDay)).ToList());

    [Fact]
    public async Task Appliances_are_created_listed_and_tapo_devices_are_unique_per_property()
    {
        var (t, propertyId, service) = Setup();
        using var _ = t;

        await service.CreateAsync(propertyId, new ApplianceRequest("Pralka", ApplianceSource.Tapo, "dev-1", "P110"), CancellationToken.None);
        await service.CreateAsync(propertyId, new ApplianceRequest("Lodówka"), CancellationToken.None);

        var list = await service.ListAsync(propertyId, CancellationToken.None);
        Assert.Equal(["Lodówka", "Pralka"], list.Select(a => a.Name));
        Assert.Equal(ApplianceSource.Tapo, list[1].Source);

        var duplicate = await Assert.ThrowsAsync<ConflictException>(() =>
            service.CreateAsync(propertyId, new ApplianceRequest("Inna nazwa", ApplianceSource.Tapo, "dev-1"), CancellationToken.None));
        Assert.Equal("appliance.duplicate", duplicate.Code);
        await Assert.ThrowsAsync<ValidationFailedException>(() =>
            service.CreateAsync(propertyId, new ApplianceRequest("Bez id", ApplianceSource.Tapo), CancellationToken.None));
    }

    [Fact]
    public async Task Usage_for_the_same_period_is_replaced_and_overlaps_are_rejected()
    {
        var (t, propertyId, service) = Setup();
        using var _ = t;
        var plug = await service.CreateAsync(propertyId, new ApplianceRequest("Pralka", ApplianceSource.Tapo, "dev-1"), CancellationToken.None);

        Assert.Equal(new ApplianceUsageSaved(3, 0), await service.SaveUsageAsync(plug.Id, Daily(Sep1, 3, 1.2m), CancellationToken.None));
        // The phone re-sends the whole quarter: existing days are updated, new ones added.
        Assert.Equal(new ApplianceUsageSaved(1, 3), await service.SaveUsageAsync(plug.Id, Daily(Sep1, 4, 1.5m), CancellationToken.None));
        Assert.All(await service.ListUsageAsync(plug.Id, CancellationToken.None), u => Assert.Equal(1.5m, u.EnergyKwh));
        Assert.Equal(new DateOnly(2026, 9, 4), (await service.ListAsync(propertyId, CancellationToken.None)).Single().LastUsageDate);

        var overlap = await Assert.ThrowsAsync<ConflictException>(() => service.SaveUsageAsync(plug.Id,
            new ApplianceUsageRequest([new ApplianceUsageEntry(Sep1, new DateOnly(2026, 9, 30), 30m)]), CancellationToken.None));
        Assert.Equal("appliance_usage.overlap", overlap.Code);
    }

    [Theory]
    [InlineData(2026, 9, 2, 2026, 9, 1, 1)]   // reversed period
    [InlineData(2026, 9, 1, 2026, 9, 1, -1)]  // negative
    [InlineData(2026, 9, 1, 2026, 9, 1, 150)] // > 100 kWh per day
    [InlineData(2027, 1, 1, 2027, 1, 1, 1)]   // future
    public async Task Invalid_usage_is_rejected(int y1, int m1, int d1, int y2, int m2, int d2, double kwh)
    {
        var (t, propertyId, service) = Setup();
        using var _ = t;
        var fridge = await service.CreateAsync(propertyId, new ApplianceRequest("Lodówka"), CancellationToken.None);

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.SaveUsageAsync(fridge.Id,
            new ApplianceUsageRequest([new ApplianceUsageEntry(new DateOnly(y1, m1, d1), new DateOnly(y2, m2, d2), (decimal)kwh)]), CancellationToken.None));
    }

    [Fact]
    public async Task Breakdown_splits_meter_consumption_and_prices_it_with_per_kwh_rates()
    {
        var (t, propertyId, service) = Setup();
        using var _ = t;
        var fridge = await service.CreateAsync(propertyId, new ApplianceRequest("Lodówka"), CancellationToken.None);
        var washer = await service.CreateAsync(propertyId, new ApplianceRequest("Pralka", ApplianceSource.Tapo, "dev-1"), CancellationToken.None);
        var hidden = await service.CreateAsync(propertyId, new ApplianceRequest("Stare gniazdko", IsHidden: true), CancellationToken.None);
        await service.SaveUsageAsync(washer.Id, Daily(Sep1, 30, 1.2m), CancellationToken.None);
        // Manual monthly entry 16.08–15.09 (31 days, 31 kWh): only the 15 September days count.
        await service.SaveUsageAsync(fridge.Id, new ApplianceUsageRequest([new ApplianceUsageEntry(new DateOnly(2026, 8, 16), new DateOnly(2026, 9, 15), 31m)]), CancellationToken.None);
        await service.SaveUsageAsync(hidden.Id, Daily(Sep1, 1, 50m), CancellationToken.None);

        var result = await service.BreakdownAsync(propertyId, Sep1, new DateOnly(2026, 9, 30), CancellationToken.None);

        Assert.Equal(30, result.Days);
        Assert.Equal(250m, result.MeterKwh);
        // Per-kWh components only: (150 × 0.5 + 100 × 0.3) × 1.23 / 250 kWh; the fixed monthly fee is left out.
        Assert.Equal(0.5166m, result.PricePerKwhGross);
        Assert.Equal(["Pralka", "Lodówka"], result.Items.Select(i => i.Name));
        Assert.Equal(new BreakdownItemDto(washer.Id, "Pralka", 36m, 18.60m, 14.4m, 30), result.Items[0]);
        Assert.Equal(new BreakdownItemDto(fridge.Id, "Lodówka", 15m, 7.75m, 6.0m, 15), result.Items[1]);
        Assert.Equal(new BreakdownItemDto(null, "Pozostałe", 199m, 102.80m, 79.6m, 30), result.Other);
        Assert.False(result.AppliancesExceedMeter);
    }

    [Fact]
    public async Task Breakdown_without_readings_shows_appliances_without_cost_or_rest()
    {
        var (t, propertyId, service) = Setup(withReadings: false);
        using var _ = t;
        var plug = await service.CreateAsync(propertyId, new ApplianceRequest("Pralka", ApplianceSource.Tapo, "dev-1"), CancellationToken.None);
        await service.SaveUsageAsync(plug.Id, Daily(Sep1, 2, 1m), CancellationToken.None);

        var result = await service.BreakdownAsync(propertyId, Sep1, new DateOnly(2026, 9, 30), CancellationToken.None);

        Assert.Null(result.MeterKwh);
        Assert.Null(result.Other);
        Assert.Equal(new BreakdownItemDto(plug.Id, "Pralka", 2m, null, null, 2), Assert.Single(result.Items));
        await Assert.ThrowsAsync<ValidationFailedException>(() => service.BreakdownAsync(propertyId, Sep1, Sep1.AddDays(-1), CancellationToken.None));
    }

    [Fact]
    public async Task Appliances_of_other_users_are_not_found_and_delete_removes_usage()
    {
        var (t, propertyId, service) = Setup();
        using var _ = t;
        var foreign = t.AddProperty(ownerId: Guid.NewGuid());
        var plug = await service.CreateAsync(propertyId, new ApplianceRequest("Pralka", ApplianceSource.Tapo, "dev-1"), CancellationToken.None);
        await service.SaveUsageAsync(plug.Id, Daily(Sep1, 2, 1m), CancellationToken.None);

        await Assert.ThrowsAsync<NotFoundException>(() => service.ListAsync(foreign.Id, CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => service.CreateAsync(foreign.Id, new ApplianceRequest("X"), CancellationToken.None));

        var usage = await service.ListUsageAsync(plug.Id, CancellationToken.None);
        await service.DeleteUsageAsync(plug.Id, usage[0].Id, CancellationToken.None);
        Assert.Single(await service.ListUsageAsync(plug.Id, CancellationToken.None));

        await service.DeleteAsync(plug.Id, CancellationToken.None);
        Assert.Empty(await service.ListAsync(propertyId, CancellationToken.None));
        Assert.Empty(t.NewDbContext().ApplianceUsage);
    }
}
