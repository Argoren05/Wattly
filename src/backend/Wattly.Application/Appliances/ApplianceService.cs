using Microsoft.EntityFrameworkCore;
using Wattly.Application.Calculations;
using Wattly.Application.Common;
using Wattly.Domain.Appliances;
using Wattly.Domain.Tariffs;

namespace Wattly.Application.Appliances;

/// <summary>
/// Appliances with separately measured consumption (Tapo plugs, a fridge read from SmartThings, manual entries) and the
/// breakdown "what uses the electricity" against the meter (DEC-034).
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="currentUser">Signed-in user.</param>
/// <param name="clock">Time source.</param>
public sealed class ApplianceService(IWattlyDbContext db, ICurrentUser currentUser, TimeProvider clock)
{
    /// <summary>Upper limit of entries in one upload (a quarter of daily data fits easily).</summary>
    public const int MaxEntriesPerRequest = 400;

    /// <summary>Upper limit of energy per day of an entry – a 16 A plug cannot exceed ~88 kWh/day.</summary>
    public const decimal MaxKwhPerDay = 100m;

    /// <summary>Appliances of a property, by name.</summary>
    /// <param name="propertyId">Property.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<IReadOnlyList<ApplianceDto>> ListAsync(Guid propertyId, CancellationToken ct)
    {
        await db.EnsurePropertyAccessAsync(currentUser.UserId, propertyId, ct);
        var appliances = await db.Appliances.AsNoTracking().Where(a => a.PropertyId == propertyId).OrderBy(a => a.Name).ToListAsync(ct);
        var ids = appliances.Select(a => a.Id).ToList();
        var last = await db.ApplianceUsage.Where(u => ids.Contains(u.ApplianceId))
            .GroupBy(u => u.ApplianceId).Select(g => new { g.Key, Last = g.Max(u => u.PeriodEnd) }).ToDictionaryAsync(x => x.Key, x => x.Last, ct);
        return appliances.Select(a => ToDto(a, last.TryGetValue(a.Id, out var d) ? d : null)).ToList();
    }

    /// <summary>Adds an appliance; an external id (Tapo device) may appear once per property.</summary>
    /// <param name="propertyId">Property.</param>
    /// <param name="request">Data.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<ApplianceDto> CreateAsync(Guid propertyId, ApplianceRequest request, CancellationToken ct)
    {
        await db.EnsurePropertyAccessAsync(currentUser.UserId, propertyId, ct);
        var externalId = Validation.Clean(request.ExternalId);
        Validate(request);
        new Validation()
            .Require(Enum.IsDefined(request.Source), nameof(request.Source), "Nieznane źródło danych.")
            .Require(request.Source != ApplianceSource.Tapo || externalId is not null, nameof(request.ExternalId), "Gniazdko Tapo wymaga identyfikatora urządzenia.")
            .RequireText(externalId, nameof(request.ExternalId), 100, required: false)
            .ThrowIfInvalid();

        if (externalId is not null && await db.Appliances.AnyAsync(a => a.PropertyId == propertyId && a.ExternalId == externalId, ct))
            throw new ConflictException("appliance.duplicate", "To urządzenie jest już dodane do tej nieruchomości.");

        var appliance = new Appliance
        {
            PropertyId = propertyId,
            Name = request.Name.Trim(),
            Source = request.Source,
            ExternalId = externalId,
            Model = Validation.Clean(request.Model),
            IsHidden = request.IsHidden,
            CreatedAt = clock.GetUtcNow(),
        };
        db.Appliances.Add(appliance);
        await db.SaveChangesAsync(ct);
        return ToDto(appliance, null);
    }

    /// <summary>Renames or hides an appliance (source and external id stay).</summary>
    /// <param name="id">Appliance.</param>
    /// <param name="request">Data.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<ApplianceDto> UpdateAsync(Guid id, ApplianceRequest request, CancellationToken ct)
    {
        var appliance = await GetOwnedAsync(id, ct);
        Validate(request);
        appliance.Name = request.Name.Trim();
        appliance.Model = Validation.Clean(request.Model) ?? appliance.Model;
        appliance.IsHidden = request.IsHidden;
        await db.SaveChangesAsync(ct);
        var last = await db.ApplianceUsage.Where(u => u.ApplianceId == id).MaxAsync(u => (DateOnly?)u.PeriodEnd, ct);
        return ToDto(appliance, last);
    }

    /// <summary>Deletes an appliance with its consumption data.</summary>
    /// <param name="id">Appliance.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var appliance = await GetOwnedAsync(id, ct);
        db.Appliances.Remove(appliance);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Consumption entries of an appliance, newest first (at most 400).</summary>
    /// <param name="id">Appliance.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<IReadOnlyList<ApplianceUsageDto>> ListUsageAsync(Guid id, CancellationToken ct)
    {
        await GetOwnedAsync(id, ct);
        return await db.ApplianceUsage.AsNoTracking().Where(u => u.ApplianceId == id)
            .OrderByDescending(u => u.PeriodStart).Take(MaxEntriesPerRequest)
            .Select(u => new ApplianceUsageDto(u.Id, u.PeriodStart, u.PeriodEnd, u.EnergyKwh)).ToListAsync(ct);
    }

    /// <summary>
    /// Saves consumption entries. An entry for exactly the same period replaces the stored one (so the phone can
    /// re-send the whole quarter of a Tapo plug); an entry overlapping a different stored period is rejected.
    /// </summary>
    /// <param name="id">Appliance.</param>
    /// <param name="request">Entries.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<ApplianceUsageSaved> SaveUsageAsync(Guid id, ApplianceUsageRequest request, CancellationToken ct)
    {
        var appliance = await GetOwnedAsync(id, ct);
        var property = await db.GetOwnedPropertyAsync(currentUser.UserId, appliance.PropertyId, ct);
        var today = TimeZones.LocalDate(clock.GetUtcNow(), TimeZones.Resolve(property.TimeZoneId));
        var entries = request.Entries ?? [];

        var validation = new Validation()
            .Require(entries.Count is > 0 and <= MaxEntriesPerRequest, nameof(request.Entries), $"Podaj od 1 do {MaxEntriesPerRequest} wpisów.");
        for (var i = 0; i < entries.Count; i++)
        {
            var e = entries[i];
            var days = e.PeriodEnd.DayNumber - e.PeriodStart.DayNumber + 1;
            validation
                .Require(days >= 1, $"Entries[{i}].PeriodEnd", "Koniec okresu nie może być przed początkiem.")
                .Require(days <= 366, $"Entries[{i}].PeriodEnd", "Okres może mieć najwyżej 366 dni.")
                .Require(e.PeriodEnd <= today, $"Entries[{i}].PeriodEnd", "Okres nie może kończyć się w przyszłości.")
                .Require(e.EnergyKwh >= 0, $"Entries[{i}].EnergyKwh", "Zużycie nie może być ujemne.")
                .Require(days < 1 || e.EnergyKwh <= MaxKwhPerDay * days, $"Entries[{i}].EnergyKwh", "Zużycie jest nierealnie duże – sprawdź jednostkę (kWh).")
                .Require(decimal.Round(e.EnergyKwh, 3) == e.EnergyKwh, $"Entries[{i}].EnergyKwh", "Zużycie może mieć najwyżej 3 miejsca po przecinku.");
        }
        validation.Require(entries.Select(e => (e.PeriodStart, e.PeriodEnd)).Distinct().Count() == entries.Count, nameof(request.Entries), "Ten sam okres występuje kilka razy.");
        validation.ThrowIfInvalid();

        var stored = await db.ApplianceUsage.Where(u => u.ApplianceId == id).ToListAsync(ct);
        var now = clock.GetUtcNow();
        int created = 0, updated = 0;
        foreach (var entry in entries)
        {
            var same = stored.FirstOrDefault(u => u.PeriodStart == entry.PeriodStart && u.PeriodEnd == entry.PeriodEnd);
            if (same is not null)
            {
                same.EnergyKwh = entry.EnergyKwh;
                same.UpdatedAt = now;
                updated++;
                continue;
            }

            if (stored.FirstOrDefault(u => u.PeriodStart <= entry.PeriodEnd && entry.PeriodStart <= u.PeriodEnd) is { } overlapping)
                throw new ConflictException("appliance_usage.overlap",
                    $"Okres {entry.PeriodStart:yyyy-MM-dd} – {entry.PeriodEnd:yyyy-MM-dd} nakłada się na zapisany wpis {overlapping.PeriodStart:yyyy-MM-dd} – {overlapping.PeriodEnd:yyyy-MM-dd}.");

            var usage = new ApplianceUsage { ApplianceId = id, PeriodStart = entry.PeriodStart, PeriodEnd = entry.PeriodEnd, EnergyKwh = entry.EnergyKwh, UpdatedAt = now };
            db.ApplianceUsage.Add(usage);
            stored.Add(usage);
            created++;
        }

        await db.SaveChangesAsync(ct);
        return new ApplianceUsageSaved(created, updated);
    }

    /// <summary>Deletes one consumption entry.</summary>
    /// <param name="id">Appliance.</param>
    /// <param name="usageId">Entry.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task DeleteUsageAsync(Guid id, Guid usageId, CancellationToken ct)
    {
        await GetOwnedAsync(id, ct);
        var usage = await db.ApplianceUsage.FirstOrDefaultAsync(u => u.Id == usageId && u.ApplianceId == id, ct) ?? throw new NotFoundException("Wpis zużycia");
        db.ApplianceUsage.Remove(usage);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// What used the electricity between two days: each visible appliance (entries spanning several days are counted
    /// proportionally to the days inside the range), the meter consumption from readings and the rest. Costs use the
    /// average gross price of the per-kWh components – fixed monthly fees do not depend on an appliance.
    /// </summary>
    /// <param name="propertyId">Property.</param>
    /// <param name="from">First day.</param>
    /// <param name="to">Last day (inclusive).</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<ApplianceBreakdownDto> BreakdownAsync(Guid propertyId, DateOnly from, DateOnly to, CancellationToken ct)
    {
        new Validation()
            .Require(to >= from, nameof(to), "Koniec zakresu nie może być przed początkiem.")
            .Require(to.DayNumber - from.DayNumber < 3 * 366, nameof(to), "Zakres może mieć najwyżej 3 lata.")
            .ThrowIfInvalid();

        var data = await PropertyEnergyData.LoadAsync(db, currentUser.UserId, propertyId, ct);
        var days = to.DayNumber - from.DayNumber + 1;
        var now = clock.GetUtcNow();
        var cost = CostEngine.Calculate(data, TimeZones.StartOfDay(from, data.TimeZone), TimeZones.StartOfDay(to.AddDays(1), data.TimeZone), now);

        var hasMeter = cost.SourceValues.Any(v => v.Value is not null) && cost.ConsumptionKwh > 0;
        decimal? meterKwh = hasMeter ? Math.Round(cost.ConsumptionKwh, 3) : null;
        var perKwhGross = cost.Lines.Where(l => l.Unit == RateUnit.Kwh).Sum(l => l.NetAmount * (1 + l.TaxRate));
        decimal? price = hasMeter && perKwhGross > 0 ? Math.Round(perKwhGross / cost.ConsumptionKwh, 4) : null;

        var appliances = await db.Appliances.AsNoTracking().Where(a => a.PropertyId == propertyId && !a.IsHidden).ToListAsync(ct);
        var ids = appliances.Select(a => a.Id).ToList();
        var usage = await db.ApplianceUsage.AsNoTracking()
            .Where(u => ids.Contains(u.ApplianceId) && u.PeriodStart <= to && u.PeriodEnd >= from).ToListAsync(ct);

        BreakdownItemDto Item(Guid? applianceId, string name, decimal kwh, int covered)
        {
            kwh = Math.Round(kwh, 3);
            return new BreakdownItemDto(applianceId, name, kwh,
                price is { } p ? Math.Round(kwh * p, 2, MidpointRounding.AwayFromZero) : null,
                meterKwh is > 0 ? Math.Round(kwh / meterKwh.Value * 100m, 1) : null,
                covered);
        }

        var items = appliances.Select(a =>
        {
            decimal kwh = 0;
            var covered = new HashSet<int>();
            foreach (var u in usage.Where(u => u.ApplianceId == a.Id))
            {
                var start = Math.Max(u.PeriodStart.DayNumber, from.DayNumber);
                var end = Math.Min(u.PeriodEnd.DayNumber, to.DayNumber);
                kwh += u.EnergyKwh * (end - start + 1) / u.Days;
                for (var d = start; d <= end; d++)
                    covered.Add(d);
            }
            return Item(a.Id, a.Name, kwh, covered.Count);
        }).Where(i => i.CoveredDays > 0).OrderByDescending(i => i.EnergyKwh).ToList();

        var sum = items.Sum(i => i.EnergyKwh);
        var other = meterKwh is { } m ? Item(null, "Pozostałe", Math.Max(0, m - sum), days) : null;

        return new ApplianceBreakdownDto(from, to, days, meterKwh, hasMeter && cost.IsEstimate, price, cost.CurrencyCode, items, other, meterKwh is { } mk && sum > mk);
    }

    /// <summary>Common validation of name and model.</summary>
    private static void Validate(ApplianceRequest request) =>
        new Validation()
            .RequireText(request.Name, nameof(request.Name), 60)
            .RequireText(request.Model, nameof(request.Model), 40, required: false)
            .ThrowIfInvalid();

    /// <summary>Loads an appliance of a property owned by the current user (404 otherwise).</summary>
    private async Task<Appliance> GetOwnedAsync(Guid id, CancellationToken ct)
    {
        var appliance = await db.Appliances.FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw new NotFoundException("Urządzenie");
        await db.EnsurePropertyAccessAsync(currentUser.UserId, appliance.PropertyId, ct);
        return appliance;
    }

    /// <summary>Maps an appliance.</summary>
    private static ApplianceDto ToDto(Appliance a, DateOnly? last) =>
        new(a.Id, a.PropertyId, a.Name, a.Source, a.ExternalId, a.Model, a.IsHidden, last, a.CreatedAt);
}
