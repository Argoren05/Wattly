namespace Wattly.Application.Common;

/// <summary>Collects field errors and throws a single <see cref="ValidationFailedException"/>.</summary>
public sealed class Validation
{
    private readonly Dictionary<string, List<string>> _errors = new(StringComparer.Ordinal);

    /// <summary>Adds an error when <paramref name="condition"/> is false.</summary>
    /// <param name="condition">Condition that must hold.</param>
    /// <param name="field">Field name reported to the client.</param>
    /// <param name="message">Error message.</param>
    public Validation Require(bool condition, string field, string message)
    {
        if (!condition)
            Add(field, message);
        return this;
    }

    /// <summary>Validates presence and maximum length of a text field.</summary>
    /// <param name="value">Value.</param>
    /// <param name="field">Field name.</param>
    /// <param name="maxLength">Maximum length after trimming.</param>
    /// <param name="required">Whether an empty value is an error.</param>
    public Validation RequireText(string? value, string field, int maxLength, bool required = true)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            if (required)
                Add(field, "Pole jest wymagane.");
        }
        else if (value.Trim().Length > maxLength)
        {
            Add(field, $"Maksymalna długość to {maxLength} znaków.");
        }

        return this;
    }

    /// <summary>Adds an error for a field.</summary>
    /// <param name="field">Field name.</param>
    /// <param name="message">Error message.</param>
    public Validation Add(string field, string message)
    {
        if (!_errors.TryGetValue(field, out var list))
            _errors[field] = list = [];
        list.Add(message);
        return this;
    }

    /// <summary>True when no error was added.</summary>
    public bool IsValid => _errors.Count == 0;

    /// <summary>Throws <see cref="ValidationFailedException"/> with all collected errors.</summary>
    public void ThrowIfInvalid()
    {
        if (!IsValid)
            throw new ValidationFailedException(_errors.ToDictionary(e => e.Key, e => e.Value.ToArray()));
    }

    /// <summary>Trims a value and converts empty strings to null.</summary>
    /// <param name="value">Value.</param>
    public static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
