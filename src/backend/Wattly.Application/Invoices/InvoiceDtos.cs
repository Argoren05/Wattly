namespace Wattly.Application.Invoices;

public sealed record InvoiceComparisonDto(
    decimal EstimatedGross,
    decimal EstimatedConsumptionKwh,
    decimal DifferenceGross,
    decimal? DifferencePercent,
    bool IsEstimate,
    bool IsComplete);

public sealed record AttachmentDto(Guid Id, string FileName, string ContentType, long SizeBytes, DateTimeOffset CreatedAt);

public sealed record InvoiceDto(
    Guid Id,
    Guid PropertyId,
    Guid? SupplierId,
    string InvoiceNumber,
    DateOnly IssueDate,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    decimal? ConsumptionKwh,
    decimal? TotalNet,
    decimal TotalGross,
    string CurrencyCode,
    string? Notes,
    AttachmentDto? Attachment,
    InvoiceComparisonDto? Comparison,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record InvoiceRequest(
    Guid? SupplierId,
    string InvoiceNumber,
    DateOnly IssueDate,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    decimal? ConsumptionKwh,
    decimal? TotalNet,
    decimal TotalGross,
    string? Notes);

public sealed record FileContent(string FileName, string ContentType, Stream Content);
