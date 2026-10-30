using Microsoft.EntityFrameworkCore;
using Wattly.Application.Common;
using Wattly.Domain.Calculations;
using Wattly.Domain.Metering;

namespace Wattly.Application.Metering;

/// <summary>Meter readings: listing, entry with validation, corrections and cancellations.</summary>
/// <param name="db">Database context.</param>
/// <param name="currentUser">Signed-in user.</param>
/// <param name="clock">Time source.</param>
public sealed class ReadingService(IWattlyDbContext db, ICurrentUser currentUser, TimeProvider clock)
{
    /// <summary>Tolerance for clock differences between device and server.</summary>
    private static readonly TimeSpan FutureTolerance = TimeSpan.FromMinutes(10);

    /// <summary>Readings of a register, newest first, with consumption since the previous active reading.</summary>
    /// <param name="registerId">Register.</param>
    /// <param name="from">Optional start.</param>
    /// <param name="to">Optional end.</param>
    /// <param name="includeInactive">Include superseded and voided readings.</param>
    /// <param name="page">Page.</param>
    /// <param name="pageSize">Page size.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<PagedResult<ReadingDto>> ListAsync(
        Guid registerId, DateTimeOffset? from, DateTimeOffset? to, bool includeInactive, int? page, int? pageSize, CancellationToken ct)
    {
        var register = await LoadRegisterAsync(registerId, ct);
        var (p, size) = Paging.Normalize(page, pageSize);

        var query = db.MeterReadings.AsNoTracking().Where(r => r.MeterRegisterId == registerId);
        if (!includeInactive)
            query = query.Where(r => r.Status == ReadingStatus.Active);
        if (from is { } f)
            query = query.Where(r => r.ReadingAt >= f.ToUniversalTime());
        if (to is { } t)
            query = query.Where(r => r.ReadingAt <= t.ToUniversalTime());

        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(r => r.ReadingAt).ThenByDescending(r => r.CreatedAt)
            .Skip((p - 1) * size).Take(size).ToListAsync(ct);

        if (items.Count == 0)
            return new PagedResult<ReadingDto>([], p, size, total);

        // Differences are always computed against the previous *active* reading.
        var oldest = items.Min(r => r.ReadingAt);
        var newest = items.Max(r => r.ReadingAt);
        var previousAt = await db.MeterReadings
            .Where(r => r.MeterRegisterId == registerId && r.Status == ReadingStatus.Active && r.ReadingAt < oldest)
            .MaxAsync(r => (DateTimeOffset?)r.ReadingAt, ct);
        var lowerBound = previousAt ?? oldest;
        var activeContext = await db.MeterReadings.AsNoTracking()
            .Where(r => r.MeterRegisterId == registerId && r.Status == ReadingStatus.Active && r.ReadingAt >= lowerBound && r.ReadingAt <= newest)
            .OrderBy(r => r.ReadingAt)
            .Select(r => new ReadingPoint(r.ReadingAt, r.Value))
            .ToListAsync(ct);

        return new PagedResult<ReadingDto>(items.Select(r => ToDto(r, register, activeContext)).ToList(), p, size, total);
    }

    /// <summary>One reading.</summary>
    /// <param name="readingId">Reading.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<ReadingDto> GetAsync(Guid readingId, CancellationToken ct)
    {
        var reading = await db.MeterReadings.AsNoTracking().Include(r => r.MeterRegister).OwnedBy(currentUser.UserId)
            .FirstOrDefaultAsync(r => r.Id == readingId, ct) ?? throw new NotFoundException("Odczyt");
        var context = await ActivePointsAsync(reading.MeterRegisterId, excludeId: null, ct);
        return ToDto(reading, reading.MeterRegister, context);
    }

    /// <summary>Adds a reading after validation; unusual jumps require <c>ConfirmAnomaly</c>.</summary>
    /// <param name="registerId">Register.</param>
    /// <param name="request">Reading.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<ReadingSavedDto> CreateAsync(Guid registerId, ReadingRequest request, CancellationToken ct)
    {
        var register = await LoadRegisterAsync(registerId, ct);
        var existing = await ActivePointsAsync(registerId, excludeId: null, ct);
        var warnings = Validate(request, register, existing);

        var reading = NewReading(registerId, request);
        db.MeterReadings.Add(reading);
        await db.SaveChangesAsync(ct);

        existing.Add(new ReadingPoint(reading.ReadingAt, reading.Value));
        return new ReadingSavedDto(ToDto(reading, register, existing), warnings);
    }

    /// <summary>Correction: the original reading is kept as <see cref="ReadingStatus.Superseded"/> and a new one replaces it.</summary>
    /// <param name="readingId">Reading to correct.</param>
    /// <param name="request">Corrected values.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<ReadingSavedDto> CorrectAsync(Guid readingId, ReadingRequest request, CancellationToken ct)
    {
        var original = await db.MeterReadings.Include(r => r.MeterRegister).OwnedBy(currentUser.UserId)
            .FirstOrDefaultAsync(r => r.Id == readingId, ct) ?? throw new NotFoundException("Odczyt");
        if (original.Status != ReadingStatus.Active)
            throw new ConflictException("reading.not_active", "Można korygować tylko aktywny odczyt.");

        var existing = await ActivePointsAsync(original.MeterRegisterId, excludeId: original.Id, ct);
        var warnings = Validate(request, original.MeterRegister, existing);

        var now = clock.GetUtcNow();
        original.Status = ReadingStatus.Superseded;
        original.StatusChangedAt = now;

        var correction = NewReading(original.MeterRegisterId, request);
        correction.SupersedesReadingId = original.Id;
        correction.ImageAttachmentId = original.ImageAttachmentId;
        db.MeterReadings.Add(correction);
        await db.SaveChangesAsync(ct);

        existing.Add(new ReadingPoint(correction.ReadingAt, correction.Value));
        return new ReadingSavedDto(ToDto(correction, original.MeterRegister, existing), warnings);
    }

    /// <summary>Cancels an active reading (kept for audit).</summary>
    /// <param name="readingId">Reading.</param>
    /// <param name="request">Optional reason.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<ReadingDto> VoidAsync(Guid readingId, VoidReadingRequest request, CancellationToken ct)
    {
        var reading = await db.MeterReadings.Include(r => r.MeterRegister).OwnedBy(currentUser.UserId)
            .FirstOrDefaultAsync(r => r.Id == readingId, ct) ?? throw new NotFoundException("Odczyt");
        if (reading.Status != ReadingStatus.Active)
            throw new ConflictException("reading.not_active", "Odczyt został już anulowany lub skorygowany.");

        new Validation().RequireText(request.Reason, nameof(request.Reason), 500, required: false).ThrowIfInvalid();

        reading.Status = ReadingStatus.Voided;
        reading.VoidReason = Validation.Clean(request.Reason);
        reading.StatusChangedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);

        var context = await ActivePointsAsync(reading.MeterRegisterId, excludeId: null, ct);
        return ToDto(reading, reading.MeterRegister, context);
    }

    /// <summary>Validates input and domain rules; throws for blocking issues and unconfirmed anomalies.</summary>
    private List<ReadingWarningDto> Validate(ReadingRequest request, MeterRegister register, IReadOnlyCollection<ReadingPoint> existing)
    {
        var now = clock.GetUtcNow();
        var at = request.ReadingAt.ToUniversalTime();
        var source = request.Source ?? ReadingSource.Manual;

        new Validation()
            .Require(request.ReadingAt != default, nameof(request.ReadingAt), "Data odczytu jest wymagana.")
            .Require(at <= now + FutureTolerance, nameof(request.ReadingAt), "Data odczytu nie może być z przyszłości.")
            .Require(request.Value >= 0, nameof(request.Value), "Wartość wskazania nie może być ujemna.")
            .Require(request.Value < 100_000_000m, nameof(request.Value), "Wartość wskazania jest zbyt duża.")
            .Require(decimal.Round(request.Value, register.DecimalPlaces) == request.Value, nameof(request.Value),
                $"Rejestr przyjmuje maksymalnie {register.DecimalPlaces} miejsc po przecinku.")
            .Require(Enum.IsDefined(source), nameof(request.Source), "Nieznane źródło odczytu.")
            .Require(source is ReadingSource.Manual or ReadingSource.Ocr, nameof(request.Source), "Ręcznie można dodać tylko odczyt ręczny lub potwierdzony odczyt OCR.")
            .Require(request.Confidence is null or >= 0 and <= 1, nameof(request.Confidence), "Pewność musi być z zakresu 0–1.")
            .RequireText(request.Note, nameof(request.Note), 500, required: false)
            .ThrowIfInvalid();

        var issues = ReadingRules.Check(existing, at, request.Value);
        var blocking = issues.FirstOrDefault(i => i.IsBlocking);
        if (blocking is not null)
        {
            var code = blocking.Type == ReadingIssueType.Duplicate ? "reading.duplicate" : "reading.not_monotonic";
            throw new ConflictException(code, blocking.Message);
        }

        var warnings = issues.Select(i => new ReadingWarningDto("reading.unusual_jump", i.Message)).ToList();
        if (warnings.Count > 0 && !request.ConfirmAnomaly)
            throw new ConflictException("reading.anomaly_requires_confirmation",
                warnings[0].Message + " Aby zapisać mimo to, potwierdź odczyt (confirmAnomaly = true).");

        return warnings;
    }

    /// <summary>Creates a reading entity (instants normalised to UTC).</summary>
    private MeterReading NewReading(Guid registerId, ReadingRequest request) => new()
    {
        MeterRegisterId = registerId,
        ReadingAt = request.ReadingAt.ToUniversalTime(),
        Value = request.Value,
        Source = request.Source ?? ReadingSource.Manual,
        Confidence = request.Confidence,
        Note = Validation.Clean(request.Note),
        CreatedByUserId = currentUser.UserId,
        CreatedAt = clock.GetUtcNow(),
    };

    /// <summary>Loads an owned register or throws NotFound.</summary>
    private async Task<MeterRegister> LoadRegisterAsync(Guid registerId, CancellationToken ct) =>
        await db.MeterRegisters.AsNoTracking().OwnedBy(currentUser.UserId).FirstOrDefaultAsync(r => r.Id == registerId, ct)
        ?? throw new NotFoundException("Rejestr licznika");

    /// <summary>Active readings of a register as points, optionally excluding one reading.</summary>
    private async Task<List<ReadingPoint>> ActivePointsAsync(Guid registerId, Guid? excludeId, CancellationToken ct) =>
        await db.MeterReadings.AsNoTracking()
            .Where(r => r.MeterRegisterId == registerId && r.Status == ReadingStatus.Active && r.Id != excludeId)
            .OrderBy(r => r.ReadingAt)
            .Select(r => new ReadingPoint(r.ReadingAt, r.Value))
            .ToListAsync(ct);

    /// <summary>Maps a reading and computes the difference to the previous active reading.</summary>
    private static ReadingDto ToDto(MeterReading r, MeterRegister register, IReadOnlyList<ReadingPoint> activePoints)
    {
        decimal? consumption = null;
        decimal? days = null;
        if (r.Status == ReadingStatus.Active)
        {
            var previous = activePoints.Where(p => p.At < r.ReadingAt).Select(p => (ReadingPoint?)p).LastOrDefault();
            if (previous is { } prev)
            {
                consumption = r.Value - prev.Value;
                days = Math.Round((decimal)(r.ReadingAt - prev.At).Ticks / TimeSpan.TicksPerDay, 2);
            }
        }

        return new ReadingDto(r.Id, r.MeterRegisterId, r.ReadingAt, r.Value, register.Unit, r.Source, r.Confidence, r.Note,
            r.Status, r.SupersedesReadingId, r.VoidReason, r.CreatedAt, consumption, days);
    }
}
