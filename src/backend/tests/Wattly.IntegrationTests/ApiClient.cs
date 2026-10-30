using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Wattly.IntegrationTests;

public static class ApiClient
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    public static async Task<HttpClient> CreateUserClientAsync(this WattlyApiFactory factory, string? email = null, string password = "Password12345")
    {
        email ??= $"user_{Guid.NewGuid():N}@wattly.test";
        var client = factory.CreateClient();
        var register = await client.PostAsJsonAsync("/api/v1/auth/register", new { email, password });
        register.EnsureSuccessStatusCode();
        return await LoginAsync(factory, email, password);
    }

    public static async Task<HttpClient> LoginAsync(this WattlyApiFactory factory, string email, string password)
    {
        var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        login.EnsureSuccessStatusCode();
        var token = (await login.Content.ReadFromJsonAsync<JsonObject>())!["accessToken"]!.GetValue<string>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    public static async Task<JsonNode> ReadJsonAsync(this HttpResponseMessage response) =>
        JsonNode.Parse(await response.Content.ReadAsStringAsync())!;

    public static async Task<JsonNode> PostJsonAsync(this HttpClient client, string url, object body)
    {
        var response = await client.PostAsJsonAsync(url, body, Json);
        Assert.True(response.IsSuccessStatusCode, $"POST {url} -> {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return await response.ReadJsonAsync();
    }

    public static async Task<JsonNode> PutJsonAsync(this HttpClient client, string url, object body)
    {
        var response = await client.PutAsJsonAsync(url, body, Json);
        Assert.True(response.IsSuccessStatusCode, $"PUT {url} -> {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return await response.ReadJsonAsync();
    }

    public static async Task<JsonNode> GetJsonAsync(this HttpClient client, string url)
    {
        var response = await client.GetAsync(url);
        Assert.True(response.IsSuccessStatusCode, $"GET {url} -> {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return await response.ReadJsonAsync();
    }
}
