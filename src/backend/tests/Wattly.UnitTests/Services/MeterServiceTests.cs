using Wattly.Application.Common;
using Wattly.Application.Metering;
using Wattly.Domain.Metering;
using Wattly.UnitTests.Support;

namespace Wattly.UnitTests.Services;

/// <summary>Tests of <see cref="MeterService"/>.</summary>
public class MeterServiceTests
{
    private static MeterRequest Meter(MeterDirectionality direction = MeterDirectionality.ImportOnly, params RegisterRequest[] registers) =>
        new("Licznik", "123", MeterType.Conventional, direction, null, null, null, registers);

    [Fact]
    public async Task Meter_without_registers_gets_default_import_register()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var service = new MeterService(t.Db, t.User);

        var meter = await service.CreateAsync(property.Id, Meter(), CancellationToken.None);

        var register = Assert.Single(meter.Registers);
        Assert.Equal(RegisterType.Import, register.RegisterType);
        Assert.Null(register.ZoneCode);
        Assert.Equal("kWh", register.Unit);
    }

    [Fact]
    public async Task Multi_zone_meter_requires_zone_for_each_import_register()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var service = new MeterService(t.Db, t.User);

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreateAsync(property.Id,
            Meter(MeterDirectionality.ImportOnly, new RegisterRequest("A", RegisterType.Import, "DAY", null, 1), new RegisterRequest("B", RegisterType.Import, null, null, 1)), CancellationToken.None));
        await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreateAsync(property.Id,
            Meter(MeterDirectionality.ImportOnly, new RegisterRequest("A", RegisterType.Import, "DAY", null, 1), new RegisterRequest("B", RegisterType.Import, "day", null, 1)), CancellationToken.None));
    }

    [Fact]
    public async Task Export_register_requires_bidirectional_meter()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var service = new MeterService(t.Db, t.User);

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreateAsync(property.Id,
            Meter(MeterDirectionality.ImportOnly, new RegisterRequest("Oddawanie", RegisterType.Export, null, null, 1)), CancellationToken.None));

        var meter = await service.CreateAsync(property.Id,
            Meter(MeterDirectionality.Bidirectional, new RegisterRequest("Pobór", RegisterType.Import, null, null, 1), new RegisterRequest("Oddawanie", RegisterType.Export, null, null, 1)), CancellationToken.None);
        Assert.Equal(2, meter.Registers.Count);

        // A meter with an export register cannot be switched back to import-only.
        await Assert.ThrowsAsync<ValidationFailedException>(() => service.UpdateAsync(meter.Id, Meter(MeterDirectionality.ImportOnly), CancellationToken.None));
    }

    [Fact]
    public async Task Register_can_be_added_and_listed()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var service = new MeterService(t.Db, t.User);
        var meter = await service.CreateAsync(property.Id, Meter(MeterDirectionality.ImportOnly, new RegisterRequest("Dzień", RegisterType.Import, "DAY", null, 1)), CancellationToken.None);

        await service.AddRegisterAsync(meter.Id, new RegisterRequest("Noc", RegisterType.Import, "night", null, 2), CancellationToken.None);

        var registers = await service.ListRegistersAsync(meter.Id, CancellationToken.None);
        Assert.Equal(["DAY", "NIGHT"], registers.Select(r => r.ZoneCode));
        Assert.Equal(2, registers.Single(r => r.ZoneCode == "NIGHT").DecimalPlaces);
    }

    [Fact]
    public async Task Update_and_get_meter()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var service = new MeterService(t.Db, t.User);
        var meter = await service.CreateAsync(property.Id, Meter(), CancellationToken.None);

        await service.UpdateAsync(meter.Id, new MeterRequest("Nowy", null, MeterType.Smart, MeterDirectionality.ImportOnly, new DateOnly(2026, 1, 1), null, false, null), CancellationToken.None);

        var loaded = await service.GetAsync(meter.Id, CancellationToken.None);
        Assert.Equal("Nowy", loaded.Name);
        Assert.Equal(MeterType.Smart, loaded.MeterType);
        Assert.False(loaded.IsActive);
        Assert.Single(await service.ListAsync(property.Id, CancellationToken.None));
    }

    [Fact]
    public async Task Foreign_meters_are_not_accessible()
    {
        using var t = new TestContext();
        var foreign = t.AddMeter(t.AddProperty(ownerId: Guid.NewGuid()));
        var service = new MeterService(t.Db, t.User);

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetAsync(foreign.Id, CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => service.ListAsync(foreign.PropertyId, CancellationToken.None));
    }
}
