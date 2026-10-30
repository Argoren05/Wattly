using Wattly.Application.Calculations;
using Wattly.Domain.Calculations;
using Wattly.Domain.Households;
using Wattly.Domain.Metering;
using Wattly.Domain.Tariffs;

namespace Wattly.UnitTests;

public class CostEngineTests
{
    private static readonly TimeZoneInfo Warsaw = TimeZoneInfo.FindSystemTimeZoneById("Europe/Warsaw");
    private static readonly Guid TariffId = Guid.NewGuid();

    private static DateTimeOffset Local(int year, int month, int day) =>
        new DateTimeOffset(new DateTime(year, month, day), Warsaw.GetUtcOffset(new DateTime(year, month, day))).ToUniversalTime();

    private static TariffRatePlan Plan(Property property, DateOnly from, DateOnly? to, decimal energyRate) => new()
    {
        TariffId = TariffId,
        PropertyId = property.Id,
        Name = $"Plan {from:yyyy-MM}",
        SourceReference = "test",
        ValidFrom = from,
        ValidTo = to,
        Components = [new TariffRateComponent { Name = "Energia", ComponentType = RateComponentType.Energy, Unit = RateUnit.Kwh, NetRate = energyRate, TaxRate = 0.23m }],
    };

    private static PropertyEnergyData Data(IReadOnlyList<TariffRatePlan> plans, params (DateTimeOffset At, decimal Value)[] readings)
    {
        var property = new Property { Name = "Dom", BillingAnchorDate = new DateOnly(2026, 1, 1) };
        return new PropertyEnergyData
        {
            Property = property,
            TimeZone = Warsaw,
            Contracts = [new EnergyContract { PropertyId = property.Id, TariffId = TariffId, ValidFrom = new DateOnly(2026, 1, 1) }],
            RatePlans = plans.Select(p => { p.PropertyId = property.Id; return p; }).ToList(),
            ImportRegisters = [new RegisterData(new MeterRegister { Name = "Pobór" }, new RegisterSeries(readings.Select(r => new ReadingPoint(r.At, r.Value))))],
        };
    }

    [Fact]
    public void Price_change_inside_period_splits_calculation_into_segments()
    {
        var property = new Property { Name = "Dom" };
        var plans = new[]
        {
            Plan(property, new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31), 0.50m),
            Plan(property, new DateOnly(2026, 2, 1), null, 1.00m),
        };
        var data = Data(plans, (Local(2026, 1, 1), 0), (Local(2026, 2, 1), 100), (Local(2026, 3, 1), 300));

        var result = CostEngine.Calculate(data, Local(2026, 1, 1), Local(2026, 3, 1), Local(2026, 6, 1));

        Assert.Equal(300m, result.ConsumptionKwh);
        Assert.Equal(2, result.Lines.Count);
        Assert.Equal(50.00m, result.Lines[0].NetAmount);
        Assert.Equal(200.00m, result.Lines[1].NetAmount);
        Assert.Equal(250.00m, result.TotalNet);
        Assert.False(result.IsEstimate);
        Assert.True(result.IsComplete);
    }

    [Fact]
    public void Period_ending_in_future_is_an_estimate_with_assumptions()
    {
        var property = new Property { Name = "Dom" };
        var data = Data([Plan(property, new DateOnly(2026, 1, 1), null, 1m)], (Local(2026, 1, 1), 0), (Local(2026, 1, 11), 100));

        var result = CostEngine.Calculate(data, Local(2026, 1, 1), Local(2026, 1, 21), Local(2026, 1, 11));

        Assert.Equal(200m, result.ConsumptionKwh);
        Assert.True(result.IsEstimate);
        Assert.Contains(result.Assumptions, a => a.Contains("prognozowano"));
        Assert.Contains(result.SourceValues, v => v.Kind == ValueKind.Extrapolated);
    }

    [Fact]
    public void Missing_rate_plan_makes_result_incomplete()
    {
        var data = Data([], (Local(2026, 1, 1), 0), (Local(2026, 2, 1), 100));

        var result = CostEngine.Calculate(data, Local(2026, 1, 1), Local(2026, 2, 1), Local(2026, 6, 1));

        Assert.False(result.IsComplete);
        Assert.Equal(0m, result.TotalGross);
        Assert.Equal(100m, result.ConsumptionKwh);
    }
}
