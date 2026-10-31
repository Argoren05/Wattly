using Wattly.Application.Common;
using Wattly.Application.Invoices;
using Wattly.UnitTests.Support;
using static Wattly.UnitTests.Support.TestContext;

namespace Wattly.UnitTests.Services;

/// <summary>Tests of <see cref="InvoiceService"/>.</summary>
public class InvoiceServiceTests
{
    private static InvoiceRequest Request(decimal gross = 150m) =>
        new(null, "FV/1", new DateOnly(2026, 10, 5), new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 30), null, null, gross, null);

    /// <summary>Property with rates and September readings (estimated gross 141.45).</summary>
    private static (TestContext T, Guid PropertyId, InvoiceService Service) Setup()
    {
        var t = new TestContext();
        var property = t.AddProperty();
        var tariff = t.AddTariff();
        t.AddContract(property, tariff);
        t.AddRatePlan(property, tariff);
        var meter = t.AddMeter(property);
        foreach (var r in meter.Registers)
        {
            t.AddReading(r, Warsaw(2026, 9, 1), 0);
            t.AddReading(r, Warsaw(2026, 10, 1), r.ZoneCode == "DAY" ? 150 : 100);
        }

        return (t, property.Id, new InvoiceService(t.Db, t.User, t.Storage, t.Clock));
    }

    [Fact]
    public async Task Invoice_is_compared_with_estimate()
    {
        var (t, propertyId, service) = Setup();
        using var _ = t;

        var invoice = await service.CreateAsync(propertyId, Request(), CancellationToken.None);

        Assert.Equal("PLN", invoice.CurrencyCode);
        Assert.NotNull(invoice.Comparison);
        Assert.Equal(141.45m, invoice.Comparison.EstimatedGross);
        Assert.Equal(8.55m, invoice.Comparison.DifferenceGross);
        Assert.Equal(6.0m, invoice.Comparison.DifferencePercent);
    }

    [Fact]
    public async Task Invalid_invoice_data_is_rejected()
    {
        var (t, propertyId, service) = Setup();
        using var _ = t;

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreateAsync(propertyId, Request() with { InvoiceNumber = "" }, CancellationToken.None));
        await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreateAsync(propertyId, Request() with { PeriodEnd = new DateOnly(2026, 8, 1) }, CancellationToken.None));
        await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreateAsync(propertyId, Request(10.123m), CancellationToken.None));
        await Assert.ThrowsAsync<ValidationFailedException>(() => service.CreateAsync(propertyId, Request() with { SupplierId = Guid.NewGuid() }, CancellationToken.None));
    }

    [Fact]
    public async Task Attachment_type_is_checked_by_signature_and_name_is_sanitised()
    {
        var (t, propertyId, service) = Setup();
        using var _ = t;
        var invoice = await service.CreateAsync(propertyId, Request(), CancellationToken.None);

        await Assert.ThrowsAsync<ValidationFailedException>(() =>
            service.AttachAsync(invoice.Id, "virus.pdf", 4, new MemoryStream([0x4D, 0x5A, 0x90, 0x00]), CancellationToken.None));

        var pdf = "%PDF-1.7 test"u8.ToArray();
        var attachment = await service.AttachAsync(invoice.Id, "../../faktura.exe", pdf.Length, new MemoryStream(pdf), CancellationToken.None);

        Assert.Equal("faktura.pdf", attachment.FileName);
        Assert.Equal(FileSignatures.Pdf, attachment.ContentType);
        Assert.Single(t.Storage.Files);

        await using var file = (await service.OpenAttachmentAsync(attachment.Id, CancellationToken.None)).Content;
        Assert.Equal(pdf.Length, file.Length);
    }

    [Fact]
    public async Task Replacing_attachment_deletes_previous_file_and_delete_removes_everything()
    {
        var (t, propertyId, service) = Setup();
        using var _ = t;
        var invoice = await service.CreateAsync(propertyId, Request(), CancellationToken.None);
        var png = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0 };

        await service.AttachAsync(invoice.Id, "a.png", png.Length, new MemoryStream(png), CancellationToken.None);
        await service.AttachAsync(invoice.Id, "b.png", png.Length, new MemoryStream(png), CancellationToken.None);
        Assert.Single(t.Storage.Files);

        await service.DeleteAsync(invoice.Id, CancellationToken.None);
        Assert.Empty(t.Storage.Files);
        Assert.Empty(await service.ListAsync(propertyId, CancellationToken.None));
    }

    [Fact]
    public async Task Too_large_or_empty_attachment_is_rejected()
    {
        var (t, propertyId, service) = Setup();
        using var _ = t;
        var invoice = await service.CreateAsync(propertyId, Request(), CancellationToken.None);

        await Assert.ThrowsAsync<ValidationFailedException>(() => service.AttachAsync(invoice.Id, "x.pdf", 0, new MemoryStream(), CancellationToken.None));
        await Assert.ThrowsAsync<ValidationFailedException>(() => service.AttachAsync(invoice.Id, "x.pdf", InvoiceService.MaxAttachmentBytes + 1, new MemoryStream([1]), CancellationToken.None));
    }

    [Fact]
    public async Task Update_and_access_control()
    {
        var (t, propertyId, service) = Setup();
        using var _ = t;
        var invoice = await service.CreateAsync(propertyId, Request(), CancellationToken.None);

        var updated = await service.UpdateAsync(invoice.Id, Request(200m) with { Notes = " uwaga " }, CancellationToken.None);
        Assert.Equal(200m, updated.TotalGross);
        Assert.Equal("uwaga", updated.Notes);

        t.User.Id = Guid.NewGuid();
        await Assert.ThrowsAsync<NotFoundException>(() => service.GetAsync(invoice.Id, CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => service.DeleteAsync(invoice.Id, CancellationToken.None));
    }
}
