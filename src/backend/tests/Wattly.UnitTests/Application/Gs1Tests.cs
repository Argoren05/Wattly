using Wattly.Application.Common;

namespace Wattly.UnitTests.Application;

/// <summary>Tests of <see cref="Gs1"/> (metering point numbers – PPE).</summary>
public class Gs1Tests
{
    [Theory]
    [InlineData("590322428100789765")] // PPE printed on a TAURON invoice
    public void Valid_gsrn_codes_are_accepted(string code)
    {
        Assert.True(Gs1.IsValidGsrn(code));
    }

    [Theory]
    [InlineData("590322428100789766")] // wrong check digit
    [InlineData("590322428100789756")] // two digits swapped
    [InlineData("59032242810078976")]  // 17 digits
    [InlineData("5903224281007897650")] // 19 digits
    [InlineData("59032242810078976A")]
    public void Invalid_codes_are_rejected(string code)
    {
        Assert.False(Gs1.IsValidGsrn(code));
    }

    [Fact]
    public void Check_digit_follows_the_gs1_algorithm()
    {
        // GS1 example: GTIN-13 data 629104150021 has check digit 3.
        Assert.Equal(3, Gs1.CheckDigit("629104150021"));
        Assert.Equal(5, Gs1.CheckDigit("59032242810078976"));
    }

    [Theory]
    [InlineData(" 5903 2242 8100-789765 ", "590322428100789765")]
    [InlineData("   ", null)]
    [InlineData(null, null)]
    public void Normalize_removes_grouping_separators(string? input, string? expected)
    {
        Assert.Equal(expected, Gs1.Normalize(input));
    }
}
