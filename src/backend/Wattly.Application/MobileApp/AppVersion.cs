namespace Wattly.Application.MobileApp;

/// <summary>
/// Comparison of numeric application versions such as <c>1.4.10</c>. Missing parts are treated as zero
/// (<c>1.2</c> equals <c>1.2.0</c>); any suffix after '-' or '+' (pre-release/build metadata) is ignored.
/// </summary>
public static class AppVersion
{
    /// <summary>Checks whether the text is a valid version (1–4 numeric parts).</summary>
    /// <param name="version">Version text.</param>
    public static bool IsValid(string? version) => TryParse(version, out _);

    /// <summary>Compares two versions.</summary>
    /// <param name="left">First version.</param>
    /// <param name="right">Second version.</param>
    /// <returns>Negative when <paramref name="left"/> is older, zero when equal, positive when newer.</returns>
    /// <exception cref="ArgumentException">One of the versions is not valid.</exception>
    public static int Compare(string left, string right)
    {
        if (!TryParse(left, out var a))
            throw new ArgumentException($"Invalid version '{left}'.", nameof(left));
        if (!TryParse(right, out var b))
            throw new ArgumentException($"Invalid version '{right}'.", nameof(right));

        // Compare part by part, padding the shorter version with zeros.
        for (var i = 0; i < Math.Max(a.Length, b.Length); i++)
        {
            var x = i < a.Length ? a[i] : 0;
            var y = i < b.Length ? b[i] : 0;
            if (x != y)
                return x.CompareTo(y);
        }

        return 0;
    }

    /// <summary>Parses a version into numeric parts.</summary>
    private static bool TryParse(string? version, out int[] parts)
    {
        parts = [];
        if (string.IsNullOrWhiteSpace(version))
            return false;

        var core = version.Trim().Split('-', '+')[0];
        var tokens = core.Split('.');
        if (tokens.Length is < 1 or > 4)
            return false;

        var result = new int[tokens.Length];
        for (var i = 0; i < tokens.Length; i++)
        {
            if (!int.TryParse(tokens[i], System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out result[i]))
                return false;
        }

        parts = result;
        return true;
    }
}
