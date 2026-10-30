using Wattly.Application.Analytics;
using Wattly.Application.Calculations;
using Wattly.Application.Invoices;

namespace Wattly.Api.Endpoints;

/// <summary>Endpoints for calculations, analytics, forecast, invoices and attachments.</summary>
public static class BillingEndpoints
{
    /// <summary>Maps the endpoints.</summary>
    /// <param name="api">Authorised <c>/api/v1</c> route group.</param>
    public static void MapBillingEndpoints(this RouteGroupBuilder api)
    {
        var calculations = api.MapGroup("").WithTags("Calculations");
        calculations.MapPost("/properties/{propertyId:guid}/calculations/preview", (Guid propertyId, CalculationRequest r, CalculationService s, CancellationToken ct) =>
            s.PreviewAsync(propertyId, r, ct));
        calculations.MapPost("/properties/{propertyId:guid}/calculations", async (Guid propertyId, CalculationRequest r, CalculationService s, CancellationToken ct) =>
        {
            var saved = await s.SaveAsync(propertyId, r, ct);
            return Results.Created($"/api/v1/calculations/{saved.Id}", saved);
        });
        calculations.MapGet("/properties/{propertyId:guid}/calculations", (Guid propertyId, int? page, int? pageSize, CalculationService s, CancellationToken ct) =>
            s.ListAsync(propertyId, page, pageSize, ct));
        calculations.MapGet("/calculations/{calculationId:guid}", (Guid calculationId, CalculationService s, CancellationToken ct) => s.GetAsync(calculationId, ct));

        var analytics = api.MapGroup("/properties/{propertyId:guid}").WithTags("Analytics");
        analytics.MapGet("/analytics/consumption", (Guid propertyId, DateOnly from, DateOnly to, Granularity? granularity, AnalyticsService s, CancellationToken ct) =>
            s.ConsumptionAsync(propertyId, from, to, granularity ?? Granularity.Day, ct));
        analytics.MapGet("/analytics/costs", (Guid propertyId, DateOnly from, DateOnly to, Granularity? granularity, AnalyticsService s, CancellationToken ct) =>
            s.CostsAsync(propertyId, from, to, granularity ?? Granularity.Month, ct));
        analytics.MapGet("/forecast", (Guid propertyId, AnalyticsService s, CancellationToken ct) => s.ForecastAsync(propertyId, ct));

        var invoices = api.MapGroup("").WithTags("Invoices");
        invoices.MapGet("/properties/{propertyId:guid}/invoices", (Guid propertyId, InvoiceService s, CancellationToken ct) => s.ListAsync(propertyId, ct));
        invoices.MapPost("/properties/{propertyId:guid}/invoices", async (Guid propertyId, InvoiceRequest r, InvoiceService s, CancellationToken ct) =>
        {
            var created = await s.CreateAsync(propertyId, r, ct);
            return Results.Created($"/api/v1/invoices/{created.Id}", created);
        });
        invoices.MapGet("/invoices/{invoiceId:guid}", (Guid invoiceId, InvoiceService s, CancellationToken ct) => s.GetAsync(invoiceId, ct));
        invoices.MapPut("/invoices/{invoiceId:guid}", (Guid invoiceId, InvoiceRequest r, InvoiceService s, CancellationToken ct) => s.UpdateAsync(invoiceId, r, ct));
        invoices.MapDelete("/invoices/{invoiceId:guid}", async (Guid invoiceId, InvoiceService s, CancellationToken ct) =>
        {
            await s.DeleteAsync(invoiceId, ct);
            return Results.NoContent();
        });

        // Bearer-token API without cookies, so antiforgery protection is not applicable to the upload.
        invoices.MapPost("/invoices/{invoiceId:guid}/attachments", async (Guid invoiceId, IFormFile file, InvoiceService s, CancellationToken ct) =>
            {
                await using var stream = file.OpenReadStream();
                return Results.Ok(await s.AttachAsync(invoiceId, file.FileName, file.Length, stream, ct));
            })
            .DisableAntiforgery()
            .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(InvoiceService.MaxAttachmentBytes + 64 * 1024));
        invoices.MapGet("/attachments/{attachmentId:guid}", async (Guid attachmentId, InvoiceService s, CancellationToken ct) =>
        {
            var file = await s.OpenAttachmentAsync(attachmentId, ct);
            return Results.File(file.Content, file.ContentType, file.FileName);
        });
    }
}
