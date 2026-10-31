using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Npgsql;

namespace Wattly.IntegrationTests;

/// <summary>End-to-end tests of the HTTP API against a real PostgreSQL database.</summary>
/// <param name="factory">Shared API host with a temporary database.</param>
[Collection(ApiCollection.Name)]
public class ApiTests(WattlyApiFactory factory)
{
    [Fact]
    public async Task Release_endpoint_is_anonymous_and_reports_required_update()
    {
        var client = factory.CreateClient();

        var current = await client.GetJsonAsync("/api/v1/app/release?platform=android&version=1.0.0");
        var outdated = await client.GetJsonAsync("/api/v1/app/release?platform=android&version=0.9.0");
        var invalid = await client.GetAsync("/api/v1/app/release?platform=windows&version=1.0.0");

        Assert.False(current["updateRequired"]!.GetValue<bool>());
        Assert.True(outdated["updateRequired"]!.GetValue<bool>());
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
    }

    [Fact]
    public async Task External_login_issues_wattly_tokens_and_reuses_the_account()
    {
        var client = factory.CreateClient();
        var subject = Guid.NewGuid().ToString("N");
        var email = $"{subject}@social.test";

        var first = await client.PostAsJsonAsync("/api/v1/auth/external", new { provider = "test", token = $"{subject}|{email}|true" });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var tokens = await first.ReadJsonAsync();
        Assert.Equal("Bearer", tokens["tokenType"]!.GetValue<string>());

        var authed = factory.CreateClient();
        authed.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens["accessToken"]!.GetValue<string>());
        var me = await authed.GetJsonAsync("/api/v1/users/me");
        Assert.Equal(email, me["email"]!.GetValue<string>());

        // Signing in again with the same provider account returns the same Wattly user.
        var again = await (await client.PostAsJsonAsync("/api/v1/auth/external", new { provider = "TEST", token = $"{subject}|{email}|true" })).ReadJsonAsync();
        authed.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", again["accessToken"]!.GetValue<string>());
        Assert.Equal(me["id"]!.GetValue<string>(), (await authed.GetJsonAsync("/api/v1/users/me"))["id"]!.GetValue<string>());

        // The refresh token works exactly as after password sign-in.
        var refreshed = await client.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken = tokens["refreshToken"]!.GetValue<string>() });
        Assert.Equal(HttpStatusCode.OK, refreshed.StatusCode);
    }

    [Fact]
    public async Task External_login_rejects_bad_tokens_unknown_providers_and_account_takeover()
    {
        var client = factory.CreateClient();

        var invalid = await client.PostAsJsonAsync("/api/v1/auth/external", new { provider = "test", token = "garbage" });
        Assert.Equal(HttpStatusCode.Unauthorized, invalid.StatusCode);
        Assert.Equal("external.invalid_token", (await invalid.ReadJsonAsync())["code"]!.GetValue<string>());

        var unknown = await client.PostAsJsonAsync("/api/v1/auth/external", new { provider = "myspace", token = "a|b@c.d|true" });
        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);

        // An unverified address must not be linked to an existing password account.
        var email = $"owner_{Guid.NewGuid():N}@wattly.test";
        await factory.CreateUserClientAsync(email);
        var takeover = await client.PostAsJsonAsync("/api/v1/auth/external", new { provider = "test", token = $"attacker|{email}|false" });
        Assert.Equal(HttpStatusCode.Conflict, takeover.StatusCode);
        Assert.Equal("external.email_in_use", (await takeover.ReadJsonAsync())["code"]!.GetValue<string>());
    }

    [Fact]
    public async Task Tokens_survive_a_server_restart_because_keys_are_stored_in_the_database()
    {
        var email = $"restart_{Guid.NewGuid():N}@wattly.test";
        await factory.CreateUserClientAsync(email);
        var tokens = await (await factory.CreateClient().PostAsJsonAsync("/api/v1/auth/login", new { email, password = "Password12345" })).ReadJsonAsync();

        // The key ring is in the database, not in the container file system that a scale-to-zero restart wipes.
        await using (var connection = new NpgsqlConnection(factory.ConnectionString))
        {
            await connection.OpenAsync();
            await using var count = new NpgsqlCommand("SELECT COUNT(*) FROM \"DataProtectionKeys\"", connection);
            Assert.True((long)(await count.ExecuteScalarAsync())! > 0);
        }

        // A second, independent host (like a freshly started Cloud Run instance) accepts both tokens.
        await using var restarted = factory.WithWebHostBuilder(_ => { });
        var client = restarted.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens["accessToken"]!.GetValue<string>());
        Assert.Equal(email, (await client.GetJsonAsync("/api/v1/users/me"))["email"]!.GetValue<string>());
        var refreshed = await restarted.CreateClient().PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken = tokens["refreshToken"]!.GetValue<string>() });
        Assert.Equal(HttpStatusCode.OK, refreshed.StatusCode);
    }

    [Fact]
    public async Task Contracts_and_own_rate_plans_can_be_corrected_and_deleted()
    {
        var client = await factory.CreateUserClientAsync();
        var scenario = await Scenario.CreateAsync(client);
        var contract = (await client.GetJsonAsync($"/api/v1/properties/{scenario.PropertyId}/energy-contracts")).AsArray().Single()!;
        var plan = (await client.GetJsonAsync($"/api/v1/properties/{scenario.PropertyId}/rate-plans")).AsArray().Single()!;

        // Wrong start date entered during setup is corrected in place.
        var corrected = await client.PutJsonAsync($"/api/v1/energy-contracts/{contract["id"]}", new { tariffId = scenario.TariffId, validFrom = "2025-12-01", contractedPowerKw = 4 });
        Assert.Equal("2025-12-01", corrected["validFrom"]!.GetValue<string>());

        // Rates are replaced as a whole; the old components are removed from the database.
        var updatedPlan = await client.PutJsonAsync($"/api/v1/rate-plans/{plan["id"]}", new
        {
            tariffId = scenario.TariffId,
            name = "Stawki 2026",
            validFrom = "2025-12-01",
            sourceReference = "Faktura FV/2/2026",
            components = new object[] { new { componentType = "Energy", name = "Energia", zoneCode = "DAY", unit = "Kwh", netRate = 0.579m, taxRate = 0.23m } },
        });
        Assert.Equal("Stawki 2026", updatedPlan["name"]!.GetValue<string>());
        Assert.Single(updatedPlan["components"]!.AsArray());
        await using (var connection = new NpgsqlConnection(factory.ConnectionString))
        {
            await connection.OpenAsync();
            await using var count = new NpgsqlCommand($"SELECT COUNT(*) FROM \"TariffRateComponents\" WHERE \"TariffRatePlanId\" = '{plan["id"]}'", connection);
            Assert.Equal(1L, (long)(await count.ExecuteScalarAsync())!);
        }

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/v1/rate-plans/{plan["id"]}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/v1/energy-contracts/{contract["id"]}")).StatusCode);
        Assert.Empty((await client.GetJsonAsync($"/api/v1/properties/{scenario.PropertyId}/rate-plans")).AsArray());

        // Another user cannot touch them.
        var stranger = await factory.CreateUserClientAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.DeleteAsync($"/api/v1/energy-contracts/{Guid.NewGuid()}")).StatusCode);
    }

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
