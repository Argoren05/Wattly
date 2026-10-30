using Wattly.Application.Common;
using Wattly.Domain.Households;
using Wattly.Domain.Tariffs;

namespace Wattly.UnitTests.Domain;

/// <summary>Tests of small domain rules and application helpers.</summary>
public class CommonAndEntityTests
{
    [Theory]
    [InlineData("2025-12-31", false)]
    [InlineData("2026-01-01", true)]
    [InlineData("2026-06-30", true)]
    [InlineData("2026-07-01", false)]
    public void Contract_validity_is_inclusive(string date, bool expected)
    {
        var contract = new EnergyContract { ValidFrom = new DateOnly(2026, 1, 1), ValidTo = new DateOnly(2026, 6, 30) };

        Assert.Equal(expected, contract.IsValidOn(DateOnly.Parse(date)));
    }

    [Fact]
    public void Rate_plan_overlap_handles_open_ranges()
    {
        var plan = new TariffRatePlan { Name = "P", SourceReference = "s", ValidFrom = new DateOnly(2026, 1, 1), ValidTo = new DateOnly(2026, 6, 30) };

        Assert.True(plan.Overlaps(new DateOnly(2026, 6, 30), null));
        Assert.False(plan.Overlaps(new DateOnly(2026, 7, 1), null));
        Assert.True(plan.Overlaps(new DateOnly(2025, 1, 1), null));
        Assert.False(plan.Overlaps(new DateOnly(2025, 1, 1), new DateOnly(2025, 12, 31)));
        Assert.True(plan.IsValidOn(new DateOnly(2026, 3, 1)));
    }

    [Theory]
    [InlineData(RateComponentType.Energy, CostCategory.Energy)]
    [InlineData(RateComponentType.VariableDistribution, CostCategory.Distribution)]
    [InlineData(RateComponentType.FixedDistribution, CostCategory.Distribution)]
    [InlineData(RateComponentType.Capacity, CostCategory.Distribution)]
    [InlineData(RateComponentType.Subscription, CostCategory.Other)]
    [InlineData(RateComponentType.Other, CostCategory.Other)]
    public void Component_types_map_to_categories(RateComponentType type, CostCategory expected)
    {
        Assert.Equal(expected, type.ToCategory());
    }

    [Fact]
    public void Validation_collects_all_errors()
    {
        var validation = new Validation()
            .Require(false, "A", "a")
            .RequireText(null, "B", 5)
            .RequireText("too long", "C", 3)
            .RequireText(null, "D", 3, required: false);

        var error = Assert.Throws<ValidationFailedException>(validation.ThrowIfInvalid);
        Assert.Equal(["A", "B", "C"], error.Errors.Keys.Order());
        Assert.Null(Validation.Clean("  "));
        Assert.Equal("x", Validation.Clean(" x "));
    }

    [Theory]
    [InlineData(null, null, 1, 50)]
    [InlineData(0, 0, 1, 1)]
    [InlineData(3, 1000, 3, 200)]
    public void Paging_is_normalised(int? page, int? size, int expectedPage, int expectedSize)
    {
        Assert.Equal((expectedPage, expectedSize), Paging.Normalize(page, size));
    }

    [Fact]
    public void Time_zone_helpers_use_local_midnight()
    {
        var warsaw = TimeZones.Resolve("Europe/Warsaw");

        Assert.Equal(new DateTimeOffset(2026, 7, 1, 0, 0, 0, TimeSpan.FromHours(2)), TimeZones.StartOfDay(new DateOnly(2026, 7, 1), warsaw));
        Assert.Equal(new DateOnly(2026, 7, 1), TimeZones.LocalDate(new DateTimeOffset(2026, 6, 30, 22, 30, 0, TimeSpan.Zero), warsaw));
        Assert.False(TimeZones.TryResolve("Nowhere/City", out _));
        Assert.Throws<InvalidOperationException>(() => TimeZones.Resolve("Nowhere/City"));
    }
}
