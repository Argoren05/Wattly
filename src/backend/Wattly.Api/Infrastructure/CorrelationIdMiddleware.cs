using System.Text.RegularExpressions;

namespace Wattly.Api.Infrastructure;

/// <summary>Propagates <c>X-Correlation-ID</c> (or generates one) and adds it to the logging scope and response.</summary>
/// <param name="next">Next middleware.</param>
/// <param name="logger">Logger used for the scope.</param>
public sealed partial class CorrelationIdMiddleware(RequestDelegate next, ILogger<CorrelationIdMiddleware> logger)
{
    /// <summary>Header carrying the correlation id.</summary>
    public const string HeaderName = "X-Correlation-ID";

    /// <summary>Sets the correlation id for the request and response.</summary>
    /// <param name="context">HTTP context.</param>
    public async Task InvokeAsync(HttpContext context)
    {
        var incoming = context.Request.Headers[HeaderName].ToString();
        var correlationId = SafeId().IsMatch(incoming) ? incoming : context.TraceIdentifier;
        context.TraceIdentifier = correlationId;
        context.Response.Headers[HeaderName] = correlationId;

        using (logger.BeginScope(new Dictionary<string, object> { ["CorrelationId"] = correlationId }))
            await next(context);
    }

    /// <summary>Accepted incoming ids (prevents log injection).</summary>
    [GeneratedRegex("^[A-Za-z0-9_.:-]{1,64}$")]
    private static partial Regex SafeId();
}
