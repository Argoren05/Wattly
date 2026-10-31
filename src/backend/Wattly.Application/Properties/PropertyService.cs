using Microsoft.EntityFrameworkCore;
using Wattly.Application.Common;
using Wattly.Domain.Households;

namespace Wattly.Application.Properties;

/// <summary>Properties of the signed-in user.</summary>
/// <param name="db">Database context.</param>
/// <param name="currentUser">Signed-in user.</param>
/// <param name="storage">File storage (attachments are removed with the property).</param>
/// <param name="clock">Time source.</param>
public sealed class PropertyService(IWattlyDbContext db, ICurrentUser currentUser, IFileStorage storage, TimeProvider clock)
{
    /// <summary>Name of the household created automatically with the first property.</summary>
    private const string DefaultHouseholdName = "Moje gospodarstwo";

    /// <summary>Properties of the user, oldest first.</summary>
    /// <param name="ct">Cancellation token.</param>
    public async Task<IReadOnlyList<PropertyDto>> ListAsync(CancellationToken ct) =>
        await db.Properties.AsNoTracking()
            .OwnedBy(currentUser.UserId)
            .OrderBy(p => p.CreatedAt)
            .Select(p => ToDto(p))
            .ToListAsync(ct);

    /// <summary>One property.</summary>
    /// <param name="id">Property.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<PropertyDto> GetAsync(Guid id, CancellationToken ct) =>
        ToDto(await db.GetOwnedPropertyAsync(currentUser.UserId, id, ct));

    /// <summary>Creates a property (and the household on first use).</summary>
    /// <param name="request">Data.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<PropertyDto> CreateAsync(PropertyRequest request, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var household = await db.Households.FirstOrDefaultAsync(h => h.OwnerUserId == currentUser.UserId, ct);
        if (household is null)
        {
            household = new Household { OwnerUserId = currentUser.UserId, Name = DefaultHouseholdName, CreatedAt = now, UpdatedAt = now };
            db.Households.Add(household);
        }

        var property = new Property { Name = string.Empty, HouseholdId = household.Id, CreatedAt = now };
        Apply(property, request, now);
        db.Properties.Add(property);
        await db.SaveChangesAsync(ct);
        return ToDto(property);
    }

    /// <summary>Updates a property.</summary>
    /// <param name="id">Property.</param>
    /// <param name="request">Data.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<PropertyDto> UpdateAsync(Guid id, PropertyRequest request, CancellationToken ct)
    {
        var property = await db.GetOwnedPropertyAsync(currentUser.UserId, id, ct);
        Apply(property, request, clock.GetUtcNow());
        await db.SaveChangesAsync(ct);
        return ToDto(property);
    }

    /// <summary>Deletes a property with all its data and attachment files.</summary>
    /// <param name="id">Property.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var property = await db.GetOwnedPropertyAsync(currentUser.UserId, id, ct);

        // Meters, readings, contracts, own rate plans, invoices and calculations are removed by FK cascade.
        var attachments = await db.Invoices
            .Where(i => i.PropertyId == id && i.AttachmentId != null)
            .Join(db.Attachments, i => i.AttachmentId, a => a.Id, (_, a) => a)
            .ToListAsync(ct);
        db.Attachments.RemoveRange(attachments);

        db.Properties.Remove(property);
        await db.SaveChangesAsync(ct);

        foreach (var attachment in attachments)
            await storage.DeleteAsync(attachment.StorageKey, ct);
    }

    /// <summary>Validates the request and copies values to the entity.</summary>
    private static void Apply(Property property, PropertyRequest request, DateTimeOffset now)
    {
        var countryCode = (Validation.Clean(request.CountryCode) ?? property.CountryCode).ToUpperInvariant();
        var currencyCode = (Validation.Clean(request.CurrencyCode) ?? property.CurrencyCode).ToUpperInvariant();
        var timeZoneId = Validation.Clean(request.TimeZoneId) ?? property.TimeZoneId;
        var billingMonths = request.BillingPeriodMonths ?? property.BillingPeriodMonths;
        var ppe = Gs1.Normalize(request.PpeCode);

        new Validation()
            .RequireText(request.Name, nameof(request.Name), 100)
            .RequireText(request.AddressLine, nameof(request.AddressLine), 200, required: false)
            .RequireText(request.PostalCode, nameof(request.PostalCode), 20, required: false)
            .RequireText(request.City, nameof(request.City), 100, required: false)
            .Require(Codes.CountryCode().IsMatch(countryCode), nameof(request.CountryCode), "Kod kraju musi mieć format ISO 3166-1 alfa-2 (np. PL).")
            .Require(Codes.CurrencyCode().IsMatch(currencyCode), nameof(request.CurrencyCode), "Kod waluty musi mieć format ISO 4217 (np. PLN).")
            .Require(TimeZones.TryResolve(timeZoneId, out _), nameof(request.TimeZoneId), "Nieznana strefa czasowa.")
            .Require(Property.AllowedBillingPeriodMonths.Contains(billingMonths), nameof(request.BillingPeriodMonths), "Dozwolone długości okresu: 1, 2, 3, 6 lub 12 miesięcy.")
            .Require(request.MonthlyBudget is null or > 0, nameof(request.MonthlyBudget), "Budżet musi być większy od zera.")
            .Require(ppe is null || Gs1.IsValidGsrn(ppe), nameof(request.PpeCode),
                "Numer PPE musi mieć 18 cyfr i poprawną cyfrę kontrolną – sprawdź, czy nie ma literówki.")
            .ThrowIfInvalid();

        property.Name = request.Name.Trim();
        property.AddressLine = Validation.Clean(request.AddressLine);
        property.PostalCode = Validation.Clean(request.PostalCode);
        property.City = Validation.Clean(request.City);
        property.CountryCode = countryCode;
        property.CurrencyCode = currencyCode;
        property.TimeZoneId = timeZoneId;
        property.BillingPeriodMonths = billingMonths;
        property.BillingAnchorDate = request.BillingAnchorDate
            ?? (property.BillingAnchorDate == default ? new DateOnly(now.Year, now.Month, 1) : property.BillingAnchorDate);
        property.MonthlyBudget = request.MonthlyBudget;
        property.PpeCode = ppe;
        property.UpdatedAt = now;
    }

    /// <summary>Maps a property.</summary>
    internal static PropertyDto ToDto(Property p) => new(
        p.Id, p.Name, p.AddressLine, p.PostalCode, p.City, p.CountryCode, p.TimeZoneId, p.CurrencyCode,
        p.BillingPeriodMonths, p.BillingAnchorDate, p.MonthlyBudget, p.PpeCode, p.CreatedAt, p.UpdatedAt);
}
