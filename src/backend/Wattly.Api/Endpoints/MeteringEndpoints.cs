using Wattly.Application.Metering;

namespace Wattly.Api.Endpoints;

/// <summary>Endpoints for meters, registers and readings.</summary>
public static class MeteringEndpoints
{
    /// <summary>Maps the endpoints.</summary>
    /// <param name="api">Authorised <c>/api/v1</c> route group.</param>
    public static void MapMeteringEndpoints(this RouteGroupBuilder api)
    {
        var meters = api.MapGroup("").WithTags("Meters");
        meters.MapGet("/properties/{propertyId:guid}/meters", (Guid propertyId, MeterService s, CancellationToken ct) => s.ListAsync(propertyId, ct));
        meters.MapPost("/properties/{propertyId:guid}/meters", async (Guid propertyId, MeterRequest r, MeterService s, CancellationToken ct) =>
        {
            var created = await s.CreateAsync(propertyId, r, ct);
            return Results.Created($"/api/v1/meters/{created.Id}", created);
        });
        meters.MapGet("/meters/{meterId:guid}", (Guid meterId, MeterService s, CancellationToken ct) => s.GetAsync(meterId, ct));
        meters.MapPut("/meters/{meterId:guid}", (Guid meterId, MeterRequest r, MeterService s, CancellationToken ct) => s.UpdateAsync(meterId, r, ct));
        meters.MapGet("/meters/{meterId:guid}/registers", (Guid meterId, MeterService s, CancellationToken ct) => s.ListRegistersAsync(meterId, ct));
        meters.MapPost("/meters/{meterId:guid}/registers", async (Guid meterId, RegisterRequest r, MeterService s, CancellationToken ct) =>
        {
            var created = await s.AddRegisterAsync(meterId, r, ct);
            return Results.Created($"/api/v1/meters/{meterId}/registers", created);
        });

        var readings = api.MapGroup("").WithTags("Readings");
        readings.MapGet("/registers/{registerId:guid}/readings",
            (Guid registerId, DateTimeOffset? from, DateTimeOffset? to, bool? includeInactive, int? page, int? pageSize, ReadingService s, CancellationToken ct) =>
                s.ListAsync(registerId, from, to, includeInactive ?? false, page, pageSize, ct));
        readings.MapPost("/registers/{registerId:guid}/readings", async (Guid registerId, ReadingRequest r, ReadingService s, CancellationToken ct) =>
        {
            var saved = await s.CreateAsync(registerId, r, ct);
            return Results.Created($"/api/v1/readings/{saved.Reading.Id}", saved);
        });
        readings.MapGet("/readings/{readingId:guid}", (Guid readingId, ReadingService s, CancellationToken ct) => s.GetAsync(readingId, ct));
        readings.MapPut("/readings/{readingId:guid}", (Guid readingId, ReadingRequest r, ReadingService s, CancellationToken ct) => s.CorrectAsync(readingId, r, ct));
        readings.MapPost("/readings/{readingId:guid}/void", (Guid readingId, VoidReadingRequest r, ReadingService s, CancellationToken ct) => s.VoidAsync(readingId, r, ct));
    }
}
