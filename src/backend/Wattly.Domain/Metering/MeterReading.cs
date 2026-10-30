using Wattly.Domain.Common;

namespace Wattly.Domain.Metering;

/// <summary>
/// Meter register reading – the source of truth for consumption. Readings are never physically modified:
/// a correction creates a new reading that supersedes the previous one, a cancellation marks it as voided.
/// </summary>
public class MeterReading : Entity, IAuditable
{
    /// <summary>Register the reading belongs to.</summary>
    public Guid MeterRegisterId { get; set; }

    /// <summary>Navigation to the register.</summary>
    public MeterRegister MeterRegister { get; set; } = null!;

    /// <summary>Moment of the reading (stored in UTC).</summary>
    public DateTimeOffset ReadingAt { get; set; }

    /// <summary>Cumulative register value (kWh).</summary>
    public decimal Value { get; set; }

    /// <summary>Origin of the value.</summary>
    public ReadingSource Source { get; set; }

    /// <summary>OCR confidence 0–1, when applicable.</summary>
    public decimal? Confidence { get; set; }

    /// <summary>Photo of the meter (optional).</summary>
    public Guid? ImageAttachmentId { get; set; }

    /// <summary>User note.</summary>
    public string? Note { get; set; }

    /// <summary>Lifecycle state.</summary>
    public ReadingStatus Status { get; set; } = ReadingStatus.Active;

    /// <summary>For corrections: the reading this one replaces.</summary>
    public Guid? SupersedesReadingId { get; set; }

    /// <summary>Reason given when the reading was voided.</summary>
    public string? VoidReason { get; set; }

    /// <summary>User who entered the reading.</summary>
    public Guid CreatedByUserId { get; set; }

    /// <summary>Creation time (UTC).</summary>
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>When the status last changed (UTC).</summary>
    public DateTimeOffset? StatusChangedAt { get; set; }
}
