namespace Wattly.Domain.Calculations;

/// <summary>Single reading of a cumulative register.</summary>
/// <param name="At">Moment of the reading.</param>
/// <param name="Value">Cumulative register value (kWh).</param>
public readonly record struct ReadingPoint(DateTimeOffset At, decimal Value);

/// <summary>How a register value at a given moment was obtained.</summary>
public enum ValueKind
{
    /// <summary>Value comes directly from a reading.</summary>
    Actual,

    /// <summary>Linear interpolation between two readings.</summary>
    Interpolated,

    /// <summary>Extrapolation beyond the last reading using recent average consumption.</summary>
    Extrapolated,
}

/// <summary>Register value at a moment together with its provenance.</summary>
/// <param name="Value">Register value (kWh).</param>
/// <param name="Kind">Whether the value is actual or estimated.</param>
public readonly record struct EstimatedValue(decimal Value, ValueKind Kind);

/// <summary>Consumption of one register in a period, with information on how it was estimated.</summary>
/// <param name="Kwh">Consumption (never negative).</param>
/// <param name="EffectiveFrom">Actual start used (later than requested when the period starts before the first reading).</param>
/// <param name="EffectiveTo">End of the period.</param>
/// <param name="StartKind">Provenance of the start value.</param>
/// <param name="EndKind">Provenance of the end value.</param>
/// <param name="StartClamped">True when the start was moved to the first reading.</param>
public sealed record ConsumptionEstimate(
    decimal Kwh,
    DateTimeOffset EffectiveFrom,
    DateTimeOffset EffectiveTo,
    ValueKind StartKind,
    ValueKind EndKind,
    bool StartClamped)
{
    /// <summary>True when any part of the result is not taken directly from readings.</summary>
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

    /// <summary>Creates a series from readings in any order.</summary>
    /// <param name="points">Active readings of one register.</param>
    /// <param name="extrapolationWindow">History window for the average rate; defaults to <see cref="DefaultExtrapolationWindow"/>.</param>
    public RegisterSeries(IEnumerable<ReadingPoint> points, TimeSpan? extrapolationWindow = null)
    {
        _points = points.OrderBy(p => p.At).ToArray();
        _extrapolationWindow = extrapolationWindow ?? DefaultExtrapolationWindow;
    }

    /// <summary>Readings ordered by time.</summary>
    public IReadOnlyList<ReadingPoint> Points => _points;

    /// <summary>Earliest reading, or null for an empty series.</summary>
    public ReadingPoint? First => _points.Length > 0 ? _points[0] : null;

    /// <summary>Latest reading, or null for an empty series.</summary>
    public ReadingPoint? Last => _points.Length > 0 ? _points[^1] : null;

    /// <summary>
    /// Register value at <paramref name="at"/>: the reading itself, linear interpolation between neighbours,
    /// or extrapolation after the last reading. Null before the first reading or when extrapolation is impossible.
    /// </summary>
    /// <param name="at">Moment to evaluate.</param>
    public EstimatedValue? ValueAt(DateTimeOffset at)
    {
        if (_points.Length == 0 || at < _points[0].At)
            return null;

        // Last reading not later than the requested moment.
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
    /// <param name="from">Start of the period (inclusive).</param>
    /// <param name="to">End of the period (exclusive).</param>
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
        // Only the last reading falls in the window – fall back to the previous reading.
        if (reference.At == last.At)
            reference = _points[^2];

        var days = (decimal)(last.At - reference.At).Ticks / TimeSpan.TicksPerDay;
        return days <= 0 ? null : Math.Max(0m, (last.Value - reference.Value) / days);
    }

    /// <summary>Linear interpolation of the register value between two readings.</summary>
    private static decimal Interpolate(ReadingPoint before, ReadingPoint after, DateTimeOffset at)
    {
        var fraction = (decimal)(at - before.At).Ticks / (after.At - before.At).Ticks;
        return before.Value + (after.Value - before.Value) * fraction;
    }
}
