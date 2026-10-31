using Wattly.Application.Analytics;
using Wattly.Application.Invoices;
using Wattly.Domain.Households;

namespace Wattly.UnitTests;

public class BillingPeriodAndBucketsTests
{
    [Theory]
    [InlineData("2026-10-30", "2026-09-01", "2026-11-01")]
    [InlineData("2026-11-01", "2026-11-01", "2027-01-01")]
    [InlineData("2026-08-31", "2026-07-01", "2026-09-01")]
    public void Billing_period_is_derived_from_anchor(string date, string start, string end)
    {
        var property = new Property { Name = "Dom", BillingAnchorDate = new DateOnly(2026, 9, 1), BillingPeriodMonths = 2 };

        var period = property.GetBillingPeriod(DateOnly.Parse(date));

        Assert.Equal((DateOnly.Parse(start), DateOnly.Parse(end)), period);
    }

    [Fact]
    public void Week_buckets_start_on_monday()
    {
        var buckets = AnalyticsService.Buckets(new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 12), Granularity.Week).ToList();

        Assert.Equal(new DateOnly(2026, 9, 28), buckets[0].Start);
        Assert.Equal(3, buckets.Count);
        Assert.All(buckets, b => Assert.Equal(DayOfWeek.Monday, b.Start.DayOfWeek));
    }

    [Fact]
    public void Month_buckets_cover_whole_months()
    {
        var buckets = AnalyticsService.Buckets(new DateOnly(2026, 1, 15), new DateOnly(2026, 3, 2), Granularity.Month).ToList();

        Assert.Equal([new DateOnly(2026, 1, 1), new DateOnly(2026, 2, 1), new DateOnly(2026, 3, 1)], buckets.Select(b => b.Start));
    }

    [Theory]
    [InlineData(new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2D, 0x31 }, FileSignatures.Pdf)]
    [InlineData(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }, FileSignatures.Jpeg)]
    [InlineData(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }, FileSignatures.Png)]
    [InlineData(new byte[] { 0x4D, 0x5A, 0x90, 0x00 }, null)]
    public void File_type_is_detected_by_signature(byte[] header, string? expected)
    {
        Assert.Equal(expected, FileSignatures.Detect(header));
    }
}
