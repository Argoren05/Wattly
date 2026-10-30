using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Wattly.IntegrationTests;

/// <summary>HTTP helpers for integration tests: user creation, sign-in and JSON calls with readable failures.</summary>
public static class ApiClient
{
    /// <summary>Serializer options matching the API (camelCase, enums as strings).</summary>
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    /// <summary>Registers a new user and returns a client authenticated as that user.</summary>
    public static async Task<HttpClient> CreateUserClientAsync(this WattlyApiFactory factory, string? email = null, string password = "Password12345")
    {
        email ??= $"user_{Guid.NewGuid():N}@wattly.test";
        var client = factory.CreateClient();
        var register = await client.PostAsJsonAsync("/api/v1/auth/register", new { email, password });
        register.EnsureSuccessStatusCode();
        return await LoginAsync(factory, email, password);
    }

    /// <summary>Signs in and returns a client with the bearer token set.</summary>
    public static async Task<HttpClient> LoginAsync(this WattlyApiFactory factory, string email, string password)
    {
        var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        login.EnsureSuccessStatusCode();
        var token = (await login.Content.ReadFromJsonAsync<JsonObject>())!["accessToken"]!.GetValue<string>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>Parses the response body as JSON.</summary>
    public static async Task<JsonNode> ReadJsonAsync(this HttpResponseMessage response) =>
        JsonNode.Parse(await response.Content.ReadAsStringAsync())!;

    /// <summary>POSTs JSON and asserts success (the failure message contains the response body).</summary>
    public static async Task<JsonNode> PostJsonAsync(this HttpClient client, string url, object body)
    {
        var response = await client.PostAsJsonAsync(url, body, Json);
        Assert.True(response.IsSuccessStatusCode, $"POST {url} -> {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return await response.ReadJsonAsync();
    }

    /// <summary>PUTs JSON and asserts success.</summary>
    public static async Task<JsonNode> PutJsonAsync(this HttpClient client, string url, object body)
    {
        var response = await client.PutAsJsonAsync(url, body, Json);
        Assert.True(response.IsSuccessStatusCode, $"PUT {url} -> {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return await response.ReadJsonAsync();
    }

    /// <summary>GETs JSON and asserts success.</summary>
    public static async Task<JsonNode> GetJsonAsync(this HttpClient client, string url)
    {
        var response = await client.GetAsync(url);
        Assert.True(response.IsSuccessStatusCode, $"GET {url} -> {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return await response.ReadJsonAsync();
    }
}
