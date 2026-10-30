using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Wattly.Domain.Households;
using Wattly.Domain.Tariffs;
using Wattly.Infrastructure.Identity;

namespace Wattly.Infrastructure.Persistence.Configurations;

internal sealed class HouseholdConfiguration : IEntityTypeConfiguration<Household>
{
    public void Configure(EntityTypeBuilder<Household> b)
    {
        b.Property(x => x.Name).HasMaxLength(100);
        b.HasIndex(x => x.OwnerUserId);
        b.HasOne<AppUser>().WithMany().HasForeignKey(x => x.OwnerUserId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class PropertyConfiguration : IEntityTypeConfiguration<Property>
{
    public void Configure(EntityTypeBuilder<Property> b)
    {
        b.Property(x => x.Name).HasMaxLength(100);
        b.Property(x => x.AddressLine).HasMaxLength(200);
        b.Property(x => x.PostalCode).HasMaxLength(20);
        b.Property(x => x.City).HasMaxLength(100);
        b.Property(x => x.CountryCode).HasMaxLength(2);
        b.Property(x => x.CurrencyCode).HasMaxLength(3);
        b.Property(x => x.TimeZoneId).HasMaxLength(64);
        b.Property(x => x.MonthlyBudget).HasPrecision(18, 2);
        b.HasOne(x => x.Household).WithMany(h => h.Properties).HasForeignKey(x => x.HouseholdId).OnDelete(DeleteBehavior.Cascade);
        b.ToTable(t => t.HasCheckConstraint("CK_Properties_BillingPeriodMonths", "\"BillingPeriodMonths\" IN (1, 2, 3, 6, 12)"));
    }
}

internal sealed class EnergyContractConfiguration : IEntityTypeConfiguration<EnergyContract>
{
    public void Configure(EntityTypeBuilder<EnergyContract> b)
    {
        b.Property(x => x.ContractedPowerKw).HasPrecision(10, 3);
        b.HasOne(x => x.Property).WithMany().HasForeignKey(x => x.PropertyId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Supplier).WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Operator).WithMany().HasForeignKey(x => x.OperatorId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Tariff).WithMany().HasForeignKey(x => x.TariffId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.PropertyId, x.ValidFrom }).IsUnique();
        b.ToTable(t => t.HasCheckConstraint("CK_EnergyContracts_Validity", "\"ValidTo\" IS NULL OR \"ValidTo\" >= \"ValidFrom\""));
    }
}

internal sealed class EnergyOperatorConfiguration : IEntityTypeConfiguration<EnergyOperator>
{
    public void Configure(EntityTypeBuilder<EnergyOperator> b)
    {
        b.Property(x => x.Name).HasMaxLength(200);
        b.Property(x => x.Code).HasMaxLength(32);
        b.Property(x => x.CountryCode).HasMaxLength(2);
        b.HasIndex(x => x.Code).IsUnique();
    }
}

internal sealed class EnergySupplierConfiguration : IEntityTypeConfiguration<EnergySupplier>
{
    public void Configure(EntityTypeBuilder<EnergySupplier> b)
    {
        b.Property(x => x.Name).HasMaxLength(200);
        b.Property(x => x.Code).HasMaxLength(32);
        b.Property(x => x.CountryCode).HasMaxLength(2);
        b.HasIndex(x => x.Code).IsUnique();
    }
}
