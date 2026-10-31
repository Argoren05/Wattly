using Wattly.Domain.Common;

namespace Wattly.Domain.Households;

/// <summary>
/// Place where energy is consumed (flat, house…). Holds settings needed to compute billing periods and costs.
/// </summary>
public class Property : Entity
{
    /// <summary>Owning household.</summary>
    public Guid HouseholdId { get; set; }

    /// <summary>Navigation to the owning household.</summary>
    public Household Household { get; set; } = null!;

    /// <summary>Display name, e.g. "Mieszkanie".</summary>
    public required string Name { get; set; }

    /// <summary>Street and number (optional).</summary>
    public string? AddressLine { get; set; }

    /// <summary>Postal code (optional).</summary>
    public string? PostalCode { get; set; }

    /// <summary>City (optional).</summary>
    public string? City { get; set; }

    /// <summary>ISO 3166-1 alpha-2 country code.</summary>
    public string CountryCode { get; set; } = "PL";

    /// <summary>IANA time zone used to interpret calendar dates (billing periods, rate plan validity).</summary>
    public string TimeZoneId { get; set; } = "Europe/Warsaw";

    /// <summary>ISO 4217 currency of all amounts of the property.</summary>
    public string CurrencyCode { get; set; } = "PLN";

    /// <summary>Length of the billing period in months (1, 2, 3, 6 or 12).</summary>
    public int BillingPeriodMonths { get; set; } = 2;

    /// <summary>First day of any billing period; subsequent periods start every <see cref="BillingPeriodMonths"/>.</summary>
    public DateOnly BillingAnchorDate { get; set; }

    /// <summary>
    /// Metering point number (PPE) printed on invoices: an 18-digit GS1 GSRN code with a check digit (optional).
    /// </summary>
    public string? PpeCode { get; set; }

    /// <summary>Optional monthly budget (gross) used by the dashboard.</summary>
    public decimal? MonthlyBudget { get; set; }

    /// <summary>Creation time (UTC).</summary>
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Last modification time (UTC).</summary>
    public DateTimeOffset UpdatedAt { get; set; }

    /// <summary>Billing period lengths supported by the application.</summary>
    public static readonly int[] AllowedBillingPeriodMonths = [1, 2, 3, 6, 12];

    /// <summary>Returns the billing period (dates in the property's time zone, end exclusive) containing <paramref name="date"/>.</summary>
    /// <param name="date">Any calendar date, before or after the anchor.</param>
    /// <returns>First day of the period and the first day of the next period.</returns>
    public (DateOnly Start, DateOnly EndExclusive) GetBillingPeriod(DateOnly date)
    {
        var start = BillingAnchorDate;
        if (date >= start)
        {
            // Walk forward period by period until the next period would start after the date.
            while (start.AddMonths(BillingPeriodMonths) <= date)
                start = start.AddMonths(BillingPeriodMonths);
        }
        else
        {
            // Dates before the anchor: walk backwards.
            while (start > date)
                start = start.AddMonths(-BillingPeriodMonths);
        }

        return (start, start.AddMonths(BillingPeriodMonths));
    }
}
