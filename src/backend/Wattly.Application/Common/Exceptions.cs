namespace Wattly.Application.Common;

/// <summary>Resource does not exist or the current user has no access to it (never reveals which).</summary>
public sealed class NotFoundException(string resource) : Exception($"{resource} nie został znaleziony.")
{
    public string Resource { get; } = resource;
}

public sealed class ValidationFailedException(IReadOnlyDictionary<string, string[]> errors)
    : Exception("Przesłane dane są nieprawidłowe.")
{
    public IReadOnlyDictionary<string, string[]> Errors { get; } = errors;
}

/// <summary>Request conflicts with the current state (duplicates, overlapping periods…).</summary>
public sealed class ConflictException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

public sealed class ForbiddenException(string message = "Brak uprawnień do wykonania operacji.") : Exception(message);
