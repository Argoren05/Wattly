using Wattly.Application.Common;
using Wattly.Application.MobileApp;

namespace Wattly.UnitTests.Services;

/// <summary>Tests of <see cref="AppVersion"/> and <see cref="MobileReleaseService"/>.</summary>
public class MobileReleaseServiceTests
{
    [Theory]
    [InlineData("1.0.0", "1.0.0", 0)]
    [InlineData("1.2", "1.2.0", 0)]
    [InlineData("1.2.9", "1.2.10", -1)]
    [InlineData("2.0.0", "1.99.99", 1)]
    [InlineData("1.0.0-beta.1", "1.0.0", 0)]
    public void Versions_are_compared_numerically(string left, string right, int expectedSign)
    {
        Assert.Equal(expectedSign, Math.Sign(AppVersion.Compare(left, right)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("1..2")]
    [InlineData("1.2.3.4.5")]
    [InlineData("-1.0")]
    public void Invalid_versions_are_detected(string? version)
    {
        Assert.False(AppVersion.IsValid(version));
    }

    [Fact]
    public void Compare_throws_for_invalid_input()
    {
        Assert.Throws<ArgumentException>(() => AppVersion.Compare("x", "1.0"));
        Assert.Throws<ArgumentException>(() => AppVersion.Compare("1.0", "y"));
    }

    private static MobileReleaseService Service(string latest = "1.3.0", string minimum = "1.1.0") => new(new MobileAppOptions
    {
        Android = new MobileReleaseOptions { LatestVersion = latest, MinimumVersion = minimum, DownloadUrl = "https://example.test/wattly.apk", ReleaseNotes = "Poprawki" },
    });

    [Fact]
    public void Up_to_date_app_needs_no_update()
    {
        var status = Service().GetStatus("Android", "1.3.0");

        Assert.False(status.UpdateAvailable);
        Assert.False(status.UpdateRequired);
        Assert.Equal("android", status.Platform);
    }

    [Fact]
    public void Older_but_supported_app_gets_optional_update()
    {
        var status = Service().GetStatus("android", "1.2.0");

        Assert.True(status.UpdateAvailable);
        Assert.False(status.UpdateRequired);
        Assert.Equal("https://example.test/wattly.apk", status.DownloadUrl);
        Assert.Equal("Poprawki", status.ReleaseNotes);
    }

    [Fact]
    public void Unsupported_app_must_update()
    {
        var status = Service().GetStatus("android", "1.0.5");

        Assert.True(status.UpdateRequired);
        Assert.True(status.UpdateAvailable);
    }

    [Fact]
    public void Missing_or_invalid_configuration_never_forces_update()
    {
        var status = Service(latest: "", minimum: "nonsense").GetStatus("android", "0.1.0");
        var ios = Service().GetStatus("ios", "0.1.0");

        Assert.False(status.UpdateAvailable);
        Assert.False(ios.UpdateRequired);
        Assert.Null(ios.LatestVersion);
    }

    [Theory]
    [InlineData("windows", "1.0.0")]
    [InlineData("android", "latest")]
    [InlineData(null, null)]
    public void Invalid_requests_are_rejected(string? platform, string? version)
    {
        Assert.Throws<ValidationFailedException>(() => Service().GetStatus(platform, version));
    }
}
