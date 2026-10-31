using Microsoft.EntityFrameworkCore;
using Wattly.Domain.Households;
using Wattly.Domain.Metering;

namespace Wattly.Application.Common;

/// <summary>Resource-level authorization: every query on user data is filtered by the owner of the household.</summary>
public static class AccessExtensions
{
    /// <summary>Filters Property entities to those owned by the user.</summary>
    /// <param name="query">Query.</param>
    /// <param name="userId">Owner.</param>
    public static IQueryable<Property> OwnedBy(this IQueryable<Property> query, Guid userId) =>
        query.Where(p => p.Household.OwnerUserId == userId);

    /// <summary>Filters Meter entities to those owned by the user.</summary>
    /// <param name="query">Query.</param>
    /// <param name="userId">Owner.</param>
    public static IQueryable<Meter> OwnedBy(this IQueryable<Meter> query, Guid userId) =>
        query.Where(m => m.Property.Household.OwnerUserId == userId);

    /// <summary>Filters MeterRegister entities to those owned by the user.</summary>
    /// <param name="query">Query.</param>
    /// <param name="userId">Owner.</param>
    public static IQueryable<MeterRegister> OwnedBy(this IQueryable<MeterRegister> query, Guid userId) =>
        query.Where(r => r.Meter.Property.Household.OwnerUserId == userId);

    /// <summary>Filters MeterReading entities to those owned by the user.</summary>
    /// <param name="query">Query.</param>
    /// <param name="userId">Owner.</param>
    public static IQueryable<MeterReading> OwnedBy(this IQueryable<MeterReading> query, Guid userId) =>
        query.Where(r => r.MeterRegister.Meter.Property.Household.OwnerUserId == userId);

    /// <summary>Loads a tracked property owned by the user or throws NotFound.</summary>
    /// <param name="db">Database context.</param>
    /// <param name="userId">Owner.</param>
    /// <param name="propertyId">Property.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<Property> GetOwnedPropertyAsync(this IWattlyDbContext db, Guid userId, Guid propertyId, CancellationToken ct) =>
        await db.Properties.OwnedBy(userId).FirstOrDefaultAsync(p => p.Id == propertyId, ct)
        ?? throw new NotFoundException("Nieruchomość");

    /// <summary>Throws NotFound unless the property exists and belongs to the user.</summary>
    /// <param name="db">Database context.</param>
    /// <param name="userId">Owner.</param>
    /// <param name="propertyId">Property.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task EnsurePropertyAccessAsync(this IWattlyDbContext db, Guid userId, Guid propertyId, CancellationToken ct)
    {
        if (!await db.Properties.OwnedBy(userId).AnyAsync(p => p.Id == propertyId, ct))
            throw new NotFoundException("Nieruchomość");
    }
}
