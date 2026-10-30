using Microsoft.EntityFrameworkCore;
using Wattly.Application.Common;
using Wattly.Domain.Metering;

namespace Wattly.Application.Metering;

/// <summary>Meters and registers of properties.</summary>
/// <param name="db">Database context.</param>
/// <param name="currentUser">Signed-in user.</param>
public sealed class MeterService(IWattlyDbContext db, ICurrentUser currentUser)
{
    /// <summary>Maximum number of registers per meter.</summary>
    public const int MaxRegistersPerMeter = 8;

    /// <summary>Meters of a property, active first.</summary>
    /// <param name="propertyId">Property.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<IReadOnlyList<MeterDto>> ListAsync(Guid propertyId, CancellationToken ct)
    {
        await db.EnsurePropertyAccessAsync(currentUser.UserId, propertyId, ct);
        var meters = await db.Meters.AsNoTracking().Include(m => m.Registers)
            .Where(m => m.PropertyId == propertyId)
            .OrderByDescending(m => m.IsActive).ThenBy(m => m.Name)
            .ToListAsync(ct);
        return meters.Select(ToDto).ToList();
    }

    /// <summary>One meter.</summary>
    /// <param name="meterId">Meter.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<MeterDto> GetAsync(Guid meterId, CancellationToken ct) => ToDto(await LoadAsync(meterId, ct, tracking: false));

    /// <summary>Creates a meter with registers (default: one import register).</summary>
    /// <param name="propertyId">Property.</param>
    /// <param name="request">Data.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<MeterDto> CreateAsync(Guid propertyId, MeterRequest request, CancellationToken ct)
    {
        await db.EnsurePropertyAccessAsync(currentUser.UserId, propertyId, ct);

        var registers = request.Registers is { Count: > 0 }
            ? request.Registers
            : [new RegisterRequest("Pobór", RegisterType.Import, null, "1.8.0", 1)];

        var validation = ValidateMeter(request);
        validation.Require(registers.Count <= MaxRegistersPerMeter, nameof(request.Registers), $"Licznik może mieć maksymalnie {MaxRegistersPerMeter} rejestrów.");
        for (var i = 0; i < registers.Count; i++)
            ValidateRegister(validation, registers[i], request.Directionality, $"Registers[{i}]");
        ValidateRegisterSet(validation, registers);
        validation.ThrowIfInvalid();

        var meter = new Meter { PropertyId = propertyId, Name = string.Empty };
        ApplyMeter(meter, request);
        meter.Registers = registers.Select(ToEntity).ToList();
        db.Meters.Add(meter);
        await db.SaveChangesAsync(ct);
        return ToDto(meter);
    }

    /// <summary>Updates meter attributes (registers are managed separately).</summary>
    /// <param name="meterId">Meter.</param>
    /// <param name="request">Data.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<MeterDto> UpdateAsync(Guid meterId, MeterRequest request, CancellationToken ct)
    {
        var meter = await LoadAsync(meterId, ct, tracking: true);
        var validation = ValidateMeter(request);
        validation.Require(request.Directionality == MeterDirectionality.Bidirectional || meter.Registers.All(r => r.RegisterType == RegisterType.Import),
            nameof(request.Directionality), "Licznik ma rejestr oddawania energii – musi pozostać dwukierunkowy.");
        validation.ThrowIfInvalid();

        ApplyMeter(meter, request);
        await db.SaveChangesAsync(ct);
        return ToDto(meter);
    }

    /// <summary>Registers of a meter.</summary>
    /// <param name="meterId">Meter.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<IReadOnlyList<RegisterDto>> ListRegistersAsync(Guid meterId, CancellationToken ct) =>
        (await LoadAsync(meterId, ct, tracking: false)).Registers.Select(ToDto).ToList();

    /// <summary>Adds a register to a meter.</summary>
    /// <param name="meterId">Meter.</param>
    /// <param name="request">Register.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<RegisterDto> AddRegisterAsync(Guid meterId, RegisterRequest request, CancellationToken ct)
    {
        var meter = await LoadAsync(meterId, ct, tracking: true);
        var validation = new Validation()
            .Require(meter.Registers.Count < MaxRegistersPerMeter, nameof(meterId), $"Licznik może mieć maksymalnie {MaxRegistersPerMeter} rejestrów.");
        ValidateRegister(validation, request, meter.Directionality, string.Empty);
        ValidateRegisterSet(validation, [.. meter.Registers.Select(r => new RegisterRequest(r.Name, r.RegisterType, r.ZoneCode, r.Code, r.DecimalPlaces)), request]);
        validation.ThrowIfInvalid();

        var register = ToEntity(request);
        register.MeterId = meter.Id;
        db.MeterRegisters.Add(register);
        await db.SaveChangesAsync(ct);
        return ToDto(register);
    }

    /// <summary>Loads an owned meter with registers or throws NotFound.</summary>
    private async Task<Meter> LoadAsync(Guid meterId, CancellationToken ct, bool tracking)
    {
        var query = db.Meters.Include(m => m.Registers).OwnedBy(currentUser.UserId);
        if (!tracking)
            query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(m => m.Id == meterId, ct) ?? throw new NotFoundException("Licznik");
    }

    /// <summary>Validates meter attributes.</summary>
    private static Validation ValidateMeter(MeterRequest request) => new Validation()
        .RequireText(request.Name, nameof(request.Name), 100)
        .RequireText(request.SerialNumber, nameof(request.SerialNumber), 64, required: false)
        .Require(Enum.IsDefined(request.MeterType), nameof(request.MeterType), "Nieznany typ licznika.")
        .Require(Enum.IsDefined(request.Directionality), nameof(request.Directionality), "Nieznany kierunek pracy licznika.")
        .Require(request.RemovedAt is null || request.InstalledAt is null || request.RemovedAt >= request.InstalledAt,
            nameof(request.RemovedAt), "Data demontażu nie może być wcześniejsza niż data montażu.");

    /// <summary>Validates one register (export registers need a bidirectional meter).</summary>
    private static void ValidateRegister(Validation validation, RegisterRequest r, MeterDirectionality directionality, string prefix)
    {
        string Field(string name) => string.IsNullOrEmpty(prefix) ? name : $"{prefix}.{name}";
        var zone = Validation.Clean(r.ZoneCode)?.ToUpperInvariant();

        validation
            .RequireText(r.Name, Field(nameof(r.Name)), 100)
            .RequireText(r.Code, Field(nameof(r.Code)), 32, required: false)
            .Require(Enum.IsDefined(r.RegisterType), Field(nameof(r.RegisterType)), "Nieznany typ rejestru.")
            .Require(r.DecimalPlaces is null or >= 0 and <= 4, Field(nameof(r.DecimalPlaces)), "Liczba miejsc po przecinku musi być z zakresu 0–4.")
            .Require(zone is null || Codes.Identifier().IsMatch(zone), Field(nameof(r.ZoneCode)), "Nieprawidłowy kod strefy.")
            .Require(r.RegisterType == RegisterType.Import || directionality == MeterDirectionality.Bidirectional,
                Field(nameof(r.RegisterType)), "Rejestr oddawania energii wymaga licznika dwukierunkowego.");
    }

    /// <summary>Validates the register set: unique type/zone pairs and zones for every import register of multi-zone meters.</summary>
    private static void ValidateRegisterSet(Validation validation, IReadOnlyList<RegisterRequest> registers)
    {
        var keys = registers.Select(r => (r.RegisterType, Zone: Validation.Clean(r.ZoneCode)?.ToUpperInvariant())).ToList();
        validation.Require(keys.Distinct().Count() == keys.Count, "Registers", "Każda kombinacja typu rejestru i strefy może wystąpić tylko raz.");

        var importZones = keys.Where(k => k.RegisterType == RegisterType.Import).Select(k => k.Zone).ToList();
        validation.Require(importZones.Count <= 1 || importZones.All(z => z is not null), "Registers",
            "Licznik wielostrefowy wymaga wskazania strefy dla każdego rejestru poboru.");
    }

    /// <summary>Copies request values to the meter.</summary>
    private static void ApplyMeter(Meter meter, MeterRequest request)
    {
        meter.Name = request.Name.Trim();
        meter.SerialNumber = Validation.Clean(request.SerialNumber);
        meter.MeterType = request.MeterType;
        meter.Directionality = request.Directionality;
        meter.InstalledAt = request.InstalledAt;
        meter.RemovedAt = request.RemovedAt;
        meter.IsActive = request.IsActive ?? meter.IsActive;
    }

    /// <summary>Creates a register entity from a request.</summary>
    private static MeterRegister ToEntity(RegisterRequest r) => new()
    {
        Name = r.Name.Trim(),
        RegisterType = r.RegisterType,
        ZoneCode = Validation.Clean(r.ZoneCode)?.ToUpperInvariant(),
        Code = Validation.Clean(r.Code),
        DecimalPlaces = r.DecimalPlaces ?? 1,
    };

    /// <summary>Maps a register.</summary>
    internal static RegisterDto ToDto(MeterRegister r) => new(r.Id, r.MeterId, r.Code, r.Name, r.RegisterType, r.ZoneCode, r.Unit, r.DecimalPlaces);

    /// <summary>Maps a meter with sorted registers.</summary>
    private static MeterDto ToDto(Meter m) => new(
        m.Id, m.PropertyId, m.Name, m.SerialNumber, m.MeterType, m.Directionality, m.InstalledAt, m.RemovedAt, m.IsActive,
        m.Registers.OrderBy(r => r.RegisterType).ThenBy(r => r.ZoneCode).Select(ToDto).ToList());
}
