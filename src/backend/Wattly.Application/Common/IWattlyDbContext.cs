using Microsoft.EntityFrameworkCore;
using Wattly.Domain.Audit;
using Wattly.Domain.Billing;
using Wattly.Domain.Households;
using Wattly.Domain.Invoices;
using Wattly.Domain.Metering;
using Wattly.Domain.Tariffs;

namespace Wattly.Application.Common;

public interface IWattlyDbContext
{
    DbSet<Household> Households { get; }
    DbSet<Property> Properties { get; }
    DbSet<EnergyContract> EnergyContracts { get; }
    DbSet<EnergyOperator> EnergyOperators { get; }
    DbSet<EnergySupplier> EnergySuppliers { get; }
    DbSet<Tariff> Tariffs { get; }
    DbSet<TariffRatePlan> TariffRatePlans { get; }
    DbSet<TariffRateComponent> TariffRateComponents { get; }
    DbSet<Meter> Meters { get; }
    DbSet<MeterRegister> MeterRegisters { get; }
    DbSet<MeterReading> MeterReadings { get; }
    DbSet<CostCalculation> CostCalculations { get; }
    DbSet<Invoice> Invoices { get; }
    DbSet<Attachment> Attachments { get; }
    DbSet<AuditEvent> AuditEvents { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
