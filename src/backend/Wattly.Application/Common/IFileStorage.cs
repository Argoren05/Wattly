namespace Wattly.Application.Common;

/// <summary>Private object storage for attachments. Keys are opaque and never derived from user input.</summary>
public interface IFileStorage
{
    /// <summary>Stores a new file under the key.</summary>
    /// <param name="key">Server-generated key.</param>
    /// <param name="content">Content.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task SaveAsync(string key, Stream content, CancellationToken cancellationToken);
    /// <summary>Opens a file for reading; null when it does not exist.</summary>
    /// <param name="key">Key.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<Stream?> OpenReadAsync(string key, CancellationToken cancellationToken);
    /// <summary>Deletes a file if it exists.</summary>
    /// <param name="key">Key.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task DeleteAsync(string key, CancellationToken cancellationToken);
}
