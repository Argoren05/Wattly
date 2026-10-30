using Wattly.Domain.Calculations;
using Wattly.Domain.Metering;

namespace Wattly.UnitTests;

public class ReadingRulesTests
{
    private static readonly DateTimeOffset T0 = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private static ReadingPoint[] History() => [new(T0, 100), new(T0.AddDays(10), 150), new(T0.AddDays(20), 200)];

    [Fact]
    public void Normal_reading_has_no_issues()
    {
        Assert.Empty(ReadingRules.Check(History(), T0.AddDays(30), 250));
    }

    [Fact]
    public void Duplicate_timestamp_is_blocking()
    {
        var issue = Assert.Single(ReadingRules.Check(History(), T0.AddDays(20), 200));
        Assert.Equal(ReadingIssueType.Duplicate, issue.Type);
        Assert.True(issue.IsBlocking);
    }

    [Fact]
    public void Value_lower_than_previous_is_blocking()
    {
        var issue = Assert.Single(ReadingRules.Check(History(), T0.AddDays(30), 199));
        Assert.Equal(ReadingIssueType.LowerThanPrevious, issue.Type);
    }

    [Fact]
    public void Backdated_reading_higher_than_next_is_blocking()
    {
        var issues = ReadingRules.Check(History(), T0.AddDays(15), 160);
        Assert.Empty(issues);

        var issue = Assert.Single(ReadingRules.Check(History(), T0.AddDays(15), 210));
        Assert.Equal(ReadingIssueType.HigherThanNext, issue.Type);
    }

    [Fact]
    public void Unusual_jump_is_a_non_blocking_warning()
    {
        // History: 5 kWh/day; new reading implies 100 kWh/day.
        var issue = Assert.Single(ReadingRules.Check(History(), T0.AddDays(21), 300));
        Assert.Equal(ReadingIssueType.UnusualJump, issue.Type);
        Assert.False(issue.IsBlocking);
    }

    [Fact]
    public void Very_high_daily_rate_is_flagged_even_without_history()
    {
        var issue = Assert.Single(ReadingRules.Check([new(T0, 0)], T0.AddDays(1), 500));
        Assert.Equal(ReadingIssueType.UnusualJump, issue.Type);
    }
}
