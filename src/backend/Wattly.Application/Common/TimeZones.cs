namespace Wattly.Application.Common;

/// <summary>Time zone helpers; calendar dates are always interpreted in the property time zone.</summary>
public static class TimeZones
{
    /// <summary>Resolves an IANA time zone id.</summary>
    /// <param name="id">Time zone id.</param>
    /// <param name="timeZone">Resolved zone (UTC when not found).</param>
    public static bool TryResolve(string? id, out TimeZoneInfo timeZone)
    {
        timeZone = TimeZoneInfo.Utc;
        if (string.IsNullOrWhiteSpace(id))
            return false;

        try
        {
            timeZone = TimeZoneInfo.FindSystemTimeZoneById(id);
            return true;
        }
        catch (Exception e) when (e is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            return false;
        }
    }

    /// <summary>Resolves a time zone id or throws for unknown ids.</summary>
    /// <param name="id">Time zone id.</param>
    public static TimeZoneInfo Resolve(string id) =>
        TryResolve(id, out var tz) ? tz : throw new InvalidOperationException($"Unknown time zone '{id}'.");

    /// <summary>Instant of local midnight starting <paramref name="date"/> in the given time zone (UTC offset).</summary>
    /// <param name="date">Calendar date.</param>
    /// <param name="timeZone">Time zone.</param>
    public static DateTimeOffset StartOfDay(DateOnly date, TimeZoneInfo timeZone)
    {
        var local = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        while (timeZone.IsInvalidTime(local))
            local = local.AddMinutes(30);
        return new DateTimeOffset(local, timeZone.GetUtcOffset(local)).ToUniversalTime();
    }

    /// <summary>Calendar date of an instant in the given time zone.</summary>
    /// <param name="instant">Instant.</param>
    /// <param name="timeZone">Time zone.</param>
    public static DateOnly LocalDate(DateTimeOffset instant, TimeZoneInfo timeZone) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(instant, timeZone).DateTime);
}
