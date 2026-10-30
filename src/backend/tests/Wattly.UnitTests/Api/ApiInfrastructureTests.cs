using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Wattly.Api.Infrastructure;
using Wattly.Application.Common;
using Wattly.Domain.Common;

namespace Wattly.UnitTests.Api;

/// <summary>Tests of API infrastructure: error mapping, correlation id and current user.</summary>
public class ApiInfrastructureTests
{
    /// <summary>Runs the exception handler and returns status and parsed body.</summary>
    private static async Task<(int Status, JsonElement Body)> Handle(Exception exception)
    {
        var services = new ServiceCollection().AddLogging().AddProblemDetails().BuildServiceProvider();
        var context = new DefaultHttpContext { RequestServices = services };
        context.Response.Body = new MemoryStream();
        var handler = new ProblemExceptionHandler(services.GetRequiredService<IProblemDetailsService>(), NullLogger<ProblemExceptionHandler>.Instance);

        Assert.True(await handler.TryHandleAsync(context, exception, CancellationToken.None));

        context.Response.Body.Position = 0;
        return (context.Response.StatusCode, JsonDocument.Parse(context.Response.Body).RootElement);
    }

    [Fact]
    public async Task Validation_errors_become_400_with_field_messages()
    {
        var (status, body) = await Handle(new ValidationFailedException(new Dictionary<string, string[]> { ["Value"] = ["Zła wartość"] }));

        Assert.Equal(400, status);
        Assert.Equal("Zła wartość", body.GetProperty("errors").GetProperty("Value")[0].GetString());
    }

    [Theory]
    [InlineData(typeof(NotFoundException), 404)]
    [InlineData(typeof(ForbiddenException), 403)]
    [InlineData(typeof(UnauthorizedAccessException), 401)]
    [InlineData(typeof(InvalidOperationException), 500)]
    public async Task Exceptions_map_to_status_codes(Type type, int expected)
    {
        Exception exception = type == typeof(NotFoundException) ? new NotFoundException("X")
            : type == typeof(ForbiddenException) ? new ForbiddenException()
            : (Exception)Activator.CreateInstance(type)!;

        var (status, body) = await Handle(exception);

        Assert.Equal(expected, status);
        if (expected == 500)
            Assert.Equal("Wystąpił nieoczekiwany błąd.", body.GetProperty("title").GetString());
    }

    [Fact]
    public async Task Conflicts_and_domain_errors_carry_stable_code()
    {
        var (conflict, conflictBody) = await Handle(new ConflictException("reading.duplicate", "Duplikat"));
        var (domain, domainBody) = await Handle(new DomainException("rule.x", "Reguła"));

        Assert.Equal(409, conflict);
        Assert.Equal("reading.duplicate", conflictBody.GetProperty("code").GetString());
        Assert.Equal(422, domain);
        Assert.Equal("rule.x", domainBody.GetProperty("code").GetString());
    }

    [Theory]
    [InlineData("abc-123", "abc-123")]
    [InlineData("bad id\nInjected: header", null)]
    [InlineData("", null)]
    public async Task Correlation_id_is_propagated_only_when_safe(string incoming, string? expected)
    {
        var context = new DefaultHttpContext { TraceIdentifier = "generated" };
        context.Request.Headers[CorrelationIdMiddleware.HeaderName] = incoming;
        var middleware = new CorrelationIdMiddleware(_ => Task.CompletedTask, NullLogger<CorrelationIdMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        Assert.Equal(expected ?? "generated", context.Response.Headers[CorrelationIdMiddleware.HeaderName].ToString());
        Assert.Equal(expected ?? "generated", context.TraceIdentifier);
    }

    [Fact]
    public void Current_user_is_read_from_claims()
    {
        var id = Guid.NewGuid();
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, id.ToString()), new Claim(ClaimTypes.Role, Roles.Admin)], "Bearer"));
        var user = new HttpCurrentUser(new HttpContextAccessor { HttpContext = new DefaultHttpContext { User = principal } });

        Assert.True(user.IsAuthenticated);
        Assert.Equal(id, user.UserId);
        Assert.True(user.IsAdmin);
    }

    [Fact]
    public void Anonymous_request_has_no_user_id()
    {
        var user = new HttpCurrentUser(new HttpContextAccessor { HttpContext = new DefaultHttpContext() });

        Assert.False(user.IsAuthenticated);
        Assert.False(user.IsAdmin);
        Assert.Throws<UnauthorizedAccessException>(() => user.UserId);
    }

    [Fact]
    public async Task Development_email_sender_completes_without_sending()
    {
        var sender = new DevelopmentEmailSender(NullLogger<DevelopmentEmailSender>.Instance);
        var user = new Wattly.Infrastructure.Identity.AppUser();

        await sender.SendConfirmationLinkAsync(user, "a@b.c", "link");
        await sender.SendPasswordResetLinkAsync(user, "a@b.c", "link");
        await sender.SendPasswordResetCodeAsync(user, "a@b.c", "code");
    }
}
