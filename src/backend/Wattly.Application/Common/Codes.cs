using System.Text.RegularExpressions;

namespace Wattly.Application.Common;

public static partial class Codes
{
    [GeneratedRegex("^[A-Z]{2}$")]
    public static partial Regex CountryCode();

    [GeneratedRegex("^[A-Z]{3}$")]
    public static partial Regex CurrencyCode();

    /// <summary>Catalog / zone codes: upper-case letters, digits, '_' and '-'.</summary>
    [GeneratedRegex("^[A-Z0-9_-]{1,32}$")]
    public static partial Regex Identifier();
}
