using System.Text.Json.Nodes;

namespace Wattly.IntegrationTests;

/// <summary>Builds a configured property: G12 contract, own rate plan and a two-zone meter.</summary>
public sealed record Scenario(string PropertyId, string TariffId, string DayRegisterId, string NightRegisterId)
{
    /// <summary>Creates the scenario through the public API.</summary>
    public static async Task<Scenario> CreateAsync(HttpClient client)
    {
        var property = await client.PostJsonAsync("/api/v1/properties", new { name = "Mieszkanie", billingPeriodMonths = 2, billingAnchorDate = "2026-01-01" });
        var propertyId = property["id"]!.GetValue<string>();

        var tariffs = (await client.GetJsonAsync("/api/v1/catalog/tariffs")).AsArray();
        var tariffId = tariffs.First(t => t!["code"]!.GetValue<string>() == "G12")!["id"]!.GetValue<string>();

        await client.PutJsonAsync($"/api/v1/properties/{propertyId}/energy-contract", new { tariffId, validFrom = "2026-01-01" });
        await client.PostJsonAsync($"/api/v1/properties/{propertyId}/rate-plans", new
        {
            tariffId,
            name = "Stawki z faktury",
            validFrom = "2026-01-01",
            sourceReference = "Faktura FV/1/2026",
            components = new object[]
            {
                new { componentType = "Energy", name = "Energia – dzień", zoneCode = "DAY", unit = "Kwh", netRate = 0.5m, taxRate = 0.23m },
                new { componentType = "Energy", name = "Energia – noc", zoneCode = "NIGHT", unit = "Kwh", netRate = 0.3m, taxRate = 0.23m },
                new { componentType = "FixedDistribution", name = "Opłata stała", unit = "Month", netRate = 10m, taxRate = 0.23m },
            },
        });

        var meter = await client.PostJsonAsync($"/api/v1/properties/{propertyId}/meters", new
        {
            name = "Licznik",
            meterType = "Conventional",
            directionality = "ImportOnly",
            registers = new object[]
            {
                new { name = "Dzień", registerType = "Import", zoneCode = "DAY" },
                new { name = "Noc", registerType = "Import", zoneCode = "NIGHT" },
            },
        });
        var registers = meter["registers"]!.AsArray();
        string Register(string zone) => registers.First(r => r!["zoneCode"]?.GetValue<string>() == zone)!["id"]!.GetValue<string>();

        return new Scenario(propertyId, tariffId, Register("DAY"), Register("NIGHT"));
    }

    /// <summary>Adds a reading to a register and asserts success.</summary>
    public async Task<JsonNode> AddReadingAsync(HttpClient client, string registerId, string at, decimal value) =>
        await client.PostJsonAsync($"/api/v1/registers/{registerId}/readings", new { readingAt = at, value });
}
