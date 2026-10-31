using Microsoft.EntityFrameworkCore;
using Wattly.Domain.Audit;
using Wattly.Domain.Billing;
using Wattly.Domain.Households;
using Wattly.Domain.Invoices;
using Wattly.Domain.Metering;
using Wattly.Domain.Tariffs;

namespace Wattly.Application.Common;

/// <summary>Persistence abstraction used by application services (implemented with EF Core in Infrastructure).</summary>
public interface IWattlyDbContext
{
    /// <summary>Households.</summary>
    DbSet<Household> Households { get; }
    /// <summary>Properties.</summary>
    DbSet<Property> Properties { get; }
    /// <summary>Energy contracts.</summary>
    DbSet<EnergyContract> EnergyContracts { get; }
    /// <summary>Distribution operators.</summary>
    DbSet<EnergyOperator> EnergyOperators { get; }
    /// <summary>Energy suppliers.</summary>
    DbSet<EnergySupplier> EnergySuppliers { get; }
    /// <summary>Tariffs.</summary>
    DbSet<Tariff> Tariffs { get; }
    /// <summary>Rate plans.</summary>
    DbSet<TariffRatePlan> TariffRatePlans { get; }
    /// <summary>Rate components.</summary>
    DbSet<TariffRateComponent> TariffRateComponents { get; }
    /// <summary>Meters.</summary>
    DbSet<Meter> Meters { get; }
    /// <summary>Meter registers.</summary>
    DbSet<MeterRegister> MeterRegisters { get; }
    /// <summary>Meter readings.</summary>
    DbSet<MeterReading> MeterReadings { get; }
    /// <summary>Saved calculations.</summary>
    DbSet<CostCalculation> CostCalculations { get; }
    /// <summary>Invoices.</summary>
    DbSet<Invoice> Invoices { get; }
    /// <summary>Attachment metadata.</summary>
    DbSet<Attachment> Attachments { get; }
    /// <summary>Audit log.</summary>
    DbSet<AuditEvent> AuditEvents { get; }

    /// <summary>Saves changes (and writes audit events).</summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
