using Wattly.Application.Catalog;
using Wattly.Application.Common;
using Wattly.Domain.Tariffs;
using Wattly.UnitTests.Support;

namespace Wattly.UnitTests.Services;

/// <summary>Tests of <see cref="RatePlanService"/>.</summary>
public class RatePlanServiceTests
{
    private static RatePlanRequest Plan(Guid tariffId, DateOnly from, DateOnly? to = null, params RateComponentRequest[] components) =>
        new(tariffId, null, null, "Plan", from, to, null, "Faktura", null,
            components.Length > 0 ? components : [new RateComponentRequest(RateComponentType.Energy, "Energia", "DAY", RateUnit.Kwh, 0.5m, 0.23m)]);

    [Fact]
    public async Task User_creates_own_plan_for_owned_property()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var tariff = t.AddTariff();
        var service = new RatePlanService(t.Db, t.User, t.Clock);

        var plan = await service.CreatePropertyPlanAsync(property.Id, Plan(tariff.Id, new DateOnly(2026, 1, 1)), CancellationToken.None);

        Assert.Equal(property.Id, plan.PropertyId);
        Assert.Equal(CostCategory.Energy, Assert.Single(plan.Components).Category);
        Assert.Single(await service.ListForPropertyAsync(property.Id, CancellationToken.None));
    }

    [Fact]
    public async Task Catalog_plans_require_admin()
    {
        using var t = new TestContext();
        var tariff = t.AddTariff();
        var service = new RatePlanService(t.Db, t.User, t.Clock);

        await Assert.ThrowsAsync<ForbiddenException>(() => service.CreateCatalogPlanAsync(Plan(tariff.Id, new DateOnly(2026, 1, 1)), CancellationToken.None));

        t.User.IsAdmin = true;
        var plan = await service.CreateCatalogPlanAsync(Plan(tariff.Id, new DateOnly(2026, 1, 1)), CancellationToken.None);
        Assert.Null(plan.PropertyId);
        Assert.Single(await service.ListCatalogAsync(tariff.Id, CancellationToken.None));
    }

    [Fact]
    public async Task Overlapping_plans_in_same_scope_are_rejected_until_previous_is_ended()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var tariff = t.AddTariff();
        var service = new RatePlanService(t.Db, t.User, t.Clock);
        var first = await service.CreatePropertyPlanAsync(property.Id, Plan(tariff.Id, new DateOnly(2026, 1, 1)), CancellationToken.None);

        var conflict = await Assert.ThrowsAsync<ConflictException>(() => service.CreatePropertyPlanAsync(property.Id, Plan(tariff.Id, new DateOnly(2026, 6, 1)), CancellationToken.None));
        Assert.Equal("rate_plan.overlap", conflict.Code);

        await service.EndAsync(first.Id, new EndRatePlanRequest(new DateOnly(2026, 5, 31)), CancellationToken.None);
        var second = await service.CreatePropertyPlanAsync(property.Id, Plan(tariff.Id, new DateOnly(2026, 6, 1)), CancellationToken.None);
        Assert.Equal(new DateOnly(2026, 6, 1), second.ValidFrom);
    }

    [Fact]
    public async Task End_can_only_shorten_validity()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var tariff = t.AddTariff();
        var service = new RatePlanService(t.Db, t.User, t.Clock);
        var plan = await service.CreatePropertyPlanAsync(property.Id, Plan(tariff.Id, new DateOnly(2026, 1, 1), new DateOnly(2026, 12, 31)), CancellationToken.None);

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.EndAsync(plan.Id, new EndRatePlanRequest(new DateOnly(2027, 1, 31)), CancellationToken.None));
        await Assert.ThrowsAsync<ValidationFailedException>(() => service.EndAsync(plan.Id, new EndRatePlanRequest(new DateOnly(2025, 12, 31)), CancellationToken.None));
    }

    [Theory]
    [InlineData(RateComponentType.Energy, RateUnit.Month, null, 0.5, 0.23)]       // energy must be per kWh
    [InlineData(RateComponentType.FixedDistribution, RateUnit.Kwh, null, 1, 0.23)] // fixed fee cannot be per kWh
    [InlineData(RateComponentType.Energy, RateUnit.Kwh, "PEAK", 0.5, 0.23)]        // zone not in tariff
    [InlineData(RateComponentType.Other, RateUnit.Month, "DAY", 1, 0.23)]          // zone only for kWh
    [InlineData(RateComponentType.Energy, RateUnit.Kwh, null, -0.1, 0.23)]         // negative rate
    [InlineData(RateComponentType.Energy, RateUnit.Kwh, null, 0.5, 23)]            // VAT as percent instead of fraction
    public async Task Invalid_components_are_rejected(RateComponentType type, RateUnit unit, string? zone, double rate, double vat)
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var tariff = t.AddTariff();
        var service = new RatePlanService(t.Db, t.User, t.Clock);

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreatePropertyPlanAsync(property.Id,
            Plan(tariff.Id, new DateOnly(2026, 1, 1), null, new RateComponentRequest(type, "X", zone, unit, (decimal)rate, (decimal)vat)), CancellationToken.None));
    }

    [Fact]
    public async Task Missing_source_or_components_is_rejected()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var tariff = t.AddTariff();
        var service = new RatePlanService(t.Db, t.User, t.Clock);

        var error = await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreatePropertyPlanAsync(property.Id,
            new RatePlanRequest(tariff.Id, null, null, "P", new DateOnly(2026, 1, 1), null, null, " ", null, []), CancellationToken.None));

        Assert.Contains("SourceReference", error.Errors.Keys);
        Assert.Contains("Components", error.Errors.Keys);
    }

    [Fact]
    public async Task Own_plans_are_private_to_property_owner()
    {
        using var t = new TestContext();
        var foreignProperty = t.AddProperty(ownerId: Guid.NewGuid());
        var tariff = t.AddTariff();
        var plan = t.AddRatePlan(foreignProperty, tariff);
        var service = new RatePlanService(t.Db, t.User, t.Clock);

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetAsync(plan.Id, CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => service.EndAsync(plan.Id, new EndRatePlanRequest(new DateOnly(2026, 2, 1)), CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => service.ListForPropertyAsync(foreignProperty.Id, CancellationToken.None));
    }
}
