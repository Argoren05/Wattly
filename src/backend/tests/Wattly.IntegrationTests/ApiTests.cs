using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace Wattly.IntegrationTests;

[Collection(ApiCollection.Name)]
public class ApiTests(WattlyApiFactory factory)
{
    [Fact]
    public async Task Health_endpoints_report_healthy()
    {
        var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/ready")).StatusCode);
    }

    [Fact]
    public async Task Anonymous_requests_are_rejected()
    {
        var response = await factory.CreateClient().GetAsync("/api/v1/properties");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Catalog_is_seeded_without_prices()
    {
        var client = await factory.CreateUserClientAsync();

        var tariffs = (await client.GetJsonAsync("/api/v1/catalog/tariffs")).AsArray();
        Assert.Equal(["G11", "G12", "G12W", "G13"], tariffs.Select(t => t!["code"]!.GetValue<string>()));
        Assert.NotEmpty((await client.GetJsonAsync("/api/v1/catalog/operators")).AsArray());

        var g11 = tariffs.First(t => t!["code"]!.GetValue<string>() == "G11")!["id"]!.GetValue<string>();
        Assert.Empty((await client.GetJsonAsync($"/api/v1/catalog/tariffs/{g11}/rate-plans")).AsArray());
    }

    [Fact]
    public async Task Full_flow_calculates_costs_from_readings_and_rates()
    {
        var client = await factory.CreateUserClientAsync();
        var s = await Scenario.CreateAsync(client);

        await s.AddReadingAsync(client, s.DayRegisterId, "2026-03-01T00:00:00+01:00", 1000);
        await s.AddReadingAsync(client, s.NightRegisterId, "2026-03-01T00:00:00+01:00", 500);
        await s.AddReadingAsync(client, s.DayRegisterId, "2026-04-01T00:00:00+02:00", 1150);
        await s.AddReadingAsync(client, s.NightRegisterId, "2026-04-01T00:00:00+02:00", 600);

        var result = await client.PostJsonAsync($"/api/v1/properties/{s.PropertyId}/calculations/preview",
            new { from = "2026-03-01T00:00:00+01:00", to = "2026-04-01T00:00:00+02:00" });

        Assert.Equal(250m, result["consumptionKwh"]!.GetValue<decimal>());
        Assert.Equal(115.00m, result["totalNet"]!.GetValue<decimal>());      // 150*0.5 + 100*0.3 + 10
        Assert.Equal(26.45m, result["taxAmount"]!.GetValue<decimal>());
        Assert.Equal(141.45m, result["totalGross"]!.GetValue<decimal>());
        Assert.False(result["isEstimate"]!.GetValue<bool>());
        Assert.True(result["isComplete"]!.GetValue<bool>());

        var saved = await client.PostJsonAsync($"/api/v1/properties/{s.PropertyId}/calculations",
            new { from = "2026-03-01T00:00:00+01:00", to = "2026-04-01T00:00:00+02:00" });
        var stored = await client.GetJsonAsync($"/api/v1/calculations/{saved["id"]}");
        Assert.Equal(141.45m, stored["totalGross"]!.GetValue<decimal>());
        Assert.Equal(3, stored["lines"]!.AsArray().Count);

        var forecast = await client.GetJsonAsync($"/api/v1/properties/{s.PropertyId}/forecast");
        Assert.True(forecast["isEstimate"]!.GetValue<bool>());
        Assert.True(forecast["hasRatePlans"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Reading_rules_are_enforced_and_corrections_keep_history()
    {
        var client = await factory.CreateUserClientAsync();
        var s = await Scenario.CreateAsync(client);
        var url = $"/api/v1/registers/{s.DayRegisterId}/readings";

        await s.AddReadingAsync(client, s.DayRegisterId, "2026-01-01T00:00:00Z", 100);
        await s.AddReadingAsync(client, s.DayRegisterId, "2026-01-11T00:00:00Z", 150);
        var last = await s.AddReadingAsync(client, s.DayRegisterId, "2026-01-21T00:00:00Z", 200);

        var duplicate = await client.PostAsJsonAsync(url, new { readingAt = "2026-01-21T00:00:00Z", value = 200 });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Equal("reading.duplicate", (await duplicate.ReadJsonAsync())["code"]!.GetValue<string>());

        var lower = await client.PostAsJsonAsync(url, new { readingAt = "2026-01-25T00:00:00Z", value = 150 });
        Assert.Equal("reading.not_monotonic", (await lower.ReadJsonAsync())["code"]!.GetValue<string>());

        var negative = await client.PostAsJsonAsync(url, new { readingAt = "2026-01-25T00:00:00Z", value = -5 });
        Assert.Equal(HttpStatusCode.BadRequest, negative.StatusCode);

        var anomaly = await client.PostAsJsonAsync(url, new { readingAt = "2026-01-22T00:00:00Z", value = 400 });
        Assert.Equal("reading.anomaly_requires_confirmation", (await anomaly.ReadJsonAsync())["code"]!.GetValue<string>());
        var confirmed = await client.PostJsonAsync(url, new { readingAt = "2026-01-22T00:00:00Z", value = 400, confirmAnomaly = true });
        Assert.Single(confirmed["warnings"]!.AsArray());

        // Correct the confirmed reading: the original is kept as Superseded.
        var originalId = confirmed["reading"]!["id"]!.GetValue<string>();
        var corrected = await client.PutJsonAsync($"/api/v1/readings/{originalId}", new { readingAt = "2026-01-22T00:00:00Z", value = 205 });
        Assert.Equal(originalId, corrected["reading"]!["supersedesReadingId"]!.GetValue<string>());
        Assert.Equal(5m, corrected["reading"]!["consumptionSincePrevious"]!.GetValue<decimal>());

        var all = await client.GetJsonAsync($"{url}?includeInactive=true");
        Assert.Contains(all["items"]!.AsArray(), r => r!["status"]!.GetValue<string>() == "Superseded");

        var voided = await client.PostJsonAsync($"/api/v1/readings/{last["reading"]!["id"]}/void", new { reason = "Pomyłka" });
        Assert.Equal("Voided", voided["status"]!.GetValue<string>());
        var active = await client.GetJsonAsync(url);
        Assert.Equal(3, active["totalCount"]!.GetValue<int>());
    }

    [Fact]
    public async Task Users_cannot_access_other_users_data()
    {
        var owner = await factory.CreateUserClientAsync();
        var s = await Scenario.CreateAsync(owner);
        var stranger = await factory.CreateUserClientAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/v1/properties/{s.PropertyId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/v1/registers/{s.DayRegisterId}/readings")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await stranger.PostAsJsonAsync($"/api/v1/registers/{s.DayRegisterId}/readings", new { readingAt = "2026-01-01T00:00:00Z", value = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/v1/properties/{s.PropertyId}/forecast")).StatusCode);
        Assert.Empty((await stranger.GetJsonAsync("/api/v1/properties")).AsArray());
    }

    [Fact]
    public async Task Catalog_administration_requires_admin_role()
    {
        var user = await factory.CreateUserClientAsync();
        var forbidden = await user.PostAsJsonAsync("/api/v1/admin/operators", new { name = "Nowy OSD", code = "NEW-OSD" });
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        var admin = await factory.LoginAsync("admin@wattly.test", "AdminPassword123");
        var created = await admin.PostJsonAsync("/api/v1/admin/operators", new { name = "Nowy OSD", code = "NEW-OSD" });
        Assert.Equal("NEW-OSD", created["code"]!.GetValue<string>());
    }

    [Fact]
    public async Task Overlapping_rate_plans_are_rejected()
    {
        var client = await factory.CreateUserClientAsync();
        var s = await Scenario.CreateAsync(client);

        var response = await client.PostAsJsonAsync($"/api/v1/properties/{s.PropertyId}/rate-plans", new
        {
            tariffId = s.TariffId,
            name = "Druga wersja",
            validFrom = "2026-06-01",
            sourceReference = "test",
            components = new[] { new { componentType = "Energy", name = "Energia", unit = "Kwh", netRate = 1m, taxRate = 0.23m } },
        }, ApiClient.Json);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("rate_plan.overlap", (await response.ReadJsonAsync())["code"]!.GetValue<string>());
    }

    [Fact]
    public async Task Invoice_is_compared_with_estimate_and_accepts_only_safe_attachments()
    {
        var client = await factory.CreateUserClientAsync();
        var s = await Scenario.CreateAsync(client);
        await s.AddReadingAsync(client, s.DayRegisterId, "2026-03-01T00:00:00+01:00", 1000);
        await s.AddReadingAsync(client, s.NightRegisterId, "2026-03-01T00:00:00+01:00", 500);
        await s.AddReadingAsync(client, s.DayRegisterId, "2026-04-01T00:00:00+02:00", 1150);
        await s.AddReadingAsync(client, s.NightRegisterId, "2026-04-01T00:00:00+02:00", 600);

        var invoice = await client.PostJsonAsync($"/api/v1/properties/{s.PropertyId}/invoices", new
        {
            invoiceNumber = "FV/03/2026",
            issueDate = "2026-04-05",
            periodStart = "2026-03-01",
            periodEnd = "2026-03-31",
            totalGross = 150.00m,
        });
        Assert.Equal(141.45m, invoice["comparison"]!["estimatedGross"]!.GetValue<decimal>());
        Assert.Equal(8.55m, invoice["comparison"]!["differenceGross"]!.GetValue<decimal>());

        var invoiceId = invoice["id"]!.GetValue<string>();
        using var exe = new MultipartFormDataContent { { new ByteArrayContent([0x4D, 0x5A, 0x90, 0x00]) { Headers = { ContentType = new MediaTypeHeaderValue("application/pdf") } }, "file", "fake.pdf" } };
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync($"/api/v1/invoices/{invoiceId}/attachments", exe)).StatusCode);

        using var pdf = new MultipartFormDataContent { { new ByteArrayContent("%PDF-1.7 test"u8.ToArray()), "file", "../../faktura marzec.pdf" } };
        var uploaded = await client.PostAsync($"/api/v1/invoices/{invoiceId}/attachments", pdf);
        Assert.Equal(HttpStatusCode.OK, uploaded.StatusCode);
        var attachment = await uploaded.ReadJsonAsync();
        Assert.Equal("faktura marzec.pdf", attachment["fileName"]!.GetValue<string>());

        var download = await client.GetAsync($"/api/v1/attachments/{attachment["id"]}");
        Assert.Equal("application/pdf", download.Content.Headers.ContentType!.MediaType);

        var stranger = await factory.CreateUserClientAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/v1/attachments/{attachment["id"]}")).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/v1/invoices/{invoiceId}")).StatusCode);
    }

    [Fact]
    public async Task Deleting_property_removes_its_data()
    {
        var client = await factory.CreateUserClientAsync();
        var s = await Scenario.CreateAsync(client);
        await s.AddReadingAsync(client, s.DayRegisterId, "2026-03-01T00:00:00Z", 10);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/v1/properties/{s.PropertyId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/registers/{s.DayRegisterId}/readings")).StatusCode);
    }
}
