namespace Wattly.Domain.Calculations;

public readonly record struct ReadingPoint(DateTimeOffset At, decimal Value);

public enum ValueKind
{
    /// <summary>Value comes directly from a reading.</summary>
    Actual,

    /// <summary>Linear interpolation between two readings.</summary>
    Interpolated,

    /// <summary>Extrapolation beyond the last reading using recent average consumption.</summary>
    Extrapolated,
}

public readonly record struct EstimatedValue(decimal Value, ValueKind Kind);

public sealed record ConsumptionEstimate(
    decimal Kwh,
    DateTimeOffset EffectiveFrom,
    DateTimeOffset EffectiveTo,
    ValueKind StartKind,
    ValueKind EndKind,
    bool StartClamped)
{
    public bool IsEstimate => StartKind != ValueKind.Actual || EndKind != ValueKind.Actual || StartClamped;
}

/// <summary>
/// Time series of readings of a single cumulative register. Readings are the source of truth;
/// any value between or after readings is an explicit estimate (linear interpolation / extrapolation).
/// </summary>
public sealed class RegisterSeries
{
    /// <summary>History window used to compute the average consumption for extrapolation.</summary>
    public static readonly TimeSpan DefaultExtrapolationWindow = TimeSpan.FromDays(90);

    private readonly ReadingPoint[] _points;
    private readonly TimeSpan _extrapolationWindow;

    public RegisterSeries(IEnumerable<ReadingPoint> points, TimeSpan? extrapolationWindow = null)
    {
        _points = points.OrderBy(p => p.At).ToArray();
        _extrapolationWindow = extrapolationWindow ?? DefaultExtrapolationWindow;
    }

    public IReadOnlyList<ReadingPoint> Points => _points;
    public ReadingPoint? First => _points.Length > 0 ? _points[0] : null;
    public ReadingPoint? Last => _points.Length > 0 ? _points[^1] : null;

    public EstimatedValue? ValueAt(DateTimeOffset at)
    {
        if (_points.Length == 0 || at < _points[0].At)
            return null;

        var index = Array.FindLastIndex(_points, p => p.At <= at);
        var before = _points[index];
        if (before.At == at)
            return new EstimatedValue(before.Value, ValueKind.Actual);

        if (index < _points.Length - 1)
        {
            var after = _points[index + 1];
            return new EstimatedValue(Interpolate(before, after, at), ValueKind.Interpolated);
        }

        var dailyRate = AverageDailyRate();
        if (dailyRate is null)
            return null;

        var days = (decimal)(at - before.At).Ticks / TimeSpan.TicksPerDay;
        return new EstimatedValue(before.Value + dailyRate.Value * days, ValueKind.Extrapolated);
    }

    /// <summary>Consumption in [from, to). Returns null when there is not enough data.</summary>
    public ConsumptionEstimate? Consumption(DateTimeOffset from, DateTimeOffset to)
    {
        if (to <= from || _points.Length == 0 || to <= _points[0].At)
            return null;

        var clamped = from < _points[0].At;
        var effectiveFrom = clamped ? _points[0].At : from;

        var start = ValueAt(effectiveFrom);
        var end = ValueAt(to);
        if (start is null || end is null)
            return null;

        var kwh = Math.Max(0m, end.Value.Value - start.Value.Value);
        return new ConsumptionEstimate(kwh, effectiveFrom, to, start.Value.Kind, end.Value.Kind, clamped);
    }

    /// <summary>
    /// Average consumption per day based on readings from the last <c>extrapolationWindow</c> before the last reading
    /// (at least the last two readings). Null when fewer than two readings exist.
    /// </summary>
    public decimal? AverageDailyRate()
    {
        if (_points.Length < 2)
            return null;

        var last = _points[^1];
        var windowStart = last.At - _extrapolationWindow;
        var reference = _points.FirstOrDefault(p => p.At >= windowStart);
        if (reference.At == last.At)
            reference = _points[^2];

        var days = (decimal)(last.At - reference.At).Ticks / TimeSpan.TicksPerDay;
        return days <= 0 ? null : Math.Max(0m, (last.Value - reference.Value) / days);
    }

    private static decimal Interpolate(ReadingPoint before, ReadingPoint after, DateTimeOffset at)
    {
        var fraction = (decimal)(at - before.At).Ticks / (after.At - before.At).Ticks;
        return before.Value + (after.Value - before.Value) * fraction;
    }
}
