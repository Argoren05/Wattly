using Wattly.Domain.Calculations;

namespace Wattly.UnitTests;

public class RegisterSeriesTests
{
    private static readonly DateTimeOffset T0 = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private static RegisterSeries Series(params (int Day, decimal Value)[] points) =>
        new(points.Select(p => new ReadingPoint(T0.AddDays(p.Day), p.Value)));

    [Fact]
    public void ValueAt_reading_moment_is_actual()
    {
        var value = Series((0, 100), (10, 200)).ValueAt(T0.AddDays(10));

        Assert.Equal(new EstimatedValue(200, ValueKind.Actual), value);
    }

    [Fact]
    public void ValueAt_between_readings_is_linear_interpolation()
    {
        var value = Series((0, 100), (10, 200)).ValueAt(T0.AddDays(4));

        Assert.Equal(140m, value!.Value.Value);
        Assert.Equal(ValueKind.Interpolated, value.Value.Kind);
    }

    [Fact]
    public void ValueAt_after_last_reading_extrapolates_with_average_rate()
    {
        var value = Series((0, 100), (10, 200)).ValueAt(T0.AddDays(15));

        Assert.Equal(250m, value!.Value.Value);
        Assert.Equal(ValueKind.Extrapolated, value.Value.Kind);
    }

    [Fact]
    public void ValueAt_before_first_reading_is_unknown()
    {
        Assert.Null(Series((5, 100), (10, 200)).ValueAt(T0));
    }

    [Fact]
    public void Single_reading_cannot_be_extrapolated()
    {
        Assert.Null(Series((0, 100)).ValueAt(T0.AddDays(1)));
        Assert.Null(Series((0, 100)).AverageDailyRate());
    }

    [Fact]
    public void Consumption_between_readings_is_exact()
    {
        var result = Series((0, 100), (10, 200), (20, 260)).Consumption(T0, T0.AddDays(20));

        Assert.NotNull(result);
        Assert.Equal(160m, result.Kwh);
        Assert.False(result.IsEstimate);
    }

    [Fact]
    public void Consumption_starting_before_first_reading_is_clamped_and_estimated()
    {
        var result = Series((5, 100), (10, 200)).Consumption(T0, T0.AddDays(10));

        Assert.NotNull(result);
        Assert.Equal(100m, result.Kwh);
        Assert.True(result.StartClamped);
        Assert.True(result.IsEstimate);
        Assert.Equal(T0.AddDays(5), result.EffectiveFrom);
    }

    [Fact]
    public void Average_rate_uses_recent_window()
    {
        // Old readings at a very different pace must not dominate the extrapolation.
        var series = new RegisterSeries(
            [new(T0, 0), new(T0.AddDays(100), 1000), new(T0.AddDays(200), 1100)],
            extrapolationWindow: TimeSpan.FromDays(100));

        Assert.Equal(1m, series.AverageDailyRate());
    }
}
