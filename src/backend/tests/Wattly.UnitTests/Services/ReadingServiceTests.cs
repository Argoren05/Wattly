using Wattly.Application.Common;
using Wattly.Application.Metering;
using Wattly.Domain.Metering;
using Wattly.UnitTests.Support;

namespace Wattly.UnitTests.Services;

/// <summary>Tests of <see cref="ReadingService"/>.</summary>
public class ReadingServiceTests
{
    private static readonly DateTimeOffset T0 = new(2026, 10, 1, 0, 0, 0, TimeSpan.Zero);

    private static (TestContext T, ReadingService Service, MeterRegister Register) Setup()
    {
        var t = new TestContext();
        var register = t.AddMeter(t.AddProperty()).Registers[0];
        return (t, new ReadingService(t.Db, t.User, t.Clock), register);
    }

    [Fact]
    public async Task Create_stores_utc_and_returns_consumption_since_previous()
    {
        var (t, service, register) = Setup();
        using var _ = t;
        await service.CreateAsync(register.Id, new ReadingRequest(T0, 100, null, null, null), CancellationToken.None);

        var saved = await service.CreateAsync(register.Id, new ReadingRequest(T0.AddDays(10).ToOffset(TimeSpan.FromHours(2)), 150.5m, null, null, " notatka "), CancellationToken.None);

        Assert.Equal(TimeSpan.Zero, saved.Reading.ReadingAt.Offset);
        Assert.Equal(50.5m, saved.Reading.ConsumptionSincePrevious);
        Assert.Equal(10m, saved.Reading.DaysSincePrevious);
        Assert.Equal("notatka", saved.Reading.Note);
        Assert.Equal(ReadingSource.Manual, saved.Reading.Source);
    }

    [Fact]
    public async Task Future_negative_and_too_precise_values_are_rejected()
    {
        var (t, service, register) = Setup();
        using var _ = t;

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreateAsync(register.Id, new ReadingRequest(t.Clock.Now.AddHours(1), 1, null, null, null), CancellationToken.None));
        await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreateAsync(register.Id, new ReadingRequest(T0, -1, null, null, null), CancellationToken.None));
        await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreateAsync(register.Id, new ReadingRequest(T0, 1.25m, null, null, null), CancellationToken.None));
        await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreateAsync(register.Id, new ReadingRequest(T0, 1, ReadingSource.Integration, null, null), CancellationToken.None));
    }

    [Fact]
    public async Task Duplicate_and_decreasing_readings_are_conflicts()
    {
        var (t, service, register) = Setup();
        using var _ = t;
        await service.CreateAsync(register.Id, new ReadingRequest(T0, 100, null, null, null), CancellationToken.None);

        var duplicate = await Assert.ThrowsAsync<ConflictException>(() => service.CreateAsync(register.Id, new ReadingRequest(T0, 100, null, null, null), CancellationToken.None));
        var lower = await Assert.ThrowsAsync<ConflictException>(() => service.CreateAsync(register.Id, new ReadingRequest(T0.AddDays(1), 99, null, null, null), CancellationToken.None));

        Assert.Equal("reading.duplicate", duplicate.Code);
        Assert.Equal("reading.not_monotonic", lower.Code);
    }

    [Fact]
    public async Task Anomaly_requires_confirmation_and_is_returned_as_warning()
    {
        var (t, service, register) = Setup();
        using var _ = t;
        await service.CreateAsync(register.Id, new ReadingRequest(T0, 100, null, null, null), CancellationToken.None);
        await service.CreateAsync(register.Id, new ReadingRequest(T0.AddDays(10), 150, null, null, null), CancellationToken.None);
        var jump = new ReadingRequest(T0.AddDays(11), 400, null, null, null);

        var error = await Assert.ThrowsAsync<ConflictException>(() => service.CreateAsync(register.Id, jump, CancellationToken.None));
        Assert.Equal("reading.anomaly_requires_confirmation", error.Code);

        var saved = await service.CreateAsync(register.Id, jump with { ConfirmAnomaly = true }, CancellationToken.None);
        Assert.Equal("reading.unusual_jump", Assert.Single(saved.Warnings).Code);
    }

    [Fact]
    public async Task Correction_supersedes_original_and_keeps_history()
    {
        var (t, service, register) = Setup();
        using var _ = t;
        await service.CreateAsync(register.Id, new ReadingRequest(T0, 100, null, null, null), CancellationToken.None);
        var original = await service.CreateAsync(register.Id, new ReadingRequest(T0.AddDays(5), 130, null, null, null), CancellationToken.None);

        var corrected = await service.CorrectAsync(original.Reading.Id, new ReadingRequest(T0.AddDays(5), 120, null, null, null), CancellationToken.None);

        Assert.Equal(original.Reading.Id, corrected.Reading.SupersedesReadingId);
        Assert.Equal(20m, corrected.Reading.ConsumptionSincePrevious);
        Assert.Equal(ReadingStatus.Superseded, (await service.GetAsync(original.Reading.Id, CancellationToken.None)).Status);
        Assert.Equal(2, (await service.ListAsync(register.Id, null, null, false, null, null, CancellationToken.None)).TotalCount);
        Assert.Equal(3, (await service.ListAsync(register.Id, null, null, true, null, null, CancellationToken.None)).TotalCount);

        // A superseded reading can no longer be corrected or voided.
        await Assert.ThrowsAsync<ConflictException>(() => service.CorrectAsync(original.Reading.Id, new ReadingRequest(T0.AddDays(5), 121, null, null, null), CancellationToken.None));
        await Assert.ThrowsAsync<ConflictException>(() => service.VoidAsync(original.Reading.Id, new VoidReadingRequest(null), CancellationToken.None));
    }

    [Fact]
    public async Task Void_marks_reading_and_excludes_it_from_active_list()
    {
        var (t, service, register) = Setup();
        using var _ = t;
        var reading = await service.CreateAsync(register.Id, new ReadingRequest(T0, 100, null, null, null), CancellationToken.None);

        var voided = await service.VoidAsync(reading.Reading.Id, new VoidReadingRequest(" pomyłka "), CancellationToken.None);

        Assert.Equal(ReadingStatus.Voided, voided.Status);
        Assert.Equal("pomyłka", voided.VoidReason);
        Assert.Equal(0, (await service.ListAsync(register.Id, null, null, false, null, null, CancellationToken.None)).TotalCount);
    }

    [Fact]
    public async Task List_pages_newest_first_and_filters_by_date()
    {
        var (t, service, register) = Setup();
        using var _ = t;
        for (var i = 0; i < 5; i++)
            await service.CreateAsync(register.Id, new ReadingRequest(T0.AddDays(i), 100 + i, null, null, null), CancellationToken.None);

        var page = await service.ListAsync(register.Id, null, null, false, 2, 2, CancellationToken.None);
        var filtered = await service.ListAsync(register.Id, T0.AddDays(3), null, false, null, null, CancellationToken.None);

        Assert.Equal(5, page.TotalCount);
        Assert.Equal([102m, 101m], page.Items.Select(r => r.Value));
        Assert.Equal([1m, 1m], page.Items.Select(r => r.ConsumptionSincePrevious!.Value));
        Assert.Equal(2, filtered.TotalCount);
    }

    [Fact]
    public async Task Foreign_register_is_not_found()
    {
        var (t, service, _) = Setup();
        using var __ = t;
        var foreign = t.AddMeter(t.AddProperty(ownerId: Guid.NewGuid())).Registers[0];

        await Assert.ThrowsAsync<NotFoundException>(() => service.CreateAsync(foreign.Id, new ReadingRequest(T0, 1, null, null, null), CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => service.ListAsync(foreign.Id, null, null, false, null, null, CancellationToken.None));
    }
}
