using Wattly.Domain.Common;

namespace Wattly.Domain.Households;

public class Property : Entity
{
    public Guid HouseholdId { get; set; }
    public Household Household { get; set; } = null!;

    public required string Name { get; set; }
    public string? AddressLine { get; set; }
    public string? PostalCode { get; set; }
    public string? City { get; set; }
    public string CountryCode { get; set; } = "PL";
    public string TimeZoneId { get; set; } = "Europe/Warsaw";
    public string CurrencyCode { get; set; } = "PLN";

    /// <summary>Length of the billing period in months (1, 2, 3, 6 or 12).</summary>
    public int BillingPeriodMonths { get; set; } = 2;

    /// <summary>First day of any billing period; subsequent periods start every <see cref="BillingPeriodMonths"/>.</summary>
    public DateOnly BillingAnchorDate { get; set; }

    /// <summary>Optional monthly budget (gross) used by the dashboard.</summary>
    public decimal? MonthlyBudget { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public static readonly int[] AllowedBillingPeriodMonths = [1, 2, 3, 6, 12];

    /// <summary>Returns the billing period (dates in the property's time zone, end exclusive) containing <paramref name="date"/>.</summary>
    public (DateOnly Start, DateOnly EndExclusive) GetBillingPeriod(DateOnly date)
    {
        var start = BillingAnchorDate;
        if (date >= start)
        {
            while (start.AddMonths(BillingPeriodMonths) <= date)
                start = start.AddMonths(BillingPeriodMonths);
        }
        else
        {
            while (start > date)
                start = start.AddMonths(-BillingPeriodMonths);
        }

        return (start, start.AddMonths(BillingPeriodMonths));
    }
}
