using Wattly.Domain.Common;

namespace Wattly.Domain.Invoices;

public class Invoice : Entity, IAuditable
{
    public Guid PropertyId { get; set; }
    public Guid? SupplierId { get; set; }

    public required string InvoiceNumber { get; set; }
    public DateOnly IssueDate { get; set; }
    public DateOnly PeriodStart { get; set; }

    /// <summary>Inclusive last day of the invoiced period.</summary>
    public DateOnly PeriodEnd { get; set; }

    public decimal? ConsumptionKwh { get; set; }
    public decimal? TotalNet { get; set; }
    public decimal TotalGross { get; set; }
    public string CurrencyCode { get; set; } = "PLN";

    public Guid? AttachmentId { get; set; }
    public string? Notes { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
