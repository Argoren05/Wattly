using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Wattly.Application.Common;
using Wattly.Domain.Common;

namespace Wattly.Api.Infrastructure;

/// <summary>Maps application exceptions to RFC 9457 Problem Details without leaking internal details.</summary>
/// <param name="problemDetails">Problem details writer.</param>
/// <param name="logger">Logger.</param>
public sealed class ProblemExceptionHandler(IProblemDetailsService problemDetails, ILogger<ProblemExceptionHandler> logger) : IExceptionHandler
{
    /// <inheritdoc />
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        ProblemDetails problem = exception switch
        {
            ValidationFailedException e => new ValidationProblemDetails(e.Errors.ToDictionary(x => x.Key, x => x.Value))
            {
                Status = StatusCodes.Status400BadRequest,
                Title = e.Message,
            },
            NotFoundException e => new ProblemDetails { Status = StatusCodes.Status404NotFound, Title = e.Message },
            ConflictException e => WithCode(new ProblemDetails { Status = StatusCodes.Status409Conflict, Title = e.Message }, e.Code),
            DomainException e => WithCode(new ProblemDetails { Status = StatusCodes.Status422UnprocessableEntity, Title = e.Message }, e.Code),
            ForbiddenException e => new ProblemDetails { Status = StatusCodes.Status403Forbidden, Title = e.Message },
            UnauthorizedAccessException => new ProblemDetails { Status = StatusCodes.Status401Unauthorized, Title = "Wymagane jest zalogowanie." },
            BadHttpRequestException e => new ProblemDetails { Status = e.StatusCode, Title = "Nieprawidłowe żądanie." },
            _ => new ProblemDetails { Status = StatusCodes.Status500InternalServerError, Title = "Wystąpił nieoczekiwany błąd." },
        };

        if (problem.Status >= 500)
            logger.LogError(exception, "Unhandled exception");
        else
            logger.LogInformation("Request failed with {Status}: {Message}", problem.Status, exception.Message);

        httpContext.Response.StatusCode = problem.Status!.Value;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem,
            Exception = exception,
        });
    }

    /// <summary>Adds the stable error code as the <c>code</c> extension.</summary>
    private static ProblemDetails WithCode(ProblemDetails problem, string code)
    {
        problem.Extensions["code"] = code;
        return problem;
    }
}
