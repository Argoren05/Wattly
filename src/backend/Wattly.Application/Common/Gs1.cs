namespace Wattly.Application.Common;

/// <summary>
/// GS1 identifiers. Polish metering point numbers (PPE, e.g. <c>590322428100789765</c>) are GSRN codes:
/// 18 digits, the last one being a GS1 check digit, so a mistyped or misscanned number can be detected.
/// </summary>
public static class Gs1
{
    /// <summary>Number of digits of a GSRN.</summary>
    public const int GsrnLength = 18;

    /// <summary>Removes spaces and dashes users type to group digits (e.g. "5903 2242 …").</summary>
    /// <param name="value">Raw input.</param>
    /// <returns>The value without separators, or null for empty input.</returns>
    public static string? Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        return new string(value.Where(c => c is not (' ' or '-')).ToArray());
    }

    /// <summary>Checks that the value is an 18-digit GSRN with a correct check digit.</summary>
    /// <param name="value">Normalized value (see <see cref="Normalize"/>).</param>
    public static bool IsValidGsrn(string value) =>
        value.Length == GsrnLength && value.All(char.IsAsciiDigit) && CheckDigit(value.AsSpan(0, GsrnLength - 1)) == value[^1] - '0';

    /// <summary>
    /// GS1 check digit: digits are weighted 3,1,3,1… starting from the rightmost data digit;
    /// the check digit tops the weighted sum up to the next multiple of 10.
    /// </summary>
    /// <param name="data">Digits without the check digit.</param>
    public static int CheckDigit(ReadOnlySpan<char> data)
    {
        var sum = 0;
        for (var i = 0; i < data.Length; i++)
        {
            var digit = data[data.Length - 1 - i] - '0';
            sum += i % 2 == 0 ? digit * 3 : digit;
        }

        return (10 - sum % 10) % 10;
    }
}
