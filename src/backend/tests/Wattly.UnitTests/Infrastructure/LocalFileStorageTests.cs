using Microsoft.Extensions.Options;
using Wattly.Infrastructure.Storage;

namespace Wattly.UnitTests.Infrastructure;

/// <summary>Tests of <see cref="LocalFileStorage"/>.</summary>
public sealed class LocalFileStorageTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "wattly-storage-" + Guid.NewGuid().ToString("N"));
    private static readonly string Key = $"{Guid.NewGuid():N}/{Guid.NewGuid():N}";

    private LocalFileStorage Storage() => new(Options.Create(new StorageOptions { LocalPath = _root }));

    [Fact]
    public async Task Saves_reads_and_deletes_file()
    {
        var storage = Storage();

        await storage.SaveAsync(Key, new MemoryStream([1, 2, 3]), CancellationToken.None);
        await using (var read = await storage.OpenReadAsync(Key, CancellationToken.None))
        {
            Assert.NotNull(read);
            Assert.Equal(3, read.Length);
        }

        await storage.DeleteAsync(Key, CancellationToken.None);
        Assert.Null(await storage.OpenReadAsync(Key, CancellationToken.None));
    }

    [Fact]
    public async Task Existing_file_is_never_overwritten()
    {
        var storage = Storage();
        await storage.SaveAsync(Key, new MemoryStream([1]), CancellationToken.None);

        await Assert.ThrowsAsync<IOException>(() => storage.SaveAsync(Key, new MemoryStream([2]), CancellationToken.None));
    }

    [Theory]
    [InlineData("../etc/passwd")]
    [InlineData("abc")]
    [InlineData("/absolute/path")]
    [InlineData("0123456789abcdef0123456789abcdef/../../x")]
    public async Task Keys_that_could_escape_the_root_are_rejected(string key)
    {
        await Assert.ThrowsAsync<ArgumentException>(() => Storage().SaveAsync(key, new MemoryStream([1]), CancellationToken.None));
    }

    /// <inheritdoc />
    public void Dispose()
    {
        if (Directory.Exists(_root))
            Directory.Delete(_root, recursive: true);
    }
}
