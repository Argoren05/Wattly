using Microsoft.EntityFrameworkCore;
using Wattly.Application.Common;
using Wattly.Domain.Households;
using Wattly.Domain.Metering;
using Wattly.Domain.Tariffs;
using Wattly.Infrastructure.Persistence;

namespace Wattly.UnitTests.Support;

/// <summary>Configurable <see cref="ICurrentUser"/> for tests.</summary>
public sealed class FakeCurrentUser : ICurrentUser
{
    /// <summary>Identifier returned by <see cref="UserId"/>.</summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <inheritdoc />
    public Guid UserId => IsAuthenticated ? Id : throw new UnauthorizedAccessException();

    /// <inheritdoc />
    public bool IsAuthenticated { get; set; } = true;

    /// <inheritdoc />
    public bool IsAdmin { get; set; }
}

/// <summary>Clock frozen at a chosen moment.</summary>
/// <param name="now">Current time returned by the clock.</param>
public sealed class FixedClock(DateTimeOffset now) : TimeProvider
{
    /// <summary>Current time; can be moved by tests.</summary>
    public DateTimeOffset Now { get; set; } = now;

    /// <inheritdoc />
    public override DateTimeOffset GetUtcNow() => Now;
}

/// <summary>In-memory <see cref="IFileStorage"/> recording stored files.</summary>
public sealed class FakeFileStorage : IFileStorage
{
    /// <summary>Stored files by key.</summary>
    public Dictionary<string, byte[]> Files { get; } = [];

    /// <inheritdoc />
    public async Task SaveAsync(string key, Stream content, CancellationToken cancellationToken)
    {
        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, cancellationToken);
        Files[key] = buffer.ToArray();
    }

    /// <inheritdoc />
    public Task<Stream?> OpenReadAsync(string key, CancellationToken cancellationToken) =>
        Task.FromResult<Stream?>(Files.TryGetValue(key, out var bytes) ? new MemoryStream(bytes) : null);

    /// <inheritdoc />
    public Task DeleteAsync(string key, CancellationToken cancellationToken)
    {
        Files.Remove(key);
        return Task.CompletedTask;
    }
}

/// <summary>
/// Isolated in-memory database with a user, clock and storage, plus builders for typical test data.
/// Every instance uses its own database, so tests never interfere.
/// </summary>
public sealed class TestContext : IDisposable
{
    /// <summary>Default "now" of tests: 30 October 2026, 12:00 UTC.</summary>
    public static readonly DateTimeOffset DefaultNow = new(2026, 10, 30, 12, 0, 0, TimeSpan.Zero);

    private readonly string _databaseName = Guid.NewGuid().ToString();

    /// <summary>Creates the context with a fresh database.</summary>
    public TestContext()
    {
        Db = NewDbContext();
    }

    /// <summary>Signed-in user.</summary>
    public FakeCurrentUser User { get; } = new();

    /// <summary>Clock.</summary>
    public FixedClock Clock { get; } = new(DefaultNow);

    /// <summary>File storage.</summary>
    public FakeFileStorage Storage { get; } = new();

    /// <summary>Database context used by services under test.</summary>
    public WattlyDbContext Db { get; }

    /// <summary>Opens another context on the same database (to verify what was persisted).</summary>
    public WattlyDbContext NewDbContext() =>
        new(new DbContextOptionsBuilder<WattlyDbContext>().UseInMemoryDatabase(_databaseName).Options, User, Clock);

    /// <summary>Adds a G12-like tariff with DAY/NIGHT zones and returns it.</summary>
    /// <param name="code">Tariff code.</param>
    public Tariff AddTariff(string code = "G12")
    {
        var tariff = new Tariff
        {
            Code = code,
            Name = code,
            Zones = code == "G11" ? [] : [new TariffZone { Code = "DAY", Name = "Dzienna" }, new TariffZone { Code = "NIGHT", Name = "Nocna" }],
        };
        Db.Tariffs.Add(tariff);
        Db.SaveChanges();
        return tariff;
    }

    /// <summary>Adds a property owned by <paramref name="ownerId"/> (default: the current user).</summary>
    /// <param name="ownerId">Owner.</param>
    public Property AddProperty(Guid? ownerId = null)
    {
        var household = new Household { OwnerUserId = ownerId ?? User.Id, Name = "Dom" };
        var property = new Property { Name = "Mieszkanie", Household = household, BillingAnchorDate = new DateOnly(2026, 9, 1), BillingPeriodMonths = 2 };
        Db.Households.Add(household);
        Db.Properties.Add(property);
        Db.SaveChanges();
        return property;
    }

    /// <summary>Adds an open-ended contract for the property and tariff.</summary>
    /// <param name="property">Property.</param>
    /// <param name="tariff">Tariff.</param>
    public EnergyContract AddContract(Property property, Tariff tariff)
    {
        var contract = new EnergyContract { PropertyId = property.Id, TariffId = tariff.Id, ValidFrom = new DateOnly(2026, 1, 1) };
        Db.EnergyContracts.Add(contract);
        Db.SaveChanges();
        return contract;
    }

    /// <summary>Adds the user's own plan: energy DAY 0.5, NIGHT 0.3 per kWh and a fixed fee of 10 per month (23% VAT).</summary>
    /// <param name="property">Property.</param>
    /// <param name="tariff">Tariff.</param>
    public TariffRatePlan AddRatePlan(Property property, Tariff tariff)
    {
        var plan = new TariffRatePlan
        {
            TariffId = tariff.Id,
            PropertyId = property.Id,
            Name = "Plan",
            SourceReference = "test",
            ValidFrom = new DateOnly(2026, 1, 1),
            Components =
            [
                new() { Name = "Energia dzień", ComponentType = RateComponentType.Energy, ZoneCode = "DAY", Unit = RateUnit.Kwh, NetRate = 0.5m, TaxRate = 0.23m },
                new() { Name = "Energia noc", ComponentType = RateComponentType.Energy, ZoneCode = "NIGHT", Unit = RateUnit.Kwh, NetRate = 0.3m, TaxRate = 0.23m },
                new() { Name = "Opłata stała", ComponentType = RateComponentType.FixedDistribution, Unit = RateUnit.Month, NetRate = 10m, TaxRate = 0.23m },
            ],
        };
        Db.TariffRatePlans.Add(plan);
        Db.SaveChanges();
        return plan;
    }

    /// <summary>Adds a two-zone meter (DAY/NIGHT import registers).</summary>
    /// <param name="property">Property.</param>
    public Meter AddMeter(Property property)
    {
        var meter = new Meter
        {
            PropertyId = property.Id,
            Name = "Licznik",
            Registers =
            [
                new MeterRegister { Name = "Dzień", RegisterType = RegisterType.Import, ZoneCode = "DAY" },
                new MeterRegister { Name = "Noc", RegisterType = RegisterType.Import, ZoneCode = "NIGHT" },
            ],
        };
        Db.Meters.Add(meter);
        Db.SaveChanges();
        return meter;
    }

    /// <summary>Adds an active reading.</summary>
    /// <param name="register">Register.</param>
    /// <param name="at">Moment.</param>
    /// <param name="value">Value.</param>
    public MeterReading AddReading(MeterRegister register, DateTimeOffset at, decimal value)
    {
        var reading = new MeterReading { MeterRegisterId = register.Id, ReadingAt = at.ToUniversalTime(), Value = value, CreatedByUserId = User.Id, CreatedAt = Clock.Now };
        Db.MeterReadings.Add(reading);
        Db.SaveChanges();
        return reading;
    }

    /// <summary>Local midnight in Warsaw as an instant.</summary>
    /// <param name="year">Year.</param>
    /// <param name="month">Month.</param>
    /// <param name="day">Day.</param>
    public static DateTimeOffset Warsaw(int year, int month, int day) =>
        TimeZones.StartOfDay(new DateOnly(year, month, day), TimeZones.Resolve("Europe/Warsaw"));

    /// <inheritdoc />
    public void Dispose() => Db.Dispose();
}
