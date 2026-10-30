namespace Wattly.Application.Invoices;

/// <summary>Comparison of an invoice with Wattly's estimate for the same period.</summary>
/// <param name="EstimatedGross">Estimated gross cost.</param>
/// <param name="EstimatedConsumptionKwh">Estimated consumption.</param>
/// <param name="DifferenceGross">Invoice minus estimate.</param>
/// <param name="DifferencePercent">Difference relative to the estimate.</param>
/// <param name="IsEstimate">Whether the estimate used estimated values.</param>
/// <param name="IsComplete">Whether data were sufficient.</param>
public sealed record InvoiceComparisonDto(
    decimal EstimatedGross,
    decimal EstimatedConsumptionKwh,
    decimal DifferenceGross,
    decimal? DifferencePercent,
    bool IsEstimate,
    bool IsComplete);

/// <summary>Attachment metadata.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="FileName">File name.</param>
/// <param name="ContentType">Content type.</param>
/// <param name="SizeBytes">Size.</param>
/// <param name="CreatedAt">Upload time.</param>
public sealed record AttachmentDto(Guid Id, string FileName, string ContentType, long SizeBytes, DateTimeOffset CreatedAt);

/// <summary>Invoice with optional attachment and comparison.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="PropertyId">Property.</param>
/// <param name="SupplierId">Supplier.</param>
/// <param name="InvoiceNumber">Number.</param>
/// <param name="IssueDate">Issue date.</param>
/// <param name="PeriodStart">Period start.</param>
/// <param name="PeriodEnd">Period end (inclusive).</param>
/// <param name="ConsumptionKwh">Consumption on the invoice.</param>
/// <param name="TotalNet">Net total.</param>
/// <param name="TotalGross">Gross total.</param>
/// <param name="CurrencyCode">Currency.</param>
/// <param name="Notes">Notes.</param>
/// <param name="Attachment">Attachment.</param>
/// <param name="Comparison">Comparison with the estimate (null without rates/readings).</param>
/// <param name="CreatedAt">Creation time.</param>
/// <param name="UpdatedAt">Modification time.</param>
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

/// <summary>Create/update request for an invoice.</summary>
/// <param name="SupplierId">Supplier.</param>
/// <param name="InvoiceNumber">Number.</param>
/// <param name="IssueDate">Issue date.</param>
/// <param name="PeriodStart">Period start.</param>
/// <param name="PeriodEnd">Period end (inclusive).</param>
/// <param name="ConsumptionKwh">Consumption.</param>
/// <param name="TotalNet">Net total.</param>
/// <param name="TotalGross">Gross total.</param>
/// <param name="Notes">Notes.</param>
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

/// <summary>Downloadable file.</summary>
/// <param name="FileName">File name.</param>
/// <param name="ContentType">Content type.</param>
/// <param name="Content">Stream (disposed by the caller).</param>
public sealed record FileContent(string FileName, string ContentType, Stream Content);
