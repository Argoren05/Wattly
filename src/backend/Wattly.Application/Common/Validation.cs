namespace Wattly.Application.Common;

/// <summary>Collects field errors and throws a single <see cref="ValidationFailedException"/>.</summary>
public sealed class Validation
{
    private readonly Dictionary<string, List<string>> _errors = new(StringComparer.Ordinal);

    public Validation Require(bool condition, string field, string message)
    {
        if (!condition)
            Add(field, message);
        return this;
    }

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

    public Validation Add(string field, string message)
    {
        if (!_errors.TryGetValue(field, out var list))
            _errors[field] = list = [];
        list.Add(message);
        return this;
    }

    public bool IsValid => _errors.Count == 0;

    public void ThrowIfInvalid()
    {
        if (!IsValid)
            throw new ValidationFailedException(_errors.ToDictionary(e => e.Key, e => e.Value.ToArray()));
    }

    public static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
