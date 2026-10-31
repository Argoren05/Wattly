using Wattly.Application.Common;

namespace Wattly.Application.MobileApp;

/// <summary>Published native release of the mobile app for one platform (configuration section <c>MobileApp:{platform}</c>).</summary>
public sealed class MobileReleaseOptions
{
    /// <summary>Newest installer version available for download, e.g. <c>1.3.0</c>.</summary>
    public string? LatestVersion { get; set; }

    /// <summary>Oldest version still supported by the API; older installations must be updated.</summary>
    public string? MinimumVersion { get; set; }

    /// <summary>Where the installer can be downloaded (APK link from EAS Build, Google Play or App Store page).</summary>
    public string? DownloadUrl { get; set; }

    /// <summary>Short description of the changes shown to the user.</summary>
    public string? ReleaseNotes { get; set; }
}

/// <summary>Release configuration for all platforms.</summary>
public sealed class MobileAppOptions
{
    /// <summary>Configuration section name.</summary>
    public const string SectionName = "MobileApp";

    /// <summary>Android release.</summary>
    public MobileReleaseOptions Android { get; set; } = new();

    /// <summary>iOS release.</summary>
    public MobileReleaseOptions Ios { get; set; } = new();
}

/// <summary>Information whether the installed native app should be updated.</summary>
/// <param name="Platform">android or ios.</param>
/// <param name="CurrentVersion">Version reported by the app.</param>
/// <param name="LatestVersion">Newest available version (null when not configured).</param>
/// <param name="MinimumVersion">Oldest supported version (null when not configured).</param>
/// <param name="DownloadUrl">Installer / store link.</param>
/// <param name="ReleaseNotes">Description of the changes.</param>
/// <param name="UpdateAvailable">A newer installer exists.</param>
/// <param name="UpdateRequired">The installed version is no longer supported – the app should block usage until updated.</param>
public sealed record MobileReleaseDto(
    string Platform,
    string CurrentVersion,
    string? LatestVersion,
    string? MinimumVersion,
    string? DownloadUrl,
    string? ReleaseNotes,
    bool UpdateAvailable,
    bool UpdateRequired);

/// <summary>
/// Decides whether a native app installation is up to date. JavaScript-only changes are delivered over the air
/// (expo-updates); this service covers new installers needed after native changes.
/// </summary>
/// <param name="options">Release configuration.</param>
public sealed class MobileReleaseService(MobileAppOptions options)
{
    /// <summary>Returns the update status for an installed app.</summary>
    /// <param name="platform">android or ios (case-insensitive).</param>
    /// <param name="currentVersion">Installed native version.</param>
    /// <exception cref="ValidationFailedException">Unknown platform or invalid version.</exception>
    public MobileReleaseDto GetStatus(string? platform, string? currentVersion)
    {
        var normalized = platform?.Trim().ToLowerInvariant();
        new Validation()
            .Require(normalized is "android" or "ios", nameof(platform), "Platforma musi mieć wartość android lub ios.")
            .Require(AppVersion.IsValid(currentVersion), "version", "Nieprawidłowy numer wersji.")
            .ThrowIfInvalid();

        var release = normalized == "android" ? options.Android : options.Ios;

        // Misconfigured versions are ignored rather than breaking every client.
        var latest = AppVersion.IsValid(release.LatestVersion) ? release.LatestVersion!.Trim() : null;
        var minimum = AppVersion.IsValid(release.MinimumVersion) ? release.MinimumVersion!.Trim() : null;

        var updateAvailable = latest is not null && AppVersion.Compare(currentVersion!, latest) < 0;
        var updateRequired = minimum is not null && AppVersion.Compare(currentVersion!, minimum) < 0;

        return new MobileReleaseDto(
            normalized!,
            currentVersion!.Trim(),
            latest,
            minimum,
            Validation.Clean(release.DownloadUrl),
            Validation.Clean(release.ReleaseNotes),
            updateAvailable || updateRequired,
            updateRequired);
    }
}
