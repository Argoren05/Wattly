using Wattly.Domain.Common;

namespace Wattly.Domain.Metering;

/// <summary>
/// Meter register reading – the source of truth for consumption. Readings are never physically modified:
/// a correction creates a new reading that supersedes the previous one, a cancellation marks it as voided.
/// </summary>
public class MeterReading : Entity, IAuditable
{
    public Guid MeterRegisterId { get; set; }
    public MeterRegister MeterRegister { get; set; } = null!;

    public DateTimeOffset ReadingAt { get; set; }
    public decimal Value { get; set; }
    public ReadingSource Source { get; set; }

    /// <summary>OCR confidence 0–1, when applicable.</summary>
    public decimal? Confidence { get; set; }

    public Guid? ImageAttachmentId { get; set; }
    public string? Note { get; set; }

    public ReadingStatus Status { get; set; } = ReadingStatus.Active;
    public Guid? SupersedesReadingId { get; set; }
    public string? VoidReason { get; set; }

    public Guid CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? StatusChangedAt { get; set; }
}
