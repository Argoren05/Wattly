using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Wattly.Domain.Appliances;

namespace Wattly.Infrastructure.Persistence.Configurations;

/// <summary>EF Core mapping of <c>Appliance</c>: lengths, relations and the unique external id per property.</summary>
internal sealed class ApplianceConfiguration : IEntityTypeConfiguration<Appliance>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<Appliance> b)
    {
        b.Property(x => x.Name).HasMaxLength(60);
        b.Property(x => x.ExternalId).HasMaxLength(100);
        b.Property(x => x.Model).HasMaxLength(40);
        b.HasOne(x => x.Property).WithMany().HasForeignKey(x => x.PropertyId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Usage).WithOne().HasForeignKey(x => x.ApplianceId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.PropertyId, x.ExternalId }).IsUnique().HasFilter("\"ExternalId\" IS NOT NULL");
    }
}

/// <summary>EF Core mapping of <c>ApplianceUsage</c>: precision, one entry per period and a valid period.</summary>
internal sealed class ApplianceUsageConfiguration : IEntityTypeConfiguration<ApplianceUsage>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<ApplianceUsage> b)
    {
        b.Property(x => x.EnergyKwh).HasPrecision(12, 3);
        b.Ignore(x => x.Days);
        b.HasIndex(x => new { x.ApplianceId, x.PeriodStart, x.PeriodEnd }).IsUnique();
        b.ToTable(t =>
        {
            t.HasCheckConstraint("CK_ApplianceUsage_Period", "\"PeriodEnd\" >= \"PeriodStart\"");
            t.HasCheckConstraint("CK_ApplianceUsage_Energy", "\"EnergyKwh\" >= 0");
        });
    }
}
