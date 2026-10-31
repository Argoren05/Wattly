using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Wattly.Domain.Invoices;
using Wattly.Domain.Metering;

namespace Wattly.Infrastructure.Persistence.Configurations;

/// <summary>EF Core mapping of <c>Meter</c>: lengths, precision, relations, indexes and check constraints.</summary>
internal sealed class MeterConfiguration : IEntityTypeConfiguration<Meter>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<Meter> b)
    {
        b.Property(x => x.Name).HasMaxLength(100);
        b.Property(x => x.SerialNumber).HasMaxLength(64);
        b.HasOne(x => x.Property).WithMany().HasForeignKey(x => x.PropertyId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Registers).WithOne(r => r.Meter).HasForeignKey(r => r.MeterId).OnDelete(DeleteBehavior.Cascade);
    }
}

/// <summary>EF Core mapping of <c>MeterRegister</c>: lengths, precision, relations, indexes and check constraints.</summary>
internal sealed class MeterRegisterConfiguration : IEntityTypeConfiguration<MeterRegister>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<MeterRegister> b)
    {
        b.Property(x => x.Name).HasMaxLength(100);
        b.Property(x => x.Code).HasMaxLength(32);
        b.Property(x => x.ZoneCode).HasMaxLength(32);
        b.Property(x => x.Unit).HasMaxLength(16);
        b.HasMany(x => x.Readings).WithOne(r => r.MeterRegister).HasForeignKey(r => r.MeterRegisterId).OnDelete(DeleteBehavior.Cascade);
        b.ToTable(t => t.HasCheckConstraint("CK_MeterRegisters_DecimalPlaces", "\"DecimalPlaces\" BETWEEN 0 AND 4"));
    }
}

/// <summary>EF Core mapping of <c>MeterReading</c>: lengths, precision, relations, indexes and check constraints.</summary>
internal sealed class MeterReadingConfiguration : IEntityTypeConfiguration<MeterReading>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<MeterReading> b)
    {
        b.Property(x => x.Value).HasPrecision(18, 4);
        b.Property(x => x.Confidence).HasPrecision(5, 4);
        b.Property(x => x.Note).HasMaxLength(500);
        b.Property(x => x.VoidReason).HasMaxLength(500);
        b.HasOne<Attachment>().WithMany().HasForeignKey(x => x.ImageAttachmentId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.MeterRegisterId, x.ReadingAt });

        // Database-level guarantee: at most one active reading per register and moment.
        b.HasIndex(x => new { x.MeterRegisterId, x.ReadingAt })
            .HasDatabaseName("UX_MeterReadings_Active_RegisterTime")
            .IsUnique()
            .HasFilter("\"Status\" = 'Active'");
        b.ToTable(t => t.HasCheckConstraint("CK_MeterReadings_Value", "\"Value\" >= 0"));
    }
}
