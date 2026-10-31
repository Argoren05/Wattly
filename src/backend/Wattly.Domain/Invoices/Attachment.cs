using Wattly.Domain.Common;

namespace Wattly.Domain.Invoices;

/// <summary>Metadata of a private file stored in <c>IFileStorage</c>.</summary>
public class Attachment : Entity
{
    /// <summary>Only this user can download the file.</summary>
    public Guid OwnerUserId { get; set; }

    /// <summary>Opaque, server-generated storage key (never derived from user input).</summary>
    public required string StorageKey { get; set; }

    /// <summary>Sanitised original file name.</summary>
    public required string FileName { get; set; }

    /// <summary>Content type detected from the file signature.</summary>
    public required string ContentType { get; set; }

    /// <summary>File size in bytes.</summary>
    public long SizeBytes { get; set; }

    /// <summary>Upload time (UTC).</summary>
    public DateTimeOffset CreatedAt { get; set; }
}
