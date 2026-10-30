using Wattly.Domain.Common;

namespace Wattly.Domain.Invoices;

/// <summary>Invoice issued by the energy supplier, entered by the user to compare with Wattly's estimate.</summary>
public class Invoice : Entity, IAuditable
{
    /// <summary>Property the invoice concerns.</summary>
    public Guid PropertyId { get; set; }

    /// <summary>Issuing supplier (optional).</summary>
    public Guid? SupplierId { get; set; }

    /// <summary>Invoice number.</summary>
    public required string InvoiceNumber { get; set; }

    /// <summary>Issue date.</summary>
    public DateOnly IssueDate { get; set; }

    /// <summary>First day of the invoiced period.</summary>
    public DateOnly PeriodStart { get; set; }

    /// <summary>Inclusive last day of the invoiced period.</summary>
    public DateOnly PeriodEnd { get; set; }

    /// <summary>Consumption stated on the invoice (optional).</summary>
    public decimal? ConsumptionKwh { get; set; }

    /// <summary>Net total (optional).</summary>
    public decimal? TotalNet { get; set; }

    /// <summary>Gross total to pay.</summary>
    public decimal TotalGross { get; set; }

    /// <summary>Currency of the amounts.</summary>
    public string CurrencyCode { get; set; } = "PLN";

    /// <summary>Scanned invoice (optional).</summary>
    public Guid? AttachmentId { get; set; }

    /// <summary>User notes.</summary>
    public string? Notes { get; set; }

    /// <summary>Creation time (UTC).</summary>
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Last modification time (UTC).</summary>
    public DateTimeOffset UpdatedAt { get; set; }
}
