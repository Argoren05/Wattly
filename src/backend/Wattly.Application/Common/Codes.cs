using System.Text.RegularExpressions;

namespace Wattly.Application.Common;

/// <summary>Validation patterns for codes.</summary>
public static partial class Codes
{
    /// <summary>ISO 3166-1 alpha-2 country code.</summary>
    [GeneratedRegex("^[A-Z]{2}$")]
    public static partial Regex CountryCode();

    /// <summary>ISO 4217 currency code.</summary>
    [GeneratedRegex("^[A-Z]{3}$")]
    public static partial Regex CurrencyCode();

    /// <summary>Catalog / zone codes: upper-case letters, digits, '_' and '-'.</summary>
    [GeneratedRegex("^[A-Z0-9_-]{1,32}$")]
    public static partial Regex Identifier();
}
