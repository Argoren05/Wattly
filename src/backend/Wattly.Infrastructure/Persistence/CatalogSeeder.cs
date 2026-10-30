using Microsoft.EntityFrameworkCore;
using Wattly.Domain.Tariffs;

namespace Wattly.Infrastructure.Persistence;

/// <summary>
/// Idempotent seed of the base catalog: distribution operators, suppliers and tariff groups (structure only).
/// No prices are seeded on purpose – rates must come from verified price lists with a documented source (DEC-008).
/// </summary>
public static class CatalogSeeder
{
    private const string ZoneHoursNote = "Godziny stref zależą od operatora i taryfy OSD – sprawdź aktualną taryfę.";

    public static async Task SeedAsync(WattlyDbContext db, CancellationToken ct)
    {
        await SeedOperatorsAsync(db, ct);
        await SeedSuppliersAsync(db, ct);
        await SeedTariffsAsync(db, ct);
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedOperatorsAsync(WattlyDbContext db, CancellationToken ct)
    {
        (string Code, string Name)[] operators =
        [
            ("PGE-DYSTRYBUCJA", "PGE Dystrybucja S.A."),
            ("TAURON-DYSTRYBUCJA", "TAURON Dystrybucja S.A."),
            ("ENEA-OPERATOR", "Enea Operator Sp. z o.o."),
            ("ENERGA-OPERATOR", "Energa-Operator S.A."),
            ("STOEN-OPERATOR", "Stoen Operator Sp. z o.o."),
        ];

        var existing = await db.EnergyOperators.Select(o => o.Code).ToListAsync(ct);
        db.EnergyOperators.AddRange(operators.Where(o => !existing.Contains(o.Code)).Select(o => new EnergyOperator { Code = o.Code, Name = o.Name }));
    }

    private static async Task SeedSuppliersAsync(WattlyDbContext db, CancellationToken ct)
    {
        (string Code, string Name)[] suppliers =
        [
            ("PGE-OBROT", "PGE Obrót S.A."),
            ("TAURON-SPRZEDAZ", "TAURON Sprzedaż sp. z o.o."),
            ("ENEA", "Enea S.A."),
            ("ENERGA-OBROT", "Energa Obrót S.A."),
            ("EON-POLSKA", "E.ON Polska S.A."),
        ];

        var existing = await db.EnergySuppliers.Select(s => s.Code).ToListAsync(ct);
        db.EnergySuppliers.AddRange(suppliers.Where(s => !existing.Contains(s.Code)).Select(s => new EnergySupplier { Code = s.Code, Name = s.Name }));
    }

    private static async Task SeedTariffsAsync(WattlyDbContext db, CancellationToken ct)
    {
        Tariff[] tariffs =
        [
            new() { Code = "G11", Name = "G11 – jednostrefowa", Description = "Jedna cena energii przez całą dobę." },
            new()
            {
                Code = "G12", Name = "G12 – dwustrefowa (dzień/noc)",
                Description = "Strefa dzienna i nocna (tańsza).",
                Zones =
                [
                    new() { Code = "DAY", Name = "Dzienna", ScheduleDescription = ZoneHoursNote },
                    new() { Code = "NIGHT", Name = "Nocna", ScheduleDescription = ZoneHoursNote },
                ],
            },
            new()
            {
                Code = "G12W", Name = "G12w – dwustrefowa z weekendem",
                Description = "Strefa szczytowa i pozaszczytowa; weekendy w strefie pozaszczytowej.",
                Zones =
                [
                    new() { Code = "PEAK", Name = "Szczytowa", ScheduleDescription = ZoneHoursNote },
                    new() { Code = "OFFPEAK", Name = "Pozaszczytowa", ScheduleDescription = ZoneHoursNote },
                ],
            },
            new()
            {
                Code = "G13", Name = "G13 – trzystrefowa",
                Description = "Szczyt przedpołudniowy, szczyt popołudniowy i pozostałe godziny.",
                Zones =
                [
                    new() { Code = "MORNING_PEAK", Name = "Szczyt przedpołudniowy", ScheduleDescription = ZoneHoursNote },
                    new() { Code = "AFTERNOON_PEAK", Name = "Szczyt popołudniowy", ScheduleDescription = ZoneHoursNote },
                    new() { Code = "OFFPEAK", Name = "Pozostałe godziny", ScheduleDescription = ZoneHoursNote },
                ],
            },
        ];

        var existing = await db.Tariffs.Select(t => t.Code).ToListAsync(ct);
        db.Tariffs.AddRange(tariffs.Where(t => !existing.Contains(t.Code)));
    }
}
