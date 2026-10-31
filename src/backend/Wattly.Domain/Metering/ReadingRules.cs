using Wattly.Domain.Calculations;

namespace Wattly.Domain.Metering;

/// <summary>Problems detected by <see cref="ReadingRules.Check"/>.</summary>
public enum ReadingIssueType
{
    /// <summary>A reading already exists at the same moment.</summary>
    Duplicate,

    /// <summary>Value lower than the previous reading (cumulative register cannot decrease).</summary>
    LowerThanPrevious,

    /// <summary>Back-dated value higher than the next reading.</summary>
    HigherThanNext,

    /// <summary>Suspiciously high consumption – a warning the user can confirm.</summary>
    UnusualJump,
}

/// <summary>Detected issue of a new reading.</summary>
/// <param name="Type">Kind of the issue.</param>
/// <param name="IsBlocking">Blocking issues prevent saving; others only require confirmation.</param>
/// <param name="Message">Explanation for the user.</param>
public sealed record ReadingIssue(ReadingIssueType Type, bool IsBlocking, string Message);

/// <summary>Validation rules for a new reading of a cumulative register against existing active readings.</summary>
public static class ReadingRules
{
    /// <summary>A jump is unusual when the daily rate exceeds the historical average this many times…</summary>
    public const decimal UnusualJumpFactor = 3m;

    /// <summary>…and the increase is larger than this (kWh), so tiny absolute values do not trigger warnings.</summary>
    public const decimal UnusualJumpMinimumKwh = 5m;

    /// <summary>Daily rate considered unusual for a household even without history (kWh/day).</summary>
    public const decimal UnusualDailyRateKwh = 200m;

    /// <summary>Validates a new reading against existing active readings of the same register.</summary>
    /// <param name="existing">Active readings of the register (excluding the one being corrected).</param>
    /// <param name="at">Moment of the new reading.</param>
    /// <param name="value">Value of the new reading.</param>
    /// <returns>Detected issues; empty when the reading is fine.</returns>
    public static IReadOnlyList<ReadingIssue> Check(IReadOnlyCollection<ReadingPoint> existing, DateTimeOffset at, decimal value)
    {
        var issues = new List<ReadingIssue>();
        var ordered = existing.OrderBy(p => p.At).ToList();

        if (ordered.Any(p => p.At == at))
        {
            issues.Add(new ReadingIssue(ReadingIssueType.Duplicate, true, "Istnieje już odczyt tego rejestru z tą samą datą i godziną."));
            return issues;
        }

        var previous = ordered.LastOrDefault(p => p.At < at);
        var next = ordered.FirstOrDefault(p => p.At > at);
        var hasPrevious = ordered.Any(p => p.At < at);

        if (hasPrevious && value < previous.Value)
            issues.Add(new ReadingIssue(ReadingIssueType.LowerThanPrevious, true,
                $"Wskazanie jest niższe niż poprzedni odczyt ({previous.Value} z {previous.At:yyyy-MM-dd HH:mm}). Jeśli licznik został wymieniony, dodaj nowy licznik."));

        if (ordered.Any(p => p.At > at) && value > next.Value)
            issues.Add(new ReadingIssue(ReadingIssueType.HigherThanNext, true,
                $"Wskazanie jest wyższe niż późniejszy odczyt ({next.Value} z {next.At:yyyy-MM-dd HH:mm})."));

        if (issues.Count > 0 || !hasPrevious)
            return issues;

        // Compare the implied daily rate with the historical average before the previous reading.
        var increase = value - previous.Value;
        var days = Math.Max((decimal)(at - previous.At).Ticks / TimeSpan.TicksPerDay, 1m / 24m);
        var dailyRate = increase / days;

        var history = new RegisterSeries(ordered.Where(p => p.At <= previous.At));
        var historicalRate = history.AverageDailyRate();

        var unusual = increase > UnusualJumpMinimumKwh &&
                      (dailyRate > UnusualDailyRateKwh || (historicalRate is > 0 && dailyRate > historicalRate.Value * UnusualJumpFactor));
        if (unusual)
        {
            var reference = historicalRate is > 0 ? $" (średnio dotąd {historicalRate.Value:0.##} kWh/dzień)" : string.Empty;
            issues.Add(new ReadingIssue(ReadingIssueType.UnusualJump, false,
                $"Nietypowo duży wzrost zużycia: {dailyRate:0.##} kWh/dzień{reference}. Sprawdź, czy wartość została wpisana poprawnie."));
        }

        return issues;
    }
}
