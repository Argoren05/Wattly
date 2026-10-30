using Microsoft.EntityFrameworkCore;
using Wattly.Application.Calculations;
using Wattly.Application.Common;
using Wattly.Domain.Invoices;

namespace Wattly.Application.Invoices;

public sealed class InvoiceService(IWattlyDbContext db, ICurrentUser currentUser, IFileStorage storage, TimeProvider clock)
{
    public const long MaxAttachmentBytes = 10 * 1024 * 1024;

    public async Task<IReadOnlyList<InvoiceDto>> ListAsync(Guid propertyId, CancellationToken ct)
    {
        var data = await PropertyEnergyData.LoadAsync(db, currentUser.UserId, propertyId, ct);
        var invoices = await db.Invoices.AsNoTracking().Where(i => i.PropertyId == propertyId).OrderByDescending(i => i.PeriodEnd).ToListAsync(ct);
        var attachments = await LoadAttachmentsAsync(invoices, ct);
        return invoices.Select(i => ToDto(i, attachments, data)).ToList();
    }

    public async Task<InvoiceDto> GetAsync(Guid invoiceId, CancellationToken ct)
    {
        var invoice = await LoadAsync(invoiceId, tracking: false, ct);
        var data = await PropertyEnergyData.LoadAsync(db, currentUser.UserId, invoice.PropertyId, ct);
        return ToDto(invoice, await LoadAttachmentsAsync([invoice], ct), data);
    }

    public async Task<InvoiceDto> CreateAsync(Guid propertyId, InvoiceRequest request, CancellationToken ct)
    {
        var property = await db.GetOwnedPropertyAsync(currentUser.UserId, propertyId, ct);
        await ValidateAsync(request, ct);

        var now = clock.GetUtcNow();
        var invoice = new Invoice { PropertyId = propertyId, InvoiceNumber = string.Empty, CurrencyCode = property.CurrencyCode, CreatedAt = now };
        Apply(invoice, request, now);
        db.Invoices.Add(invoice);
        await db.SaveChangesAsync(ct);
        return await GetAsync(invoice.Id, ct);
    }

    public async Task<InvoiceDto> UpdateAsync(Guid invoiceId, InvoiceRequest request, CancellationToken ct)
    {
        var invoice = await LoadAsync(invoiceId, tracking: true, ct);
        await ValidateAsync(request, ct);
        Apply(invoice, request, clock.GetUtcNow());
        await db.SaveChangesAsync(ct);
        return await GetAsync(invoice.Id, ct);
    }

    public async Task DeleteAsync(Guid invoiceId, CancellationToken ct)
    {
        var invoice = await LoadAsync(invoiceId, tracking: true, ct);
        var attachment = invoice.AttachmentId is { } id ? await db.Attachments.FirstOrDefaultAsync(a => a.Id == id, ct) : null;

        db.Invoices.Remove(invoice);
        if (attachment is not null)
            db.Attachments.Remove(attachment);
        await db.SaveChangesAsync(ct);

        if (attachment is not null)
            await storage.DeleteAsync(attachment.StorageKey, ct);
    }

    /// <summary>Stores a PDF/JPEG/PNG attachment, replacing the previous one. The type is verified by file signature, not only by the declared content type.</summary>
    public async Task<AttachmentDto> AttachAsync(Guid invoiceId, string fileName, long length, Stream content, CancellationToken ct)
    {
        var invoice = await LoadAsync(invoiceId, tracking: true, ct);

        var validation = new Validation()
            .Require(length > 0, "file", "Plik jest pusty.")
            .Require(length <= MaxAttachmentBytes, "file", $"Maksymalny rozmiar pliku to {MaxAttachmentBytes / 1024 / 1024} MB.");
        validation.ThrowIfInvalid();

        await using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, ct);
        buffer.Position = 0;
        var contentType = FileSignatures.Detect(buffer.GetBuffer().AsSpan(0, (int)Math.Min(buffer.Length, 16)));
        validation.Require(contentType is not null, "file", "Dozwolone formaty: PDF, JPEG, PNG.").ThrowIfInvalid();

        var previous = invoice.AttachmentId is { } previousId ? await db.Attachments.FirstOrDefaultAsync(a => a.Id == previousId, ct) : null;

        var attachment = new Attachment
        {
            OwnerUserId = currentUser.UserId,
            StorageKey = $"{currentUser.UserId:N}/{Guid.NewGuid():N}",
            FileName = SanitizeFileName(fileName, contentType!),
            ContentType = contentType!,
            SizeBytes = buffer.Length,
            CreatedAt = clock.GetUtcNow(),
        };

        await storage.SaveAsync(attachment.StorageKey, buffer, ct);
        db.Attachments.Add(attachment);
        invoice.AttachmentId = attachment.Id;
        invoice.UpdatedAt = attachment.CreatedAt;
        if (previous is not null)
            db.Attachments.Remove(previous);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch
        {
            await storage.DeleteAsync(attachment.StorageKey, CancellationToken.None);
            throw;
        }

        if (previous is not null)
            await storage.DeleteAsync(previous.StorageKey, ct);

        return ToDto(attachment);
    }

    public async Task<FileContent> OpenAttachmentAsync(Guid attachmentId, CancellationToken ct)
    {
        var attachment = await db.Attachments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == attachmentId && a.OwnerUserId == currentUser.UserId, ct)
                         ?? throw new NotFoundException("Załącznik");
        var stream = await storage.OpenReadAsync(attachment.StorageKey, ct) ?? throw new NotFoundException("Załącznik");
        return new FileContent(attachment.FileName, attachment.ContentType, stream);
    }

    private async Task<Invoice> LoadAsync(Guid invoiceId, bool tracking, CancellationToken ct)
    {
        var ownedProperties = db.Properties.OwnedBy(currentUser.UserId).Select(p => p.Id);
        var query = db.Invoices.Where(i => i.Id == invoiceId && ownedProperties.Contains(i.PropertyId));
        if (!tracking)
            query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(ct) ?? throw new NotFoundException("Faktura");
    }

    private async Task<Dictionary<Guid, Attachment>> LoadAttachmentsAsync(IReadOnlyCollection<Invoice> invoices, CancellationToken ct)
    {
        var ids = invoices.Where(i => i.AttachmentId != null).Select(i => i.AttachmentId!.Value).ToList();
        return ids.Count == 0 ? [] : await db.Attachments.AsNoTracking().Where(a => ids.Contains(a.Id)).ToDictionaryAsync(a => a.Id, ct);
    }

    private async Task ValidateAsync(InvoiceRequest request, CancellationToken ct)
    {
        var validation = new Validation()
            .RequireText(request.InvoiceNumber, nameof(request.InvoiceNumber), 64)
            .RequireText(request.Notes, nameof(request.Notes), 2000, required: false)
            .Require(request.PeriodEnd >= request.PeriodStart, nameof(request.PeriodEnd), "Koniec okresu musi być późniejszy lub równy początkowi.")
            .Require(request.PeriodEnd.DayNumber - request.PeriodStart.DayNumber <= 3 * 366, nameof(request.PeriodEnd), "Okres faktury nie może przekraczać 3 lat.")
            .Require(request.TotalGross is >= -1_000_000 and <= 10_000_000, nameof(request.TotalGross), "Nieprawidłowa kwota brutto.")
            .Require(decimal.Round(request.TotalGross, 2) == request.TotalGross, nameof(request.TotalGross), "Kwota może mieć maksymalnie 2 miejsca po przecinku.")
            .Require(request.TotalNet is null || decimal.Round(request.TotalNet.Value, 2) == request.TotalNet, nameof(request.TotalNet), "Kwota może mieć maksymalnie 2 miejsca po przecinku.")
            .Require(request.ConsumptionKwh is null or >= 0, nameof(request.ConsumptionKwh), "Zużycie nie może być ujemne.");
        if (request.SupplierId is { } supplierId)
            validation.Require(await db.EnergySuppliers.AnyAsync(s => s.Id == supplierId, ct), nameof(request.SupplierId), "Wybrany sprzedawca nie istnieje.");
        validation.ThrowIfInvalid();
    }

    private static void Apply(Invoice invoice, InvoiceRequest request, DateTimeOffset now)
    {
        invoice.SupplierId = request.SupplierId;
        invoice.InvoiceNumber = request.InvoiceNumber.Trim();
        invoice.IssueDate = request.IssueDate;
        invoice.PeriodStart = request.PeriodStart;
        invoice.PeriodEnd = request.PeriodEnd;
        invoice.ConsumptionKwh = request.ConsumptionKwh;
        invoice.TotalNet = request.TotalNet;
        invoice.TotalGross = request.TotalGross;
        invoice.Notes = Validation.Clean(request.Notes);
        invoice.UpdatedAt = now;
    }

    private InvoiceDto ToDto(Invoice i, IReadOnlyDictionary<Guid, Attachment> attachments, PropertyEnergyData data)
    {
        var start = TimeZones.StartOfDay(i.PeriodStart, data.TimeZone);
        var end = TimeZones.StartOfDay(i.PeriodEnd.AddDays(1), data.TimeZone);
        var estimate = CostEngine.Calculate(data, start, end, clock.GetUtcNow());

        InvoiceComparisonDto? comparison = null;
        if (estimate.Lines.Count > 0)
        {
            var difference = i.TotalGross - estimate.TotalGross;
            decimal? percent = estimate.TotalGross != 0 ? Math.Round(difference / estimate.TotalGross * 100m, 1, MidpointRounding.AwayFromZero) : null;
            comparison = new InvoiceComparisonDto(estimate.TotalGross, estimate.ConsumptionKwh, difference, percent, estimate.IsEstimate, estimate.IsComplete);
        }

        var attachment = i.AttachmentId is { } id && attachments.TryGetValue(id, out var a) ? ToDto(a) : null;
        return new InvoiceDto(i.Id, i.PropertyId, i.SupplierId, i.InvoiceNumber, i.IssueDate, i.PeriodStart, i.PeriodEnd, i.ConsumptionKwh,
            i.TotalNet, i.TotalGross, i.CurrencyCode, i.Notes, attachment, comparison, i.CreatedAt, i.UpdatedAt);
    }

    private static AttachmentDto ToDto(Attachment a) => new(a.Id, a.FileName, a.ContentType, a.SizeBytes, a.CreatedAt);

    private static string SanitizeFileName(string fileName, string contentType)
    {
        var name = Path.GetFileNameWithoutExtension(fileName ?? string.Empty);
        name = new string(name.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_' or ' ' or '.').ToArray()).Trim();
        if (name.Length == 0)
            name = "zalacznik";
        if (name.Length > 100)
            name = name[..100];
        return name + FileSignatures.Extension(contentType);
    }
}
