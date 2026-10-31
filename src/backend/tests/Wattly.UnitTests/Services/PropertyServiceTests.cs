using Wattly.Application.Common;
using Wattly.Application.Properties;
using Wattly.Domain.Invoices;
using Wattly.UnitTests.Support;

namespace Wattly.UnitTests.Services;

/// <summary>Tests of <see cref="PropertyService"/>.</summary>
public class PropertyServiceTests
{
    private static PropertyRequest Request(string name = "Dom", int? months = 2, string? timeZone = null, decimal? budget = null, string? ppe = null) =>
        new(name, null, null, null, null, timeZone, null, months, new DateOnly(2026, 1, 1), budget, ppe);

    [Fact]
    public async Task Ppe_code_is_normalized_and_validated()
    {
        using var t = new TestContext();
        var service = new PropertyService(t.Db, t.User, t.Storage, t.Clock);

        var created = await service.CreateAsync(Request(ppe: "5903 2242 8100 789765"), CancellationToken.None);
        Assert.Equal("590322428100789765", created.PpeCode);

        var error = await Assert.ThrowsAsync<ValidationFailedException>(() => service.UpdateAsync(created.Id, Request(ppe: "590322428100789766"), CancellationToken.None));
        Assert.Contains(nameof(PropertyRequest.PpeCode), error.Errors.Keys);

        var cleared = await service.UpdateAsync(created.Id, Request(ppe: null), CancellationToken.None);
        Assert.Null(cleared.PpeCode);
    }

    [Fact]
    public async Task Create_adds_household_on_first_use_and_applies_defaults()
    {
        using var t = new TestContext();
        var service = new PropertyService(t.Db, t.User, t.Storage, t.Clock);

        var created = await service.CreateAsync(Request(budget: 150m), CancellationToken.None);

        Assert.Equal("Dom", created.Name);
        Assert.Equal("PL", created.CountryCode);
        Assert.Equal("PLN", created.CurrencyCode);
        Assert.Equal("Europe/Warsaw", created.TimeZoneId);
        Assert.Equal(150m, created.MonthlyBudget);
        Assert.Single(t.NewDbContext().Households.Where(h => h.OwnerUserId == t.User.Id));
    }

    [Fact]
    public async Task Second_property_reuses_household()
    {
        using var t = new TestContext();
        var service = new PropertyService(t.Db, t.User, t.Storage, t.Clock);

        await service.CreateAsync(Request("A"), CancellationToken.None);
        await service.CreateAsync(Request("B"), CancellationToken.None);

        Assert.Single(t.NewDbContext().Households);
        Assert.Equal(["A", "B"], (await service.ListAsync(CancellationToken.None)).Select(p => p.Name));
    }

    [Theory]
    [InlineData("", 2, null, "Name")]
    [InlineData("Dom", 5, null, "BillingPeriodMonths")]
    [InlineData("Dom", 2, "Mars/Olympus", "TimeZoneId")]
    public async Task Invalid_data_is_rejected_with_field_error(string name, int months, string? timeZone, string field)
    {
        using var t = new TestContext();
        var service = new PropertyService(t.Db, t.User, t.Storage, t.Clock);

        var error = await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreateAsync(Request(name, months, timeZone), CancellationToken.None));

        Assert.Contains(field, error.Errors.Keys);
    }

    [Fact]
    public async Task Negative_budget_is_rejected()
    {
        using var t = new TestContext();
        var service = new PropertyService(t.Db, t.User, t.Storage, t.Clock);

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreateAsync(Request(budget: -1), CancellationToken.None));
    }

    [Fact]
    public async Task Other_users_property_is_not_found()
    {
        using var t = new TestContext();
        var foreign = t.AddProperty(ownerId: Guid.NewGuid());
        var service = new PropertyService(t.Db, t.User, t.Storage, t.Clock);

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetAsync(foreign.Id, CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => service.UpdateAsync(foreign.Id, Request(), CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => service.DeleteAsync(foreign.Id, CancellationToken.None));
        Assert.Empty(await service.ListAsync(CancellationToken.None));
    }

    [Fact]
    public async Task Update_changes_values_and_timestamp()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var service = new PropertyService(t.Db, t.User, t.Storage, t.Clock);
        t.Clock.Now = t.Clock.Now.AddDays(1);

        var updated = await service.UpdateAsync(property.Id, Request("Nowa nazwa", 12), CancellationToken.None);

        Assert.Equal("Nowa nazwa", updated.Name);
        Assert.Equal(12, updated.BillingPeriodMonths);
        Assert.Equal(t.Clock.Now, updated.UpdatedAt);
    }

    [Fact]
    public async Task Delete_removes_property_and_attachment_files()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var attachment = new Attachment { OwnerUserId = t.User.Id, StorageKey = "k", FileName = "f.pdf", ContentType = "application/pdf" };
        t.Db.Attachments.Add(attachment);
        t.Db.Invoices.Add(new Invoice { PropertyId = property.Id, InvoiceNumber = "1", AttachmentId = attachment.Id });
        await t.Db.SaveChangesAsync();
        t.Storage.Files["k"] = [1];
        var service = new PropertyService(t.Db, t.User, t.Storage, t.Clock);

        await service.DeleteAsync(property.Id, CancellationToken.None);

        Assert.Empty(t.NewDbContext().Properties);
        Assert.Empty(t.NewDbContext().Attachments);
        Assert.Empty(t.Storage.Files);
    }
}
