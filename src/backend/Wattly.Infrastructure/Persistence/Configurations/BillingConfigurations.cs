using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Wattly.Domain.Audit;
using Wattly.Domain.Billing;
using Wattly.Domain.Households;
using Wattly.Domain.Invoices;
using Wattly.Domain.Tariffs;
using Wattly.Infrastructure.Identity;
using Wattly.Infrastructure.Storage;

namespace Wattly.Infrastructure.Persistence.Configurations;

/// <summary>EF Core mapping of <c>CostCalculation</c>: lengths, precision, relations, indexes and check constraints.</summary>
internal sealed class CostCalculationConfiguration : IEntityTypeConfiguration<CostCalculation>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<CostCalculation> b)
    {
        b.Property(x => x.ConsumptionKwh).HasPrecision(18, 3);
        b.Property(x => x.EnergyCostNet).HasPrecision(18, 2);
        b.Property(x => x.DistributionCostNet).HasPrecision(18, 2);
        b.Property(x => x.OtherCostNet).HasPrecision(18, 2);
        b.Property(x => x.TotalNet).HasPrecision(18, 2);
        b.Property(x => x.TaxAmount).HasPrecision(18, 2);
        b.Property(x => x.TotalGross).HasPrecision(18, 2);
        b.Property(x => x.CurrencyCode).HasMaxLength(3);
        b.Property(x => x.Assumptions).HasColumnType("text[]");
        b.HasOne<Property>().WithMany().HasForeignKey(x => x.PropertyId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Lines).WithOne().HasForeignKey(x => x.CostCalculationId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.PropertyId, x.CalculatedAt });
    }
}

/// <summary>EF Core mapping of <c>CostCalculationLine</c>: lengths, precision, relations, indexes and check constraints.</summary>
internal sealed class CostCalculationLineConfiguration : IEntityTypeConfiguration<CostCalculationLine>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<CostCalculationLine> b)
    {
        b.Property(x => x.RatePlanName).HasMaxLength(200);
        b.Property(x => x.ComponentName).HasMaxLength(200);
        b.Property(x => x.ZoneCode).HasMaxLength(32);
        b.Property(x => x.Quantity).HasPrecision(18, 4);
        b.Property(x => x.NetRate).HasPrecision(18, 6);
        b.Property(x => x.TaxRate).HasPrecision(5, 4);
        b.Property(x => x.NetAmount).HasPrecision(18, 2);

        // Snapshot: the plan id is informational only, so deleting a plan never alters stored calculations.
        b.HasIndex(x => x.TariffRatePlanId);
    }
}

/// <summary>EF Core mapping of <c>Invoice</c>: lengths, precision, relations, indexes and check constraints.</summary>
internal sealed class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<Invoice> b)
    {
        b.Property(x => x.InvoiceNumber).HasMaxLength(64);
        b.Property(x => x.CurrencyCode).HasMaxLength(3);
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.Property(x => x.ConsumptionKwh).HasPrecision(18, 3);
        b.Property(x => x.TotalNet).HasPrecision(18, 2);
        b.Property(x => x.TotalGross).HasPrecision(18, 2);
        b.HasOne<Property>().WithMany().HasForeignKey(x => x.PropertyId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<EnergySupplier>().WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Attachment>().WithMany().HasForeignKey(x => x.AttachmentId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.PropertyId, x.PeriodEnd });
        b.ToTable(t => t.HasCheckConstraint("CK_Invoices_Period", "\"PeriodEnd\" >= \"PeriodStart\""));
    }
}

/// <summary>EF Core mapping of <c>Attachment</c>: lengths, precision, relations, indexes and check constraints.</summary>
internal sealed class AttachmentConfiguration : IEntityTypeConfiguration<Attachment>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<Attachment> b)
    {
        b.Property(x => x.StorageKey).HasMaxLength(200);
        b.Property(x => x.FileName).HasMaxLength(200);
        b.Property(x => x.ContentType).HasMaxLength(100);
        b.HasIndex(x => x.StorageKey).IsUnique();
        b.HasOne<AppUser>().WithMany().HasForeignKey(x => x.OwnerUserId).OnDelete(DeleteBehavior.Cascade);
    }
}

/// <summary>EF Core mapping of <c>AuditEvent</c>: lengths, precision, relations, indexes and check constraints.</summary>
internal sealed class AuditEventConfiguration : IEntityTypeConfiguration<AuditEvent>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<AuditEvent> b)
    {
        b.Property(x => x.EntityType).HasMaxLength(100);
        b.Property(x => x.Action).HasMaxLength(32);
        b.Property(x => x.ChangesJson).HasColumnType("jsonb");
        b.HasIndex(x => new { x.EntityType, x.EntityId });
        b.HasIndex(x => x.OccurredAt);
    }
}

/// <summary>EF Core mapping of <c>StoredFile</c>: the key is the primary key, content is <c>bytea</c>.</summary>
internal sealed class StoredFileConfiguration : IEntityTypeConfiguration<StoredFile>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<StoredFile> b)
    {
        b.HasKey(x => x.Key);
        b.Property(x => x.Key).HasMaxLength(200);
    }
}
