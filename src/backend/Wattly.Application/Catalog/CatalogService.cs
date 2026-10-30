using Microsoft.EntityFrameworkCore;
using Wattly.Application.Common;
using Wattly.Domain.Tariffs;

namespace Wattly.Application.Catalog;

/// <summary>Catalog of operators, suppliers and tariffs. Reads are public for signed-in users, writes require the Admin role.</summary>
public sealed class CatalogService(IWattlyDbContext db, ICurrentUser currentUser)
{
    public async Task<IReadOnlyList<CatalogEntryDto>> ListOperatorsAsync(bool includeInactive, CancellationToken ct) =>
        await db.EnergyOperators.AsNoTracking()
            .Where(o => includeInactive || o.IsActive)
            .OrderBy(o => o.Name)
            .Select(o => new CatalogEntryDto(o.Id, o.Name, o.Code, o.CountryCode, o.IsActive))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<CatalogEntryDto>> ListSuppliersAsync(bool includeInactive, CancellationToken ct) =>
        await db.EnergySuppliers.AsNoTracking()
            .Where(s => includeInactive || s.IsActive)
            .OrderBy(s => s.Name)
            .Select(s => new CatalogEntryDto(s.Id, s.Name, s.Code, s.CountryCode, s.IsActive))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<TariffDto>> ListTariffsAsync(bool includeInactive, CancellationToken ct)
    {
        var tariffs = await db.Tariffs.AsNoTracking().Where(t => includeInactive || t.IsActive).OrderBy(t => t.Code).ToListAsync(ct);
        return tariffs.Select(ToDto).ToList();
    }

    public async Task<TariffDto> GetTariffAsync(Guid id, CancellationToken ct) =>
        ToDto(await db.Tariffs.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct) ?? throw new NotFoundException("Taryfa"));

    public async Task<CatalogEntryDto> CreateOperatorAsync(CatalogEntryRequest request, CancellationToken ct)
    {
        EnsureAdmin();
        var code = ValidateEntry(request);
        if (await db.EnergyOperators.AnyAsync(o => o.Code == code, ct))
            throw new ConflictException("catalog.duplicate_code", "Operator o tym kodzie już istnieje.");

        var entity = new EnergyOperator { Name = request.Name.Trim(), Code = code, CountryCode = Country(request), IsActive = request.IsActive ?? true };
        db.EnergyOperators.Add(entity);
        await db.SaveChangesAsync(ct);
        return new CatalogEntryDto(entity.Id, entity.Name, entity.Code, entity.CountryCode, entity.IsActive);
    }

    public async Task<CatalogEntryDto> UpdateOperatorAsync(Guid id, CatalogEntryRequest request, CancellationToken ct)
    {
        EnsureAdmin();
        var code = ValidateEntry(request);
        var entity = await db.EnergyOperators.FirstOrDefaultAsync(o => o.Id == id, ct) ?? throw new NotFoundException("Operator");
        if (await db.EnergyOperators.AnyAsync(o => o.Code == code && o.Id != id, ct))
            throw new ConflictException("catalog.duplicate_code", "Operator o tym kodzie już istnieje.");

        entity.Name = request.Name.Trim();
        entity.Code = code;
        entity.CountryCode = Country(request);
        entity.IsActive = request.IsActive ?? entity.IsActive;
        await db.SaveChangesAsync(ct);
        return new CatalogEntryDto(entity.Id, entity.Name, entity.Code, entity.CountryCode, entity.IsActive);
    }

    public async Task<CatalogEntryDto> CreateSupplierAsync(CatalogEntryRequest request, CancellationToken ct)
    {
        EnsureAdmin();
        var code = ValidateEntry(request);
        if (await db.EnergySuppliers.AnyAsync(s => s.Code == code, ct))
            throw new ConflictException("catalog.duplicate_code", "Sprzedawca o tym kodzie już istnieje.");

        var entity = new EnergySupplier { Name = request.Name.Trim(), Code = code, CountryCode = Country(request), IsActive = request.IsActive ?? true };
        db.EnergySuppliers.Add(entity);
        await db.SaveChangesAsync(ct);
        return new CatalogEntryDto(entity.Id, entity.Name, entity.Code, entity.CountryCode, entity.IsActive);
    }

    public async Task<CatalogEntryDto> UpdateSupplierAsync(Guid id, CatalogEntryRequest request, CancellationToken ct)
    {
        EnsureAdmin();
        var code = ValidateEntry(request);
        var entity = await db.EnergySuppliers.FirstOrDefaultAsync(s => s.Id == id, ct) ?? throw new NotFoundException("Sprzedawca");
        if (await db.EnergySuppliers.AnyAsync(s => s.Code == code && s.Id != id, ct))
            throw new ConflictException("catalog.duplicate_code", "Sprzedawca o tym kodzie już istnieje.");

        entity.Name = request.Name.Trim();
        entity.Code = code;
        entity.CountryCode = Country(request);
        entity.IsActive = request.IsActive ?? entity.IsActive;
        await db.SaveChangesAsync(ct);
        return new CatalogEntryDto(entity.Id, entity.Name, entity.Code, entity.CountryCode, entity.IsActive);
    }

    public async Task<TariffDto> CreateTariffAsync(TariffRequest request, CancellationToken ct)
    {
        EnsureAdmin();
        var code = ValidateTariff(request);
        if (await db.Tariffs.AnyAsync(t => t.Code == code, ct))
            throw new ConflictException("catalog.duplicate_code", "Taryfa o tym kodzie już istnieje.");

        var tariff = new Tariff { Code = code, Name = string.Empty };
        ApplyTariff(tariff, request, code);
        db.Tariffs.Add(tariff);
        await db.SaveChangesAsync(ct);
        return ToDto(tariff);
    }

    public async Task<TariffDto> UpdateTariffAsync(Guid id, TariffRequest request, CancellationToken ct)
    {
        EnsureAdmin();
        var code = ValidateTariff(request);
        var tariff = await db.Tariffs.FirstOrDefaultAsync(t => t.Id == id, ct) ?? throw new NotFoundException("Taryfa");
        if (await db.Tariffs.AnyAsync(t => t.Code == code && t.Id != id, ct))
            throw new ConflictException("catalog.duplicate_code", "Taryfa o tym kodzie już istnieje.");

        ApplyTariff(tariff, request, code);
        await db.SaveChangesAsync(ct);
        return ToDto(tariff);
    }

    internal static TariffDto ToDto(Tariff t) => new(
        t.Id, t.Code, t.Name, t.Description, t.IsActive,
        t.Zones.Select(z => new TariffZoneDto(z.Code, z.Name, z.ScheduleDescription)).ToList());

    private void EnsureAdmin()
    {
        if (!currentUser.IsAdmin)
            throw new ForbiddenException();
    }

    private static string Country(CatalogEntryRequest request) =>
        (Validation.Clean(request.CountryCode) ?? "PL").ToUpperInvariant();

    private static string ValidateEntry(CatalogEntryRequest request)
    {
        var code = (request.Code ?? string.Empty).Trim().ToUpperInvariant();
        new Validation()
            .RequireText(request.Name, nameof(request.Name), 200)
            .Require(Codes.Identifier().IsMatch(code), nameof(request.Code), "Kod może zawierać wielkie litery, cyfry, '_' i '-' (maks. 32 znaki).")
            .Require(Codes.CountryCode().IsMatch(Country(request)), nameof(request.CountryCode), "Nieprawidłowy kod kraju.")
            .ThrowIfInvalid();
        return code;
    }

    private static string ValidateTariff(TariffRequest request)
    {
        var code = (request.Code ?? string.Empty).Trim().ToUpperInvariant();
        var zones = request.Zones ?? [];
        var validation = new Validation()
            .Require(Codes.Identifier().IsMatch(code), nameof(request.Code), "Nieprawidłowy kod taryfy.")
            .RequireText(request.Name, nameof(request.Name), 100)
            .RequireText(request.Description, nameof(request.Description), 1000, required: false)
            .Require(zones.Count != 1, nameof(request.Zones), "Taryfa strefowa musi mieć co najmniej dwie strefy; taryfa jednostrefowa nie ma stref.")
            .Require(zones.Select(z => z.Code?.Trim().ToUpperInvariant()).Distinct().Count() == zones.Count, nameof(request.Zones), "Kody stref muszą być unikalne.");

        for (var i = 0; i < zones.Count; i++)
        {
            validation
                .Require(Codes.Identifier().IsMatch(zones[i].Code?.Trim().ToUpperInvariant() ?? string.Empty), $"Zones[{i}].Code", "Nieprawidłowy kod strefy.")
                .RequireText(zones[i].Name, $"Zones[{i}].Name", 100)
                .RequireText(zones[i].ScheduleDescription, $"Zones[{i}].ScheduleDescription", 500, required: false);
        }

        validation.ThrowIfInvalid();
        return code;
    }

    private static void ApplyTariff(Tariff tariff, TariffRequest request, string code)
    {
        tariff.Code = code;
        tariff.Name = request.Name.Trim();
        tariff.Description = Validation.Clean(request.Description);
        tariff.IsActive = request.IsActive ?? tariff.IsActive;
        tariff.Zones = (request.Zones ?? [])
            .Select(z => new TariffZone { Code = z.Code.Trim().ToUpperInvariant(), Name = z.Name.Trim(), ScheduleDescription = Validation.Clean(z.ScheduleDescription) })
            .ToList();
    }
}
