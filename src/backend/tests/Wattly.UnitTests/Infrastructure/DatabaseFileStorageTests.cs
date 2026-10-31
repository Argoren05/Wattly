using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Wattly.Application.Common;
using Wattly.Infrastructure;
using Wattly.Infrastructure.Storage;
using Wattly.UnitTests.Support;

namespace Wattly.UnitTests.Infrastructure;

/// <summary>Tests of <see cref="DatabaseFileStorage"/> and of choosing the storage provider.</summary>
public class DatabaseFileStorageTests
{
    [Fact]
    public async Task Saves_reads_and_deletes_files_in_the_database()
    {
        using var t = new TestContext();
        var storage = new DatabaseFileStorage(t.Options, t.Clock);

        await storage.SaveAsync("owner/file", new MemoryStream([1, 2, 3]), CancellationToken.None);

        await using (var read = await storage.OpenReadAsync("owner/file", CancellationToken.None))
        {
            Assert.NotNull(read);
            Assert.Equal(3, read.Length);
        }

        Assert.Equal(TestContext.DefaultNow, t.NewDbContext().StoredFiles.Single().CreatedAt);
        await storage.DeleteAsync("owner/file", CancellationToken.None);
        Assert.Null(await storage.OpenReadAsync("owner/file", CancellationToken.None));
        await storage.DeleteAsync("missing", CancellationToken.None);
    }

    [Fact]
    public async Task File_operations_do_not_save_pending_changes_of_the_caller()
    {
        using var t = new TestContext();
        t.Db.Tariffs.Add(new Wattly.Domain.Tariffs.Tariff { Code = "PENDING", Name = "x" });

        await new DatabaseFileStorage(t.Options, t.Clock).SaveAsync("k", new MemoryStream([1]), CancellationToken.None);

        Assert.Empty(t.NewDbContext().Tariffs.Where(x => x.Code == "PENDING"));
    }

    [Theory]
    [InlineData(null, typeof(LocalFileStorage))]
    [InlineData("Local", typeof(LocalFileStorage))]
    [InlineData("database", typeof(DatabaseFileStorage))]
    public void Storage_provider_is_chosen_from_configuration(string? provider, Type expected)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Wattly"] = "Host=localhost;Database=x;Username=u;Password=p",
            ["Storage:Provider"] = provider,
        }).Build();
        var services = new ServiceCollection().AddLogging().AddInfrastructure(configuration);
        services.AddSingleton<ICurrentUser, FakeCurrentUser>();
        using var provider_ = services.BuildServiceProvider();
        using var scope = provider_.CreateScope();

        Assert.IsType(expected, scope.ServiceProvider.GetRequiredService<IFileStorage>());
    }

    [Fact]
    public void Missing_database_configuration_fails_with_clear_message()
    {
        var configuration = new ConfigurationBuilder().Build();

        var error = Assert.Throws<InvalidOperationException>(() => new ServiceCollection().AddInfrastructure(configuration));
        Assert.Contains("DATABASE_URL", error.Message);
    }
}
