using Microsoft.EntityFrameworkCore;
using Wattly.Domain.Metering;
using Wattly.Infrastructure.Identity;
using Wattly.Infrastructure.Persistence;
using Wattly.UnitTests.Support;

namespace Wattly.UnitTests.Infrastructure;

/// <summary>Tests of audit logging and technical fields in <see cref="WattlyDbContext"/> and of <see cref="CatalogSeeder"/>.</summary>
public class WattlyDbContextTests
{
    [Fact]
    public async Task Changes_of_auditable_entities_are_logged_with_actor()
    {
        using var t = new TestContext();
        var register = t.AddMeter(t.AddProperty()).Registers[0];

        var reading = t.AddReading(register, TestContext.DefaultNow.AddDays(-1), 10);
        reading.Value = 12;
        await t.Db.SaveChangesAsync();

        var events = await t.NewDbContext().AuditEvents.Where(e => e.EntityType == nameof(MeterReading)).OrderBy(e => e.Action).ToListAsync();
        Assert.Equal(["Added", "Modified"], events.Select(e => e.Action));
        Assert.All(events, e => Assert.Equal(t.User.Id, e.ActorUserId));
        Assert.Contains("\"from\":10", events.Single(e => e.Action == "Modified").ChangesJson);
    }

    [Fact]
    public async Task Non_auditable_entities_are_not_logged()
    {
        using var t = new TestContext();
        t.AddTariff();

        Assert.Empty(await t.NewDbContext().AuditEvents.ToListAsync());
    }

    [Fact]
    public async Task Anonymous_changes_have_no_actor()
    {
        using var t = new TestContext();
        t.User.IsAuthenticated = false;
        var property = t.AddProperty(ownerId: Guid.NewGuid());
        t.AddContract(property, t.AddTariff());

        Assert.Null((await t.NewDbContext().AuditEvents.SingleAsync()).ActorUserId);
    }

    [Fact]
    public async Task New_users_get_creation_time()
    {
        using var t = new TestContext();
        t.Db.Users.Add(new AppUser { UserName = "a@b.c", Email = "a@b.c" });
        await t.Db.SaveChangesAsync();

        Assert.Equal(TestContext.DefaultNow, (await t.NewDbContext().Users.SingleAsync()).CreatedAt);
    }

    [Fact]
    public async Task Catalog_seed_is_idempotent_and_contains_no_prices()
    {
        using var t = new TestContext();

        await CatalogSeeder.SeedAsync(t.Db, CancellationToken.None);
        await CatalogSeeder.SeedAsync(t.Db, CancellationToken.None);

        var db = t.NewDbContext();
        Assert.Equal(5, await db.EnergyOperators.CountAsync());
        Assert.Equal(5, await db.EnergySuppliers.CountAsync());
        Assert.Equal(["G11", "G12", "G12W", "G13"], await db.Tariffs.OrderBy(x => x.Code).Select(x => x.Code).ToListAsync());
        Assert.Equal(3, (await db.Tariffs.SingleAsync(x => x.Code == "G13")).Zones.Count);
        Assert.Empty(await db.TariffRatePlans.ToListAsync());
    }
}
