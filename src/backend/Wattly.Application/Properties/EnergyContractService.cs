using Microsoft.EntityFrameworkCore;
using Wattly.Application.Common;
using Wattly.Domain.Households;

namespace Wattly.Application.Properties;

public sealed class EnergyContractService(IWattlyDbContext db, ICurrentUser currentUser, TimeProvider clock)
{
    public async Task<IReadOnlyList<EnergyContractDto>> ListAsync(Guid propertyId, CancellationToken ct)
    {
        await db.EnsurePropertyAccessAsync(currentUser.UserId, propertyId, ct);
        var contracts = await Query().Where(c => c.PropertyId == propertyId).OrderByDescending(c => c.ValidFrom).ToListAsync(ct);
        return contracts.Select(ToDto).ToList();
    }

    /// <summary>Contract valid today (property time zone) or, if none, the most recent one.</summary>
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
    public async Task<EnergyContractDto> UpsertAsync(Guid propertyId, EnergyContractRequest request, CancellationToken ct)
    {
        await db.EnsurePropertyAccessAsync(currentUser.UserId, propertyId, ct);

        var validation = new Validation()
            .Require(request.ValidTo is null || request.ValidTo >= request.ValidFrom, nameof(request.ValidTo), "Data końca musi być późniejsza lub równa dacie początku.")
            .Require(request.ContractedPowerKw is null or > 0 and <= 1000, nameof(request.ContractedPowerKw), "Moc umowna musi być z zakresu (0; 1000] kW.")
            .Require(await db.Tariffs.AnyAsync(t => t.Id == request.TariffId && t.IsActive, ct), nameof(request.TariffId), "Wybrana taryfa nie istnieje.");
        if (request.SupplierId is { } supplierId)
            validation.Require(await db.EnergySuppliers.AnyAsync(s => s.Id == supplierId && s.IsActive, ct), nameof(request.SupplierId), "Wybrany sprzedawca nie istnieje.");
        if (request.OperatorId is { } operatorId)
            validation.Require(await db.EnergyOperators.AnyAsync(o => o.Id == operatorId && o.IsActive, ct), nameof(request.OperatorId), "Wybrany operator nie istnieje.");
        validation.ThrowIfInvalid();

        var existing = await db.EnergyContracts.Where(c => c.PropertyId == propertyId).ToListAsync(ct);
        var contract = existing.FirstOrDefault(c => c.ValidFrom == request.ValidFrom);

        foreach (var other in existing.Where(c => c != contract))
        {
            var overlaps = (request.ValidTo is null || other.ValidFrom <= request.ValidTo) && (other.ValidTo is null || request.ValidFrom <= other.ValidTo);
            if (!overlaps)
                continue;

            if (other.ValidFrom < request.ValidFrom)
                other.ValidTo = request.ValidFrom.AddDays(-1);
            else
                throw new ConflictException("contract.overlap", $"Istnieje umowa obowiązująca od {other.ValidFrom:yyyy-MM-dd}, która nakłada się na wskazany okres.");
        }

        if (contract is null)
        {
            contract = new EnergyContract { PropertyId = propertyId };
            db.EnergyContracts.Add(contract);
        }

        contract.SupplierId = request.SupplierId;
        contract.OperatorId = request.OperatorId;
        contract.TariffId = request.TariffId;
        contract.ContractedPowerKw = request.ContractedPowerKw;
        contract.ValidFrom = request.ValidFrom;
        contract.ValidTo = request.ValidTo;

        await db.SaveChangesAsync(ct);
        return ToDto(await Query().FirstAsync(c => c.Id == contract.Id, ct));
    }

    private IQueryable<EnergyContract> Query() =>
        db.EnergyContracts.AsNoTracking().Include(c => c.Supplier).Include(c => c.Operator).Include(c => c.Tariff);

    private static EnergyContractDto ToDto(EnergyContract c) => new(
        c.Id, c.PropertyId, c.SupplierId, c.Supplier?.Name, c.OperatorId, c.Operator?.Name,
        c.TariffId, c.Tariff.Code, c.ContractedPowerKw, c.ValidFrom, c.ValidTo);
}
