using Microsoft.EntityFrameworkCore;
using Wattly.Application.Common;
using Wattly.Domain.Calculations;
using Wattly.Domain.Households;
using Wattly.Domain.Metering;
using Wattly.Domain.Tariffs;

namespace Wattly.Application.Calculations;

/// <summary>Import register with its active readings.</summary>
/// <param name="Register">Register.</param>
/// <param name="Series">Readings as a time series.</param>
public sealed record RegisterData(MeterRegister Register, RegisterSeries Series);

/// <summary>Everything needed to calculate consumption and costs of a property, loaded once and reused for many periods.</summary>
public sealed class PropertyEnergyData
{
    /// <summary>The property.</summary>
    public required Property Property { get; init; }
    /// <summary>Resolved property time zone.</summary>
    public required TimeZoneInfo TimeZone { get; init; }
    /// <summary>All contracts ordered by start date.</summary>
    public required IReadOnlyList<EnergyContract> Contracts { get; init; }
    /// <summary>Own and catalog rate plans of the contracted tariffs.</summary>
    public required IReadOnlyList<TariffRatePlan> RatePlans { get; init; }
    /// <summary>Import registers of all meters.</summary>
    public required IReadOnlyList<RegisterData> ImportRegisters { get; init; }

    /// <summary>Latest reading of any import register.</summary>
    public DateTimeOffset? LastReadingAt => ImportRegisters.Select(r => r.Series.Last?.At).Max();
    /// <summary>Earliest reading of any import register.</summary>
    public DateTimeOffset? FirstReadingAt => ImportRegisters.Select(r => r.Series.First?.At).Min();

    /// <summary>Contract in force on the given day, if any.</summary>
    /// <param name="date">Calendar date.</param>
    public EnergyContract? ContractOn(DateOnly date) => Contracts.FirstOrDefault(c => c.IsValidOn(date));

    /// <summary>
    /// Rate plans applicable on <paramref name="date"/>: the property's own plans for the contract tariff take precedence;
    /// otherwise catalog plans of the tariff matching the contract supplier/operator (or generic ones) are used together.
    /// </summary>
    /// <param name="contract">Contract in force.</param>
    /// <param name="date">Calendar date.</param>
    public IReadOnlyList<TariffRatePlan> RatePlansOn(EnergyContract contract, DateOnly date)
    {
        var own = RatePlans.Where(p => p.PropertyId == Property.Id && p.TariffId == contract.TariffId && p.IsValidOn(date)).ToList();
        if (own.Count > 0)
            return own;

        return RatePlans
            .Where(p => p.PropertyId is null && p.TariffId == contract.TariffId && p.IsValidOn(date))
            .Where(p => p.SupplierId is null || p.SupplierId == contract.SupplierId)
            .Where(p => p.OperatorId is null || p.OperatorId == contract.OperatorId)
            .ToList();
    }

    /// <summary>Loads all data of an owned property needed for calculations (throws NotFound for foreign properties).</summary>
    /// <param name="db">Database context.</param>
    /// <param name="userId">Owner.</param>
    /// <param name="propertyId">Property.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<PropertyEnergyData> LoadAsync(IWattlyDbContext db, Guid userId, Guid propertyId, CancellationToken ct)
    {
        var property = await db.Properties.AsNoTracking().OwnedBy(userId).FirstOrDefaultAsync(p => p.Id == propertyId, ct)
                       ?? throw new NotFoundException("Nieruchomość");

        var contracts = await db.EnergyContracts.AsNoTracking().Where(c => c.PropertyId == propertyId).OrderBy(c => c.ValidFrom).ToListAsync(ct);
        var tariffIds = contracts.Select(c => c.TariffId).Distinct().ToList();

        var plans = await db.TariffRatePlans.AsNoTracking().Include(p => p.Components)
            .Where(p => tariffIds.Contains(p.TariffId) && (p.PropertyId == null || p.PropertyId == propertyId))
            .ToListAsync(ct);

        var registers = await db.MeterRegisters.AsNoTracking()
            .Where(r => r.Meter.PropertyId == propertyId && r.RegisterType == RegisterType.Import)
            .OrderBy(r => r.ZoneCode)
            .ToListAsync(ct);
        var registerIds = registers.Select(r => r.Id).ToList();

        var readings = await db.MeterReadings.AsNoTracking()
            .Where(r => registerIds.Contains(r.MeterRegisterId) && r.Status == ReadingStatus.Active)
            .Select(r => new { r.MeterRegisterId, r.ReadingAt, r.Value })
            .ToListAsync(ct);
        var byRegister = readings.ToLookup(r => r.MeterRegisterId);

        return new PropertyEnergyData
        {
            Property = property,
            TimeZone = TimeZones.Resolve(property.TimeZoneId),
            Contracts = contracts,
            RatePlans = plans,
            ImportRegisters = registers
                .Select(r => new RegisterData(r, new RegisterSeries(byRegister[r.Id].Select(x => new ReadingPoint(x.ReadingAt, x.Value)))))
                .ToList(),
        };
    }
}
