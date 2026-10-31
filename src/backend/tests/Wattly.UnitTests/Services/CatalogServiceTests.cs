using Wattly.Application.Catalog;
using Wattly.Application.Common;
using Wattly.UnitTests.Support;

namespace Wattly.UnitTests.Services;

/// <summary>Tests of <see cref="CatalogService"/>.</summary>
public class CatalogServiceTests
{
    [Fact]
    public async Task Regular_user_cannot_modify_catalog()
    {
        using var t = new TestContext();
        var service = new CatalogService(t.Db, t.User);

        await Assert.ThrowsAsync<ForbiddenException>(() => service.CreateOperatorAsync(new CatalogEntryRequest("OSD", "OSD", null, null), CancellationToken.None));
        await Assert.ThrowsAsync<ForbiddenException>(() => service.CreateSupplierAsync(new CatalogEntryRequest("S", "S", null, null), CancellationToken.None));
        await Assert.ThrowsAsync<ForbiddenException>(() => service.CreateTariffAsync(new TariffRequest("G11", "G11", null, null, null), CancellationToken.None));
    }

    [Fact]
    public async Task Admin_creates_and_updates_operator_with_normalised_code()
    {
        using var t = new TestContext();
        t.User.IsAdmin = true;
        var service = new CatalogService(t.Db, t.User);

        var created = await service.CreateOperatorAsync(new CatalogEntryRequest(" Nowy OSD ", "nowy-osd", null, null), CancellationToken.None);
        var updated = await service.UpdateOperatorAsync(created.Id, new CatalogEntryRequest("Inna nazwa", "NOWY-OSD", "pl", false), CancellationToken.None);

        Assert.Equal("NOWY-OSD", created.Code);
        Assert.Equal("Nowy OSD", created.Name);
        Assert.False(updated.IsActive);
        Assert.Empty(await service.ListOperatorsAsync(false, CancellationToken.None));
        Assert.Single(await service.ListOperatorsAsync(true, CancellationToken.None));
    }

    [Fact]
    public async Task Duplicate_codes_are_conflicts()
    {
        using var t = new TestContext();
        t.User.IsAdmin = true;
        var service = new CatalogService(t.Db, t.User);
        await service.CreateSupplierAsync(new CatalogEntryRequest("A", "ABC", null, null), CancellationToken.None);

        var error = await Assert.ThrowsAsync<ConflictException>(() => service.CreateSupplierAsync(new CatalogEntryRequest("B", "abc", null, null), CancellationToken.None));

        Assert.Equal("catalog.duplicate_code", error.Code);
    }

    [Fact]
    public async Task Supplier_update_and_listing()
    {
        using var t = new TestContext();
        t.User.IsAdmin = true;
        var service = new CatalogService(t.Db, t.User);
        var created = await service.CreateSupplierAsync(new CatalogEntryRequest("B", "B", null, null), CancellationToken.None);

        await service.UpdateSupplierAsync(created.Id, new CatalogEntryRequest("Bee", "B", null, null), CancellationToken.None);

        Assert.Equal("Bee", Assert.Single(await service.ListSuppliersAsync(false, CancellationToken.None)).Name);
        await Assert.ThrowsAsync<NotFoundException>(() => service.UpdateSupplierAsync(Guid.NewGuid(), new CatalogEntryRequest("x", "X", null, null), CancellationToken.None));
    }

    [Fact]
    public async Task Tariff_requires_zero_or_at_least_two_unique_zones()
    {
        using var t = new TestContext();
        t.User.IsAdmin = true;
        var service = new CatalogService(t.Db, t.User);

        await Assert.ThrowsAsync<ValidationFailedException>(() =>
            service.CreateTariffAsync(new TariffRequest("G1X", "x", null, null, [new TariffZoneDto("A", "A", null)]), CancellationToken.None));
        await Assert.ThrowsAsync<ValidationFailedException>(() =>
            service.CreateTariffAsync(new TariffRequest("G1X", "x", null, null, [new TariffZoneDto("A", "A", null), new TariffZoneDto("a", "B", null)]), CancellationToken.None));

        var created = await service.CreateTariffAsync(new TariffRequest("g12", "G12", "opis", null, [new TariffZoneDto("day", "Dzienna", null), new TariffZoneDto("NIGHT", "Nocna", "22-6")]), CancellationToken.None);
        Assert.Equal(["DAY", "NIGHT"], created.Zones.Select(z => z.Code));

        var updated = await service.UpdateTariffAsync(created.Id, new TariffRequest("G12", "G12 nowa", null, false, []), CancellationToken.None);
        Assert.Empty(updated.Zones);
        Assert.Empty(await service.ListTariffsAsync(false, CancellationToken.None));
        Assert.Equal("G12 nowa", (await service.GetTariffAsync(created.Id, CancellationToken.None)).Name);
    }
}
