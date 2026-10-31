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
    public async Task Own_plan_can_be_corrected_in_place()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var tariff = t.AddTariff();
        var service = new RatePlanService(t.Db, t.User, t.Clock);
        var plan = await service.CreatePropertyPlanAsync(property.Id, Plan(tariff.Id, new DateOnly(2026, 2, 7)), CancellationToken.None);

        var corrected = await service.UpdatePropertyPlanAsync(plan.Id, Plan(tariff.Id, new DateOnly(2026, 1, 1), null,
            new RateComponentRequest(RateComponentType.Energy, "Energia", "DAY", RateUnit.Kwh, 0.579m, 0.23m),
            new RateComponentRequest(RateComponentType.Subscription, "Opłata handlowa", null, RateUnit.Month, 25.61m, 0.23m)), CancellationToken.None);

        Assert.Equal(plan.Id, corrected.Id);
        Assert.Equal(new DateOnly(2026, 1, 1), corrected.ValidFrom);
        Assert.Equal(2, corrected.Components.Count);
        Assert.Equal(0.579m, corrected.Components.Single(c => c.Unit == RateUnit.Kwh).NetRate);
        Assert.Equal(2, t.NewDbContext().TariffRateComponents.Count(c => c.TariffRatePlanId == plan.Id));
    }

    [Fact]
    public async Task Correction_must_not_overlap_another_plan_but_may_keep_its_own_dates()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var tariff = t.AddTariff();
        var service = new RatePlanService(t.Db, t.User, t.Clock);
        await service.CreatePropertyPlanAsync(property.Id, Plan(tariff.Id, new DateOnly(2025, 1, 1), new DateOnly(2025, 12, 31)), CancellationToken.None);
        var current = await service.CreatePropertyPlanAsync(property.Id, Plan(tariff.Id, new DateOnly(2026, 1, 1)), CancellationToken.None);

        await service.UpdatePropertyPlanAsync(current.Id, Plan(tariff.Id, new DateOnly(2026, 1, 1)), CancellationToken.None);
        var conflict = await Assert.ThrowsAsync<ConflictException>(() =>
            service.UpdatePropertyPlanAsync(current.Id, Plan(tariff.Id, new DateOnly(2025, 6, 1)), CancellationToken.None));
        Assert.Equal("rate_plan.overlap", conflict.Code);
    }

    [Fact]
    public async Task Own_plan_can_be_deleted_but_catalog_plans_cannot_be_corrected()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var tariff = t.AddTariff();
        var service = new RatePlanService(t.Db, t.User, t.Clock);
        var own = await service.CreatePropertyPlanAsync(property.Id, Plan(tariff.Id, new DateOnly(2026, 1, 1)), CancellationToken.None);
        t.User.IsAdmin = true;
        var catalog = await service.CreateCatalogPlanAsync(Plan(tariff.Id, new DateOnly(2026, 1, 1)), CancellationToken.None);
        t.User.IsAdmin = false;

        await service.DeletePropertyPlanAsync(own.Id, CancellationToken.None);

        Assert.Empty(await service.ListForPropertyAsync(property.Id, CancellationToken.None));
        Assert.Empty(t.NewDbContext().TariffRateComponents.Where(c => c.TariffRatePlanId == own.Id));
        await Assert.ThrowsAsync<ForbiddenException>(() => service.UpdatePropertyPlanAsync(catalog.Id, Plan(tariff.Id, new DateOnly(2026, 1, 1)), CancellationToken.None));
        await Assert.ThrowsAsync<ForbiddenException>(() => service.DeletePropertyPlanAsync(catalog.Id, CancellationToken.None));
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
        await Assert.ThrowsAsync<NotFoundException>(() => service.UpdatePropertyPlanAsync(plan.Id, Plan(tariff.Id, new DateOnly(2026, 1, 1)), CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => service.DeletePropertyPlanAsync(plan.Id, CancellationToken.None));
    }
}
