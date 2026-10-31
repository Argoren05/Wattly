using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using Wattly.Application.Common;

namespace Wattly.Infrastructure.Storage;

/// <summary>Options of <see cref="LocalFileStorage"/>.</summary>
public sealed class StorageOptions
{
    /// <summary>Configuration section name.</summary>
    public const string SectionName = "Storage";

    /// <summary>Where attachments are kept: <c>Local</c> (directory, default) or <c>Database</c> (PostgreSQL).</summary>
    public string Provider { get; set; } = "Local";

    /// <summary>Root directory for attachments; must be outside the web root and not publicly served.</summary>
    public string LocalPath { get; set; } = "App_Data/attachments";
}

/// <summary>Local disk implementation of <see cref="IFileStorage"/> for development and single-instance deployments.</summary>
/// <param name="options">Storage options.</param>
public sealed partial class LocalFileStorage(IOptions<StorageOptions> options) : IFileStorage
{
    private readonly string _root = Path.GetFullPath(options.Value.LocalPath);

    /// <inheritdoc />
    public async Task SaveAsync(string key, Stream content, CancellationToken cancellationToken)
    {
        var path = Resolve(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true);
        await content.CopyToAsync(file, cancellationToken);
    }

    /// <inheritdoc />
    public Task<Stream?> OpenReadAsync(string key, CancellationToken cancellationToken)
    {
        var path = Resolve(key);
        Stream? stream = File.Exists(path) ? new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true) : null;
        return Task.FromResult(stream);
    }

    /// <inheritdoc />
    public Task DeleteAsync(string key, CancellationToken cancellationToken)
    {
        var path = Resolve(key);
        if (File.Exists(path))
            File.Delete(path);
        return Task.CompletedTask;
    }

    /// <summary>Maps a key to a path inside the root, rejecting anything that could escape it (path traversal).</summary>
    private string Resolve(string key)
    {
        if (!KeyPattern().IsMatch(key))
            throw new ArgumentException("Invalid storage key.", nameof(key));

        var path = Path.GetFullPath(Path.Combine(_root, key));
        if (!path.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            throw new ArgumentException("Invalid storage key.", nameof(key));
        return path;
    }

    /// <summary>Allowed key format: owner-hex/file-hex.</summary>
    [GeneratedRegex("^[a-f0-9]{32}/[a-f0-9]{32}$")]
    private static partial Regex KeyPattern();
}
