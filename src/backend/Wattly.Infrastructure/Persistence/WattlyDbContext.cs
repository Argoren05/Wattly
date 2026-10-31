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
using Wattly.Infrastructure.Storage;

namespace Wattly.Infrastructure.Persistence;

/// <summary>EF Core context: domain tables, Identity tables and automatic audit log.</summary>
/// <param name="options">EF options.</param>
/// <param name="currentUser">Current user (null at design time) – recorded as the actor of audit events.</param>
/// <param name="clock">Time source (defaults to the system clock).</param>
public class WattlyDbContext(DbContextOptions<WattlyDbContext> options, ICurrentUser? currentUser = null, TimeProvider? clock = null)
    : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options), IWattlyDbContext
{
    /// <inheritdoc />
    public DbSet<Household> Households => Set<Household>();
    /// <inheritdoc />
    public DbSet<Property> Properties => Set<Property>();
    /// <inheritdoc />
    public DbSet<EnergyContract> EnergyContracts => Set<EnergyContract>();
    /// <inheritdoc />
    public DbSet<EnergyOperator> EnergyOperators => Set<EnergyOperator>();
    /// <inheritdoc />
    public DbSet<EnergySupplier> EnergySuppliers => Set<EnergySupplier>();
    /// <inheritdoc />
    public DbSet<Tariff> Tariffs => Set<Tariff>();
    /// <inheritdoc />
    public DbSet<TariffRatePlan> TariffRatePlans => Set<TariffRatePlan>();
    /// <inheritdoc />
    public DbSet<TariffRateComponent> TariffRateComponents => Set<TariffRateComponent>();
    /// <inheritdoc />
    public DbSet<Meter> Meters => Set<Meter>();
    /// <inheritdoc />
    public DbSet<MeterRegister> MeterRegisters => Set<MeterRegister>();
    /// <inheritdoc />
    public DbSet<MeterReading> MeterReadings => Set<MeterReading>();
    /// <inheritdoc />
    public DbSet<CostCalculation> CostCalculations => Set<CostCalculation>();
    /// <inheritdoc />
    public DbSet<Invoice> Invoices => Set<Invoice>();
    /// <inheritdoc />
    public DbSet<Attachment> Attachments => Set<Attachment>();
    /// <inheritdoc />
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    /// <summary>Attachment contents when <c>Storage:Provider</c> is <c>Database</c>.</summary>
    public DbSet<StoredFile> StoredFiles => Set<StoredFile>();

    /// <summary>Default precision for decimals (money and readings must never be floating point).</summary>
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<decimal>().HavePrecision(18, 4);
    }

    /// <summary>Applies entity configurations and stores enums as text.</summary>
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

    /// <summary>Fills technical fields and writes audit events in the same transaction as the change.</summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        PrepareChanges();
        return await base.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Synchronous variant – must apply the same rules, otherwise changes would bypass the audit log.</summary>
    /// <param name="acceptAllChangesOnSuccess">Whether to accept changes after saving.</param>
    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        PrepareChanges();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    /// <summary>Runs before every save: sets user creation time and records audit events.</summary>
    private void PrepareChanges()
    {
        // Users are created by the Identity endpoints, which do not know about CreatedAt.
        foreach (var user in ChangeTracker.Entries<AppUser>().Where(e => e.State == EntityState.Added && e.Entity.CreatedAt == default))
            user.Entity.CreatedAt = (clock ?? TimeProvider.System).GetUtcNow();

        AddAuditEvents();
    }

    /// <summary>Creates audit events for added, modified and deleted auditable entities.</summary>
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

    /// <summary>Serialises changed values: all values for added/deleted entities, old/new pairs for modifications.</summary>
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
