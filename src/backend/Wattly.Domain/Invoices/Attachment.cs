using Wattly.Domain.Common;

namespace Wattly.Domain.Invoices;

public class Attachment : Entity
{
    public Guid OwnerUserId { get; set; }
    public required string StorageKey { get; set; }
    public required string FileName { get; set; }
    public required string ContentType { get; set; }
    public long SizeBytes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
