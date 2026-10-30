using Microsoft.EntityFrameworkCore;
using Wattly.Domain.Households;
using Wattly.Domain.Metering;

namespace Wattly.Application.Common;

/// <summary>Resource-level authorization: every query on user data is filtered by the owner of the household.</summary>
public static class AccessExtensions
{
    public static IQueryable<Property> OwnedBy(this IQueryable<Property> query, Guid userId) =>
        query.Where(p => p.Household.OwnerUserId == userId);

    public static IQueryable<Meter> OwnedBy(this IQueryable<Meter> query, Guid userId) =>
        query.Where(m => m.Property.Household.OwnerUserId == userId);

    public static IQueryable<MeterRegister> OwnedBy(this IQueryable<MeterRegister> query, Guid userId) =>
        query.Where(r => r.Meter.Property.Household.OwnerUserId == userId);

    public static IQueryable<MeterReading> OwnedBy(this IQueryable<MeterReading> query, Guid userId) =>
        query.Where(r => r.MeterRegister.Meter.Property.Household.OwnerUserId == userId);

    public static async Task<Property> GetOwnedPropertyAsync(this IWattlyDbContext db, Guid userId, Guid propertyId, CancellationToken ct) =>
        await db.Properties.OwnedBy(userId).FirstOrDefaultAsync(p => p.Id == propertyId, ct)
        ?? throw new NotFoundException("Nieruchomość");

    public static async Task EnsurePropertyAccessAsync(this IWattlyDbContext db, Guid userId, Guid propertyId, CancellationToken ct)
    {
        if (!await db.Properties.OwnedBy(userId).AnyAsync(p => p.Id == propertyId, ct))
            throw new NotFoundException("Nieruchomość");
    }
}
