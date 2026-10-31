using Microsoft.EntityFrameworkCore;
using Wattly.Application.Common;
using Wattly.Infrastructure.Persistence;

namespace Wattly.Infrastructure.Storage;

/// <summary>Content of a file stored in PostgreSQL (see <see cref="DatabaseFileStorage"/>).</summary>
public class StoredFile
{
    /// <summary>Opaque, server-generated storage key.</summary>
    public required string Key { get; set; }

    /// <summary>File bytes.</summary>
    public required byte[] Content { get; set; }

    /// <summary>When the file was stored (UTC).</summary>
    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>
/// <see cref="IFileStorage"/> keeping attachments in the database (table <c>StoredFiles</c>). Suited to small
/// deployments: no separate persistent disk is needed and attachments are included in database backups (DEC-026).
/// Attachments are limited to 10 MB, so keeping them in <c>bytea</c> is acceptable.
/// </summary>
/// <param name="options">Database options; every operation uses its own short-lived context, so file operations never
/// save (or fail together with) unrelated pending changes of the caller's unit of work.</param>
/// <param name="clock">Time source.</param>
public sealed class DatabaseFileStorage(DbContextOptions<WattlyDbContext> options, TimeProvider clock) : IFileStorage
{
    /// <summary>Creates an independent context for one storage operation.</summary>
    private WattlyDbContext CreateContext() => new(options, currentUser: null, clock);

    /// <inheritdoc />
    public async Task SaveAsync(string key, Stream content, CancellationToken cancellationToken)
    {
        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, cancellationToken);

        // Saved immediately and independently of the caller's unit of work, mirroring file-system semantics.
        await using var db = CreateContext();
        db.StoredFiles.Add(new StoredFile { Key = key, Content = buffer.ToArray(), CreatedAt = clock.GetUtcNow() });
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<Stream?> OpenReadAsync(string key, CancellationToken cancellationToken)
    {
        await using var db = CreateContext();
        var content = await db.StoredFiles.AsNoTracking().Where(f => f.Key == key).Select(f => f.Content).FirstOrDefaultAsync(cancellationToken);
        return content is null ? null : new MemoryStream(content, writable: false);
    }

    /// <inheritdoc />
    public async Task DeleteAsync(string key, CancellationToken cancellationToken)
    {
        await using var db = CreateContext();
        var file = await db.StoredFiles.FirstOrDefaultAsync(f => f.Key == key, cancellationToken);
        if (file is null)
            return;
        db.StoredFiles.Remove(file);
        await db.SaveChangesAsync(cancellationToken);
    }
}
