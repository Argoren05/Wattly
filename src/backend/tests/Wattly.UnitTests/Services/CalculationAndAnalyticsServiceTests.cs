using Wattly.Application.Analytics;
using Wattly.Application.Calculations;
using Wattly.Application.Common;
using Wattly.UnitTests.Support;
using static Wattly.UnitTests.Support.TestContext;

namespace Wattly.UnitTests.Services;

/// <summary>Tests of <see cref="CalculationService"/> and <see cref="AnalyticsService"/> on a fully configured property.</summary>
public class CalculationAndAnalyticsServiceTests
{
    /// <summary>
    /// Property with G12 contract, own rates (DAY 0.5, NIGHT 0.3, fixed 10/month) and readings on
    /// 1 Sep (1000/500), 1 Oct (1150/600) and 20 Oct (1250/660).
    /// </summary>
    private static (TestContext T, Guid PropertyId) Configured()
    {
        var t = new TestContext();
        var property = t.AddProperty();
        var tariff = t.AddTariff();
        t.AddContract(property, tariff);
        t.AddRatePlan(property, tariff);
        var meter = t.AddMeter(property);
        var (day, night) = (meter.Registers.Single(r => r.ZoneCode == "DAY"), meter.Registers.Single(r => r.ZoneCode == "NIGHT"));
        t.AddReading(day, Warsaw(2026, 9, 1), 1000);
        t.AddReading(night, Warsaw(2026, 9, 1), 500);
        t.AddReading(day, Warsaw(2026, 10, 1), 1150);
        t.AddReading(night, Warsaw(2026, 10, 1), 600);
        t.AddReading(day, Warsaw(2026, 10, 20), 1250);
        t.AddReading(night, Warsaw(2026, 10, 20), 660);
        return (t, property.Id);
    }

    [Fact]
    public async Task Preview_calculates_september_exactly()
    {
        var (t, propertyId) = Configured();
        using var _ = t;
        var service = new CalculationService(t.Db, t.User, t.Clock);

        var result = await service.PreviewAsync(propertyId, new CalculationRequest(Warsaw(2026, 9, 1), Warsaw(2026, 10, 1)), CancellationToken.None);

        // 150 × 0.5 + 100 × 0.3 + 10 = 115.00 net; VAT 26.45; gross 141.45.
        Assert.Equal(250m, result.ConsumptionKwh);
        Assert.Equal(115.00m, result.TotalNet);
        Assert.Equal(26.45m, result.TaxAmount);
        Assert.Equal(141.45m, result.TotalGross);
        Assert.False(result.IsEstimate);
        Assert.True(result.IsComplete);
        Assert.Null(result.Id);
    }

    [Fact]
    public async Task Saved_calculation_keeps_rate_snapshot()
    {
        var (t, propertyId) = Configured();
        using var _ = t;
        var service = new CalculationService(t.Db, t.User, t.Clock);

        var saved = await service.SaveAsync(propertyId, new CalculationRequest(Warsaw(2026, 9, 1), Warsaw(2026, 10, 1)), CancellationToken.None);

        // Changing the price list afterwards must not change the stored result.
        foreach (var component in t.Db.TariffRateComponents)
            component.NetRate *= 10;
        await t.Db.SaveChangesAsync();

        var stored = await service.GetAsync(saved.Id!.Value, CancellationToken.None);
        Assert.Equal(141.45m, stored.TotalGross);
        Assert.Equal(3, stored.Lines.Count);
        Assert.Equal(1, (await service.ListAsync(propertyId, null, null, CancellationToken.None)).TotalCount);
    }

    [Fact]
    public async Task Invalid_period_is_rejected()
    {
        var (t, propertyId) = Configured();
        using var _ = t;
        var service = new CalculationService(t.Db, t.User, t.Clock);

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.PreviewAsync(propertyId, new CalculationRequest(Warsaw(2026, 10, 1), Warsaw(2026, 9, 1)), CancellationToken.None));
        await Assert.ThrowsAsync<ValidationFailedException>(() => service.PreviewAsync(propertyId, new CalculationRequest(Warsaw(2020, 1, 1), Warsaw(2026, 1, 1)), CancellationToken.None));
    }

    [Fact]
    public async Task Calculations_of_foreign_property_are_not_found()
    {
        var (t, propertyId) = Configured();
        using var _ = t;
        var service = new CalculationService(t.Db, t.User, t.Clock);
        var saved = await service.SaveAsync(propertyId, new CalculationRequest(Warsaw(2026, 9, 1), Warsaw(2026, 10, 1)), CancellationToken.None);

        t.User.Id = Guid.NewGuid();

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetAsync(saved.Id!.Value, CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => service.PreviewAsync(propertyId, new CalculationRequest(Warsaw(2026, 9, 1), Warsaw(2026, 10, 1)), CancellationToken.None));
    }

    [Fact]
    public async Task Forecast_covers_current_billing_period_and_budget()
    {
        var (t, propertyId) = Configured();
        using var _ = t;
        t.Db.Properties.Single().MonthlyBudget = 100m;
        await t.Db.SaveChangesAsync();
        var service = new AnalyticsService(t.Db, t.User, t.Clock);

        var forecast = await service.ForecastAsync(propertyId, CancellationToken.None);

        Assert.Equal(new DateOnly(2026, 9, 1), forecast.PeriodStart);
        Assert.Equal(new DateOnly(2026, 10, 31), forecast.PeriodEnd);
        Assert.Equal(Warsaw(2026, 9, 1), forecast.PeriodStartAt);
        Assert.Equal(Warsaw(2026, 11, 1), forecast.PeriodEndAt);
        Assert.Equal(410m, forecast.ConsumptionToDateKwh);
        Assert.True(forecast.ForecastConsumptionKwh > 410m);
        Assert.Equal(200m, forecast.BudgetForPeriod);
        Assert.True(forecast.HasContract);
        Assert.True(forecast.HasRatePlans);
        Assert.True(forecast.IsEstimate);
        Assert.Equal(6, forecast.ReadingsCount);
    }

    [Fact]
    public async Task Forecast_total_equals_preview_of_the_same_instants()
    {
        var (t, propertyId) = Configured();
        using var _ = t;
        var forecast = await new AnalyticsService(t.Db, t.User, t.Clock).ForecastAsync(propertyId, CancellationToken.None);

        var preview = await new CalculationService(t.Db, t.User, t.Clock)
            .PreviewAsync(propertyId, new CalculationRequest(forecast.PeriodStartAt, forecast.PeriodEndAt), CancellationToken.None);

        Assert.Equal(forecast.ForecastCostGross, preview.TotalGross);
    }

    [Fact]
    public async Task Monthly_consumption_series_marks_estimates_and_partial_buckets()
    {
        var (t, propertyId) = Configured();
        using var _ = t;
        var service = new AnalyticsService(t.Db, t.User, t.Clock);

        var series = await service.ConsumptionAsync(propertyId, new DateOnly(2026, 9, 1), new DateOnly(2026, 12, 31), Granularity.Month, CancellationToken.None);

        // November and December are in the future and are not returned.
        Assert.Equal(2, series.Points.Count);
        Assert.Equal(250m, series.Points[0].ConsumptionKwh);
        Assert.False(series.Points[0].IsEstimate);
        Assert.True(series.Points[1].IsPartial);
        Assert.True(series.Points[1].IsEstimate);
        Assert.NotEmpty(series.Assumptions);
    }

    [Fact]
    public async Task Cost_series_uses_rates_per_bucket()
    {
        var (t, propertyId) = Configured();
        using var _ = t;
        var service = new AnalyticsService(t.Db, t.User, t.Clock);

        var series = await service.CostsAsync(propertyId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 30), Granularity.Month, CancellationToken.None);

        Assert.Equal(141.45m, Assert.Single(series.Points).CostGross);
        Assert.Equal(141.45m, series.TotalCostGross);
    }

    [Fact]
    public async Task Series_validates_range()
    {
        var (t, propertyId) = Configured();
        using var _ = t;
        var service = new AnalyticsService(t.Db, t.User, t.Clock);

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.ConsumptionAsync(propertyId, new DateOnly(2026, 2, 1), new DateOnly(2026, 1, 1), Granularity.Day, CancellationToken.None));
        await Assert.ThrowsAsync<ValidationFailedException>(() => service.ConsumptionAsync(propertyId, new DateOnly(2020, 1, 1), new DateOnly(2026, 1, 1), Granularity.Day, CancellationToken.None));
    }
}
