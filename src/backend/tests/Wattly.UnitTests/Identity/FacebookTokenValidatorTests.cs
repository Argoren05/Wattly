using System.Net;
using System.Text;
using Microsoft.Extensions.Options;
using Wattly.Application.Common;
using Wattly.Infrastructure.Identity.External;

namespace Wattly.UnitTests.Identity;

/// <summary>Tests of <see cref="FacebookTokenValidator"/> against a fake Graph API.</summary>
public class FacebookTokenValidatorTests
{
    /// <summary>Answers Graph API requests from a routing function and records them.</summary>
    private sealed class FakeGraph(Func<Uri, (HttpStatusCode, string)> route) : HttpMessageHandler
    {
        public List<Uri> Requests { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(request.RequestUri!);
            var (status, body) = route(request.RequestUri!);
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") });
        }
    }

    private static (FacebookTokenValidator Validator, FakeGraph Graph) Create(string debug, string me = """{"id":"fb-1","name":"Jan","email":"Jan@Example.com"}""", HttpStatusCode status = HttpStatusCode.OK)
    {
        var graph = new FakeGraph(uri => uri.AbsolutePath.Contains("debug_token") ? (status, debug) : (status, me));
        var http = new HttpClient(graph) { BaseAddress = new Uri("https://graph.facebook.com/") };
        var options = Options.Create(new ExternalAuthOptions { Facebook = new FacebookProviderOptions { AppId = "app-1", AppSecret = "secret" } });
        return (new FacebookTokenValidator(http, options), graph);
    }

    [Fact]
    public async Task Valid_token_for_our_app_returns_confirmed_email()
    {
        var (validator, graph) = Create("""{"data":{"app_id":"app-1","is_valid":true,"user_id":"fb-1"}}""");

        var identity = await validator.ValidateAsync("user-token", null, CancellationToken.None);

        Assert.Equal(new ExternalIdentity(ExternalProviders.Facebook, "fb-1", "jan@example.com", true, "Jan"), identity);
        Assert.Contains("access_token=app-1%7Csecret", graph.Requests[0].Query);
    }

    [Theory]
    [InlineData("""{"data":{"app_id":"other-app","is_valid":true,"user_id":"fb-1"}}""")] // token of another app
    [InlineData("""{"data":{"app_id":"app-1","is_valid":false,"user_id":"fb-1"}}""")]    // expired or revoked
    [InlineData("""{"data":{"app_id":"app-1","is_valid":true,"user_id":"fb-2"}}""")]     // profile of another user
    [InlineData("""{"error":{"message":"bad"}}""")]
    public async Task Invalid_tokens_are_rejected(string debug)
    {
        var (validator, _) = Create(debug);

        await Assert.ThrowsAsync<AuthenticationFailedException>(() => validator.ValidateAsync("user-token", null, CancellationToken.None));
    }

    [Fact]
    public async Task Graph_errors_and_missing_email_are_handled()
    {
        var (failing, _) = Create("{}", status: HttpStatusCode.BadRequest);
        await Assert.ThrowsAsync<AuthenticationFailedException>(() => failing.ValidateAsync("t", null, CancellationToken.None));

        var (noEmail, _) = Create("""{"data":{"app_id":"app-1","is_valid":true,"user_id":"fb-1"}}""", """{"id":"fb-1","name":"Jan"}""");
        var identity = await noEmail.ValidateAsync("t", null, CancellationToken.None);
        Assert.Null(identity.Email);
        Assert.False(identity.EmailVerified);
    }

    [Fact]
    public async Task Empty_token_is_rejected_without_calling_graph()
    {
        var (validator, graph) = Create("{}");

        await Assert.ThrowsAsync<AuthenticationFailedException>(() => validator.ValidateAsync(" ", null, CancellationToken.None));
        Assert.Empty(graph.Requests);
    }
}
