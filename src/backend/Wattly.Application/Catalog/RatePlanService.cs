using Microsoft.EntityFrameworkCore;
using Wattly.Application.Common;
using Wattly.Domain.Tariffs;

namespace Wattly.Application.Catalog;

/// <summary>
/// Price lists. Catalog plans are managed by administrators; users may enter their own rates for a property
/// (e.g. copied from an invoice). Plans are immutable – only the end of validity can be set, so history is preserved.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="currentUser">Signed-in user.</param>
/// <param name="clock">Time source.</param>
public sealed class RatePlanService(IWattlyDbContext db, ICurrentUser currentUser, TimeProvider clock)
{
    /// <summary>Catalog rate plans of a tariff, newest first.</summary>
    /// <param name="tariffId">Tariff.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<IReadOnlyList<RatePlanDto>> ListCatalogAsync(Guid tariffId, CancellationToken ct)
    {
        if (!await db.Tariffs.AnyAsync(t => t.Id == tariffId, ct))
            throw new NotFoundException("Taryfa");

        var plans = await Query().Where(p => p.TariffId == tariffId && p.PropertyId == null).OrderByDescending(p => p.ValidFrom).ToListAsync(ct);
        return plans.Select(ToDto).ToList();
    }

    /// <summary>User's own rate plans of a property.</summary>
    /// <param name="propertyId">Property.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<IReadOnlyList<RatePlanDto>> ListForPropertyAsync(Guid propertyId, CancellationToken ct)
    {
        await db.EnsurePropertyAccessAsync(currentUser.UserId, propertyId, ct);
        var plans = await Query().Where(p => p.PropertyId == propertyId).OrderByDescending(p => p.ValidFrom).ToListAsync(ct);
        return plans.Select(ToDto).ToList();
    }

    /// <summary>Returns a rate plan the user may read.</summary>
    /// <param name="id">Rate plan.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<RatePlanDto> GetAsync(Guid id, CancellationToken ct)
    {
        var plan = await Query().FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new NotFoundException("Cennik");
        await EnsureCanReadAsync(plan, ct);
        return ToDto(plan);
    }

    /// <summary>Creates a catalog rate plan (Admin).</summary>
    /// <param name="request">Plan.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<RatePlanDto> CreateCatalogPlanAsync(RatePlanRequest request, CancellationToken ct)
    {
        if (!currentUser.IsAdmin)
            throw new ForbiddenException();
        return await CreateAsync(request, propertyId: null, ct);
    }

    /// <summary>Creates the user's own rate plan for a property.</summary>
    /// <param name="propertyId">Property.</param>
    /// <param name="request">Plan.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<RatePlanDto> CreatePropertyPlanAsync(Guid propertyId, RatePlanRequest request, CancellationToken ct)
    {
        await db.EnsurePropertyAccessAsync(currentUser.UserId, propertyId, ct);
        return await CreateAsync(request, propertyId, ct);
    }

    /// <summary>Shortens the validity of a plan (the only allowed modification).</summary>
    /// <param name="id">Rate plan.</param>
    /// <param name="request">New last day.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<RatePlanDto> EndAsync(Guid id, EndRatePlanRequest request, CancellationToken ct)
    {
        var plan = await db.TariffRatePlans.FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new NotFoundException("Cennik");
        await EnsureCanModifyAsync(plan, ct);

        new Validation()
            .Require(request.ValidTo >= plan.ValidFrom, nameof(request.ValidTo), "Data końca nie może być wcześniejsza niż początek obowiązywania.")
            .Require(plan.ValidTo is null || request.ValidTo <= plan.ValidTo, nameof(request.ValidTo), "Okres obowiązywania można jedynie skrócić.")
            .ThrowIfInvalid();

        plan.ValidTo = request.ValidTo;
        await db.SaveChangesAsync(ct);
        return ToDto(await Query().FirstAsync(p => p.Id == id, ct));
    }

    /// <summary>Validates and stores a plan; rejects overlaps within the same scope.</summary>
    private async Task<RatePlanDto> CreateAsync(RatePlanRequest request, Guid? propertyId, CancellationToken ct)
    {
        var tariff = await db.Tariffs.AsNoTracking().FirstOrDefaultAsync(t => t.Id == request.TariffId, ct);
        var currency = (Validation.Clean(request.CurrencyCode) ?? "PLN").ToUpperInvariant();
        var components = request.Components ?? [];

        var validation = new Validation()
            .Require(tariff is not null, nameof(request.TariffId), "Wybrana taryfa nie istnieje.")
            .RequireText(request.Name, nameof(request.Name), 200)
            .RequireText(request.SourceReference, nameof(request.SourceReference), 500)
            .Require(request.ValidTo is null || request.ValidTo >= request.ValidFrom, nameof(request.ValidTo), "Data końca musi być późniejsza lub równa dacie początku.")
            .Require(Codes.CurrencyCode().IsMatch(currency), nameof(request.CurrencyCode), "Nieprawidłowy kod waluty.")
            .Require(components.Count is > 0 and <= 50, nameof(request.Components), "Cennik musi zawierać od 1 do 50 składników.");
        if (request.SupplierId is { } supplierId)
            validation.Require(await db.EnergySuppliers.AnyAsync(s => s.Id == supplierId, ct), nameof(request.SupplierId), "Wybrany sprzedawca nie istnieje.");
        if (request.OperatorId is { } operatorId)
            validation.Require(await db.EnergyOperators.AnyAsync(o => o.Id == operatorId, ct), nameof(request.OperatorId), "Wybrany operator nie istnieje.");

        var zoneCodes = tariff?.Zones.Select(z => z.Code).ToHashSet(StringComparer.Ordinal) ?? [];
        for (var i = 0; i < components.Count; i++)
            ValidateComponent(validation, components[i], $"Components[{i}]", zoneCodes);
        validation.ThrowIfInvalid();

        var sameScope = await db.TariffRatePlans
            .Where(p => p.TariffId == request.TariffId && p.SupplierId == request.SupplierId && p.OperatorId == request.OperatorId && p.PropertyId == propertyId)
            .ToListAsync(ct);
        var overlapping = sameScope.FirstOrDefault(p => p.Overlaps(request.ValidFrom, request.ValidTo));
        if (overlapping is not null)
            throw new ConflictException("rate_plan.overlap",
                $"Cennik „{overlapping.Name}” ({overlapping.ValidFrom:yyyy-MM-dd} – {overlapping.ValidTo?.ToString("yyyy-MM-dd") ?? "bezterminowo"}) obowiązuje w tym samym okresie. Najpierw zakończ jego obowiązywanie.");

        var plan = new TariffRatePlan
        {
            TariffId = request.TariffId,
            SupplierId = request.SupplierId,
            OperatorId = request.OperatorId,
            PropertyId = propertyId,
            Name = request.Name.Trim(),
            ValidFrom = request.ValidFrom,
            ValidTo = request.ValidTo,
            CurrencyCode = currency,
            SourceReference = request.SourceReference.Trim(),
            PublishedAt = request.PublishedAt,
            CreatedAt = clock.GetUtcNow(),
            Components = components.Select(c => new TariffRateComponent
            {
                ComponentType = c.ComponentType,
                Name = c.Name.Trim(),
                ZoneCode = Validation.Clean(c.ZoneCode)?.ToUpperInvariant(),
                Unit = c.Unit,
                NetRate = c.NetRate,
                TaxRate = c.TaxRate,
            }).ToList(),
        };

        db.TariffRatePlans.Add(plan);
        await db.SaveChangesAsync(ct);
        return ToDto(await Query().FirstAsync(p => p.Id == plan.Id, ct));
    }

    /// <summary>Validates one component: rates, VAT, unit allowed for the type and zone of the tariff.</summary>
    private static void ValidateComponent(Validation validation, RateComponentRequest c, string prefix, IReadOnlySet<string> zoneCodes)
    {
        var zone = Validation.Clean(c.ZoneCode)?.ToUpperInvariant();
        var allowedUnits = AllowedUnits(c.ComponentType);

        validation
            .Require(Enum.IsDefined(c.ComponentType), $"{prefix}.ComponentType", "Nieznany typ składnika.")
            .Require(Enum.IsDefined(c.Unit), $"{prefix}.Unit", "Nieznana jednostka.")
            .RequireText(c.Name, $"{prefix}.Name", 200)
            .Require(c.NetRate is >= 0 and < 1_000_000, $"{prefix}.NetRate", "Stawka netto musi być nieujemna.")
            .Require(c.TaxRate is >= 0 and <= 1, $"{prefix}.TaxRate", "Stawka podatku musi być ułamkiem z zakresu 0–1 (np. 0.23).")
            .Require(allowedUnits.Contains(c.Unit), $"{prefix}.Unit", $"Dla tego typu składnika dozwolone jednostki to: {string.Join(", ", allowedUnits)}.")
            .Require(zone is null || c.Unit == RateUnit.Kwh, $"{prefix}.ZoneCode", "Strefę można wskazać tylko dla składników rozliczanych za kWh.")
            .Require(zone is null || zoneCodes.Contains(zone), $"{prefix}.ZoneCode", "Taryfa nie zawiera wskazanej strefy.");
    }

    /// <summary>Units allowed for a component type.</summary>
    private static RateUnit[] AllowedUnits(RateComponentType type) => type switch
    {
        RateComponentType.Energy or RateComponentType.VariableDistribution => [RateUnit.Kwh],
        RateComponentType.FixedDistribution or RateComponentType.Subscription => [RateUnit.Month, RateUnit.Day],
        RateComponentType.Capacity => [RateUnit.Month, RateUnit.Kwh, RateUnit.Kw],
        _ => [RateUnit.Kwh, RateUnit.Month, RateUnit.Day, RateUnit.Kw],
    };

    /// <summary>Own plans are readable only by the property owner; catalog plans by everyone.</summary>
    private async Task EnsureCanReadAsync(TariffRatePlan plan, CancellationToken ct)
    {
        if (plan.PropertyId is { } propertyId)
            await db.EnsurePropertyAccessAsync(currentUser.UserId, propertyId, ct);
    }

    /// <summary>Own plans: property owner; catalog plans: administrators.</summary>
    private async Task EnsureCanModifyAsync(TariffRatePlan plan, CancellationToken ct)
    {
        if (plan.PropertyId is { } propertyId)
            await db.EnsurePropertyAccessAsync(currentUser.UserId, propertyId, ct);
        else if (!currentUser.IsAdmin)
            throw new ForbiddenException();
    }

    /// <summary>Read-only query including tariff and components.</summary>
    private IQueryable<TariffRatePlan> Query() =>
        db.TariffRatePlans.AsNoTracking().Include(p => p.Tariff).Include(p => p.Components);

    /// <summary>Maps a plan to its DTO with sorted components.</summary>
    internal static RatePlanDto ToDto(TariffRatePlan p) => new(
        p.Id, p.TariffId, p.Tariff.Code, p.SupplierId, p.OperatorId, p.PropertyId, p.Name, p.ValidFrom, p.ValidTo,
        p.CurrencyCode, p.SourceReference, p.PublishedAt, p.CreatedAt,
        p.Components
            .OrderBy(c => c.ComponentType).ThenBy(c => c.ZoneCode).ThenBy(c => c.Name)
            .Select(c => new RateComponentDto(c.Id, c.ComponentType, c.ComponentType.ToCategory(), c.Name, c.ZoneCode, c.Unit, c.NetRate, c.TaxRate))
            .ToList());
}
