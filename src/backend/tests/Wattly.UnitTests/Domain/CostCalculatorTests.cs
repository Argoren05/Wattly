using Wattly.Domain.Calculations;
using Wattly.Domain.Tariffs;

namespace Wattly.UnitTests;

public class CostCalculatorTests
{
    private static readonly TimeZoneInfo Warsaw = TimeZoneInfo.FindSystemTimeZoneById("Europe/Warsaw");
    private static readonly Guid PlanId = Guid.NewGuid();

    private static DateTimeOffset Local(int year, int month, int day) =>
        new DateTimeOffset(new DateTime(year, month, day), Warsaw.GetUtcOffset(new DateTime(year, month, day))).ToUniversalTime();

    private static RateComponentInput Component(RateComponentType type, RateUnit unit, decimal rate, string? zone = null, decimal tax = 0.23m) =>
        new(PlanId, "Plan", type, $"{type} {zone}", zone, unit, rate, tax);

    private static CostSegment Segment(DateTimeOffset start, DateTimeOffset end, IReadOnlyList<RateComponentInput> components,
        decimal total, Dictionary<string, decimal>? zones = null, decimal? power = null) =>
        new(start, end, components, zones ?? [], total, power);

    [Fact]
    public void Calculates_energy_distribution_fixed_fees_and_vat()
    {
        var segment = Segment(Local(2026, 9, 1), Local(2026, 10, 1),
        [
            Component(RateComponentType.Energy, RateUnit.Kwh, 0.5m, "DAY"),
            Component(RateComponentType.Energy, RateUnit.Kwh, 0.3m, "NIGHT"),
            Component(RateComponentType.VariableDistribution, RateUnit.Kwh, 0.2m),
            Component(RateComponentType.FixedDistribution, RateUnit.Month, 10m),
            Component(RateComponentType.Subscription, RateUnit.Month, 5m),
        ], total: 250m, zones: new() { ["DAY"] = 150m, ["NIGHT"] = 100m });

        var result = CostCalculator.Calculate([segment], Warsaw);

        Assert.Equal(105.00m, result.EnergyCostNet);
        Assert.Equal(60.00m, result.DistributionCostNet);
        Assert.Equal(5.00m, result.OtherCostNet);
        Assert.Equal(170.00m, result.TotalNet);
        Assert.Equal(39.10m, result.TaxAmount);
        Assert.Equal(209.10m, result.TotalGross);
        Assert.Empty(result.Assumptions);
    }

    [Fact]
    public void Monthly_fee_is_prorated_by_calendar_month_share()
    {
        var segment = Segment(Local(2026, 9, 16), Local(2026, 10, 1), [Component(RateComponentType.FixedDistribution, RateUnit.Month, 10m)], 0m);

        var result = CostCalculator.Calculate([segment], Warsaw);

        Assert.Equal(0.5m, result.Lines.Single().Quantity);
        Assert.Equal(5.00m, result.TotalNet);
    }

    [Theory]
    [InlineData(2026, 1, 1, 2026, 3, 1, 2.0)]
    [InlineData(2026, 2, 15, 2026, 3, 1, 0.5)]
    [InlineData(2026, 1, 16, 2026, 2, 15, 1.0161)] // 16/31 + 14/28
    public void MonthFraction_counts_partial_months(int y1, int m1, int d1, int y2, int m2, int d2, double expected)
    {
        var fraction = CostCalculator.MonthFraction(Local(y1, m1, d1), Local(y2, m2, d2), Warsaw);

        Assert.Equal((decimal)expected, fraction, 4);
    }

    [Fact]
    public void Day_count_ignores_dst_hour_shift()
    {
        // The night of 25 October 2026 is 25 hours long in Warsaw, but it is still one calendar day.
        Assert.Equal(1m, CostCalculator.DayCount(Local(2026, 10, 25), Local(2026, 10, 26), Warsaw));
    }

    [Fact]
    public void Vat_is_calculated_on_sum_per_rate_with_half_away_from_zero_rounding()
    {
        var segment = Segment(Local(2026, 1, 1), Local(2026, 2, 1),
        [
            Component(RateComponentType.Energy, RateUnit.Kwh, 0.01m),
            Component(RateComponentType.Other, RateUnit.Kwh, 0.01m, tax: 0.05m),
        ], total: 50m);

        var result = CostCalculator.Calculate([segment], Warsaw);

        // 0.50 net at 23% -> 0.115 -> 0.12 ; 0.50 net at 5% -> 0.025 -> 0.03
        Assert.Equal([0.03m, 0.12m], result.Taxes.Select(t => t.TaxAmount));
        Assert.Equal(1.15m, result.TotalGross);
    }

    [Fact]
    public void Zone_component_without_register_is_skipped_with_assumption()
    {
        var segment = Segment(Local(2026, 1, 1), Local(2026, 2, 1), [Component(RateComponentType.Energy, RateUnit.Kwh, 0.5m, "NIGHT")], total: 100m);

        var result = CostCalculator.Calculate([segment], Warsaw);

        Assert.Empty(result.Lines);
        Assert.Contains(result.Assumptions, a => a.Contains("NIGHT"));
    }

    [Fact]
    public void Capacity_per_kw_uses_contracted_power()
    {
        var withPower = Segment(Local(2026, 1, 1), Local(2026, 2, 1), [Component(RateComponentType.Capacity, RateUnit.Kw, 2m)], 0m, power: 7m);
        var withoutPower = withPower with { ContractedPowerKw = null };

        Assert.Equal(14.00m, CostCalculator.Calculate([withPower], Warsaw).TotalNet);
        var missing = CostCalculator.Calculate([withoutPower], Warsaw);
        Assert.Empty(missing.Lines);
        Assert.NotEmpty(missing.Assumptions);
    }
}
