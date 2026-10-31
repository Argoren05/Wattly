namespace Wattly.Application.Common;

/// <summary>Resource does not exist or the current user has no access to it (never reveals which).</summary>
/// <param name="resource">Polish name of the resource, used in the message.</param>
public sealed class NotFoundException(string resource) : Exception($"{resource} nie został znaleziony.")
{
    /// <summary>Name of the missing resource.</summary>
    public string Resource { get; } = resource;
}

/// <summary>Request data failed validation (HTTP 400).</summary>
/// <param name="errors">Messages per field.</param>
public sealed class ValidationFailedException(IReadOnlyDictionary<string, string[]> errors)
    : Exception("Przesłane dane są nieprawidłowe.")
{
    /// <summary>Messages per field.</summary>
    public IReadOnlyDictionary<string, string[]> Errors { get; } = errors;
}

/// <summary>Request conflicts with the current state (duplicates, overlapping periods…).</summary>
/// <param name="code">Stable error code.</param>
/// <param name="message">Message for the user.</param>
public sealed class ConflictException(string code, string message) : Exception(message)
{
    /// <summary>Stable error code (e.g. reading.duplicate).</summary>
    public string Code { get; } = code;
}

/// <summary>The user is authenticated but not allowed to perform the operation (HTTP 403).</summary>
/// <param name="message">Message for the user.</param>
public sealed class ForbiddenException(string message = "Brak uprawnień do wykonania operacji.") : Exception(message);

/// <summary>Credentials or an external identity token were rejected (HTTP 401).</summary>
/// <param name="code">Stable error code, e.g. <c>external.invalid_token</c>.</param>
/// <param name="message">Message for the user.</param>
public sealed class AuthenticationFailedException(string code, string message) : Exception(message)
{
    /// <summary>Stable error code.</summary>
    public string Code { get; } = code;
}
