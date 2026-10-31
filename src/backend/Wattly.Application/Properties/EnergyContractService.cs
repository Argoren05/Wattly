using Microsoft.EntityFrameworkCore;
using Wattly.Application.Common;
using Wattly.Domain.Households;

namespace Wattly.Application.Properties;

/// <summary>Energy contracts (supplier, operator, tariff) of properties.</summary>
/// <param name="db">Database context.</param>
/// <param name="currentUser">Signed-in user.</param>
/// <param name="clock">Time source.</param>
public sealed class EnergyContractService(IWattlyDbContext db, ICurrentUser currentUser, TimeProvider clock)
{
    /// <summary>Contract history, newest first.</summary>
    /// <param name="propertyId">Property.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<IReadOnlyList<EnergyContractDto>> ListAsync(Guid propertyId, CancellationToken ct)
    {
        await db.EnsurePropertyAccessAsync(currentUser.UserId, propertyId, ct);
        var contracts = await Query().Where(c => c.PropertyId == propertyId).OrderByDescending(c => c.ValidFrom).ToListAsync(ct);
        return contracts.Select(ToDto).ToList();
    }

    /// <summary>Contract valid today (property time zone) or, if none, the most recent one.</summary>
    /// <param name="propertyId">Property.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<EnergyContractDto> GetCurrentAsync(Guid propertyId, CancellationToken ct)
    {
        var property = await db.GetOwnedPropertyAsync(currentUser.UserId, propertyId, ct);
        var today = TimeZones.LocalDate(clock.GetUtcNow(), TimeZones.Resolve(property.TimeZoneId));

        var contracts = await Query().Where(c => c.PropertyId == propertyId).OrderByDescending(c => c.ValidFrom).ToListAsync(ct);
        var contract = contracts.FirstOrDefault(c => c.IsValidOn(today)) ?? contracts.FirstOrDefault()
            ?? throw new NotFoundException("Umowa");
        return ToDto(contract);
    }

    /// <summary>
    /// Sets the contract starting at <c>ValidFrom</c>. A contract starting on the same day is updated;
    /// an earlier open contract is closed the day before. Overlapping later contracts are rejected.
    /// </summary>
    /// <param name="propertyId">Property.</param>
    /// <param name="request">Contract.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<EnergyContractDto> UpsertAsync(Guid propertyId, EnergyContractRequest request, CancellationToken ct)
    {
        await db.EnsurePropertyAccessAsync(currentUser.UserId, propertyId, ct);
        await ValidateAsync(request, ct);

        var existing = await db.EnergyContracts.Where(c => c.PropertyId == propertyId).ToListAsync(ct);
        var contract = existing.FirstOrDefault(c => c.ValidFrom == request.ValidFrom);

        foreach (var other in existing.Where(c => c != contract && Overlaps(c, request)))
        {
            if (other.ValidFrom < request.ValidFrom)
                other.ValidTo = request.ValidFrom.AddDays(-1);
            else
                throw OverlapError(other);
        }

        if (contract is null)
        {
            contract = new EnergyContract { PropertyId = propertyId };
            db.EnergyContracts.Add(contract);
        }

        Apply(contract, request);
        await db.SaveChangesAsync(ct);
        return ToDto(await Query().FirstAsync(c => c.Id == contract.Id, ct));
    }

    /// <summary>
    /// Corrects an existing contract in place (e.g. a wrong start date entered during setup). Unlike
    /// <see cref="UpsertAsync"/> other contracts are never shortened: an overlap is reported so nothing changes silently.
    /// </summary>
    /// <param name="contractId">Contract.</param>
    /// <param name="request">Corrected data.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<EnergyContractDto> UpdateAsync(Guid contractId, EnergyContractRequest request, CancellationToken ct)
    {
        var contract = await GetOwnedAsync(contractId, ct);
        await ValidateAsync(request, ct);

        var others = await db.EnergyContracts.Where(c => c.PropertyId == contract.PropertyId && c.Id != contractId).ToListAsync(ct);
        if (others.FirstOrDefault(c => Overlaps(c, request)) is { } overlapping)
            throw OverlapError(overlapping);

        Apply(contract, request);
        await db.SaveChangesAsync(ct);
        return ToDto(await Query().FirstAsync(c => c.Id == contractId, ct));
    }

    /// <summary>Deletes a contract entered by mistake. Saved calculations keep their own copy of the rates.</summary>
    /// <param name="contractId">Contract.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task DeleteAsync(Guid contractId, CancellationToken ct)
    {
        var contract = await GetOwnedAsync(contractId, ct);
        db.EnergyContracts.Remove(contract);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Loads a contract of a property owned by the current user (404 otherwise).</summary>
    private async Task<EnergyContract> GetOwnedAsync(Guid contractId, CancellationToken ct)
    {
        var contract = await db.EnergyContracts.FirstOrDefaultAsync(c => c.Id == contractId, ct) ?? throw new NotFoundException("Umowa");
        await db.EnsurePropertyAccessAsync(currentUser.UserId, contract.PropertyId, ct);
        return contract;
    }

    /// <summary>Validates dates, power and references to the catalog.</summary>
    private async Task ValidateAsync(EnergyContractRequest request, CancellationToken ct)
    {
        var validation = new Validation()
            .Require(request.ValidTo is null || request.ValidTo >= request.ValidFrom, nameof(request.ValidTo), "Data końca musi być późniejsza lub równa dacie początku.")
            .Require(request.ContractedPowerKw is null or > 0 and <= 1000, nameof(request.ContractedPowerKw), "Moc umowna musi być z zakresu (0; 1000] kW.")
            .Require(await db.Tariffs.AnyAsync(t => t.Id == request.TariffId && t.IsActive, ct), nameof(request.TariffId), "Wybrana taryfa nie istnieje.");
        if (request.SupplierId is { } supplierId)
            validation.Require(await db.EnergySuppliers.AnyAsync(s => s.Id == supplierId && s.IsActive, ct), nameof(request.SupplierId), "Wybrany sprzedawca nie istnieje.");
        if (request.OperatorId is { } operatorId)
            validation.Require(await db.EnergyOperators.AnyAsync(o => o.Id == operatorId && o.IsActive, ct), nameof(request.OperatorId), "Wybrany operator nie istnieje.");
        validation.ThrowIfInvalid();
    }

    /// <summary>Whether an existing contract overlaps the requested validity (both ends inclusive, null = open).</summary>
    private static bool Overlaps(EnergyContract other, EnergyContractRequest request) =>
        (request.ValidTo is null || other.ValidFrom <= request.ValidTo) && (other.ValidTo is null || request.ValidFrom <= other.ValidTo);

    /// <summary>Conflict reported when two contracts would be valid on the same day.</summary>
    private static ConflictException OverlapError(EnergyContract other) =>
        new("contract.overlap", $"Istnieje umowa obowiązująca od {other.ValidFrom:yyyy-MM-dd}, która nakłada się na wskazany okres.");

    /// <summary>Copies request values to the entity.</summary>
    private static void Apply(EnergyContract contract, EnergyContractRequest request)
    {
        contract.SupplierId = request.SupplierId;
        contract.OperatorId = request.OperatorId;
        contract.TariffId = request.TariffId;
        contract.ContractedPowerKw = request.ContractedPowerKw;
        contract.ValidFrom = request.ValidFrom;
        contract.ValidTo = request.ValidTo;
    }

    /// <summary>Read-only query with supplier, operator and tariff.</summary>
    private IQueryable<EnergyContract> Query() =>
        db.EnergyContracts.AsNoTracking().Include(c => c.Supplier).Include(c => c.Operator).Include(c => c.Tariff);

    /// <summary>Maps a contract.</summary>
    private static EnergyContractDto ToDto(EnergyContract c) => new(
        c.Id, c.PropertyId, c.SupplierId, c.Supplier?.Name, c.OperatorId, c.Operator?.Name,
        c.TariffId, c.Tariff.Code, c.ContractedPowerKw, c.ValidFrom, c.ValidTo);
}
