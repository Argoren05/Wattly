using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Wattly.Domain.Households;
using Wattly.Domain.Tariffs;

namespace Wattly.Infrastructure.Persistence.Configurations;

internal sealed class TariffConfiguration : IEntityTypeConfiguration<Tariff>
{
    public void Configure(EntityTypeBuilder<Tariff> b)
    {
        b.Property(x => x.Code).HasMaxLength(32);
        b.Property(x => x.Name).HasMaxLength(100);
        b.Property(x => x.Description).HasMaxLength(1000);
        b.HasIndex(x => x.Code).IsUnique();
        b.OwnsMany(x => x.Zones, z => z.ToJson());
    }
}

internal sealed class TariffRatePlanConfiguration : IEntityTypeConfiguration<TariffRatePlan>
{
    public void Configure(EntityTypeBuilder<TariffRatePlan> b)
    {
        b.Property(x => x.Name).HasMaxLength(200);
        b.Property(x => x.CurrencyCode).HasMaxLength(3);
        b.Property(x => x.SourceReference).HasMaxLength(500);
        b.HasOne(x => x.Tariff).WithMany().HasForeignKey(x => x.TariffId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<EnergySupplier>().WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<EnergyOperator>().WithMany().HasForeignKey(x => x.OperatorId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Property>().WithMany().HasForeignKey(x => x.PropertyId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Components).WithOne().HasForeignKey(x => x.TariffRatePlanId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.TariffId, x.PropertyId, x.ValidFrom });
        b.ToTable(t => t.HasCheckConstraint("CK_TariffRatePlans_Validity", "\"ValidTo\" IS NULL OR \"ValidTo\" >= \"ValidFrom\""));
    }
}

internal sealed class TariffRateComponentConfiguration : IEntityTypeConfiguration<TariffRateComponent>
{
    public void Configure(EntityTypeBuilder<TariffRateComponent> b)
    {
        b.Property(x => x.Name).HasMaxLength(200);
        b.Property(x => x.ZoneCode).HasMaxLength(32);
        b.Property(x => x.NetRate).HasPrecision(18, 6);
        b.Property(x => x.TaxRate).HasPrecision(5, 4);
        b.ToTable(t =>
        {
            t.HasCheckConstraint("CK_TariffRateComponents_NetRate", "\"NetRate\" >= 0");
            t.HasCheckConstraint("CK_TariffRateComponents_TaxRate", "\"TaxRate\" >= 0 AND \"TaxRate\" <= 1");
        });
    }
}
