using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Wattly.Application.Common;
using Wattly.Domain.Audit;
using Wattly.Domain.Billing;
using Wattly.Domain.Common;
using Wattly.Domain.Households;
using Wattly.Domain.Invoices;
using Wattly.Domain.Metering;
using Wattly.Domain.Tariffs;
using Wattly.Infrastructure.Identity;

namespace Wattly.Infrastructure.Persistence;

public class WattlyDbContext(DbContextOptions<WattlyDbContext> options, ICurrentUser? currentUser = null, TimeProvider? clock = null)
    : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options), IWattlyDbContext
{
    public DbSet<Household> Households => Set<Household>();
    public DbSet<Property> Properties => Set<Property>();
    public DbSet<EnergyContract> EnergyContracts => Set<EnergyContract>();
    public DbSet<EnergyOperator> EnergyOperators => Set<EnergyOperator>();
    public DbSet<EnergySupplier> EnergySuppliers => Set<EnergySupplier>();
    public DbSet<Tariff> Tariffs => Set<Tariff>();
    public DbSet<TariffRatePlan> TariffRatePlans => Set<TariffRatePlan>();
    public DbSet<TariffRateComponent> TariffRateComponents => Set<TariffRateComponent>();
    public DbSet<Meter> Meters => Set<Meter>();
    public DbSet<MeterRegister> MeterRegisters => Set<MeterRegister>();
    public DbSet<MeterReading> MeterReadings => Set<MeterReading>();
    public DbSet<CostCalculation> CostCalculations => Set<CostCalculation>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<decimal>().HavePrecision(18, 4);
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(WattlyDbContext).Assembly);

        // Enums are stored as text: readable in SQL and stable when members are reordered.
        foreach (var property in builder.Model.GetEntityTypes().SelectMany(t => t.GetProperties()))
        {
            var type = Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType;
            if (type.IsEnum)
            {
                property.SetProviderClrType(typeof(string));
                property.SetMaxLength(32);
            }
        }
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        AddAuditEvents();
        return await base.SaveChangesAsync(cancellationToken);
    }

    private void AddAuditEvents()
    {
        var now = (clock ?? TimeProvider.System).GetUtcNow();
        Guid? actor = currentUser is { IsAuthenticated: true } ? currentUser.UserId : null;

        var events = ChangeTracker.Entries()
            .Where(e => e.Entity is IAuditable && e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .Select(e => new AuditEvent
            {
                ActorUserId = actor,
                EntityType = e.Entity.GetType().Name,
                EntityId = ((Entity)e.Entity).Id,
                Action = e.State.ToString(),
                OccurredAt = now,
                ChangesJson = SerializeChanges(e),
            })
            .ToList();

        AuditEvents.AddRange(events);
    }

    private static string? SerializeChanges(EntityEntry entry)
    {
        var changes = new Dictionary<string, object?>();
        foreach (var property in entry.Properties)
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    changes[property.Metadata.Name] = property.CurrentValue;
                    break;
                case EntityState.Modified when property.IsModified && !Equals(property.OriginalValue, property.CurrentValue):
                    changes[property.Metadata.Name] = new { from = property.OriginalValue, to = property.CurrentValue };
                    break;
                case EntityState.Deleted:
                    changes[property.Metadata.Name] = property.OriginalValue;
                    break;
            }
        }

        return changes.Count == 0 ? null : JsonSerializer.Serialize(changes);
    }
}
