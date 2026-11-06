using Wattly.Application.Appliances;

namespace Wattly.Api.Endpoints;

/// <summary>Endpoints for appliances (Tapo plugs, manual devices) and the consumption breakdown.</summary>
public static class ApplianceEndpoints
{
    /// <summary>Maps the endpoints.</summary>
    /// <param name="api">Authorised <c>/api/v1</c> route group.</param>
    public static void MapApplianceEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("").WithTags("Appliances");
        group.MapGet("/properties/{propertyId:guid}/appliances", (Guid propertyId, ApplianceService s, CancellationToken ct) => s.ListAsync(propertyId, ct));
        group.MapPost("/properties/{propertyId:guid}/appliances", async (Guid propertyId, ApplianceRequest r, ApplianceService s, CancellationToken ct) =>
        {
            var created = await s.CreateAsync(propertyId, r, ct);
            return Results.Created($"/api/v1/appliances/{created.Id}", created);
        });
        group.MapGet("/properties/{propertyId:guid}/appliances/breakdown", (Guid propertyId, DateOnly from, DateOnly to, ApplianceService s, CancellationToken ct) =>
            s.BreakdownAsync(propertyId, from, to, ct));
        group.MapPut("/appliances/{applianceId:guid}", (Guid applianceId, ApplianceRequest r, ApplianceService s, CancellationToken ct) => s.UpdateAsync(applianceId, r, ct));
        group.MapDelete("/appliances/{applianceId:guid}", async (Guid applianceId, ApplianceService s, CancellationToken ct) =>
        {
            await s.DeleteAsync(applianceId, ct);
            return Results.NoContent();
        });
        group.MapGet("/appliances/{applianceId:guid}/usage", (Guid applianceId, ApplianceService s, CancellationToken ct) => s.ListUsageAsync(applianceId, ct));
        group.MapPut("/appliances/{applianceId:guid}/usage", (Guid applianceId, ApplianceUsageRequest r, ApplianceService s, CancellationToken ct) =>
            s.SaveUsageAsync(applianceId, r, ct));
        group.MapDelete("/appliances/{applianceId:guid}/usage/{usageId:guid}", async (Guid applianceId, Guid usageId, ApplianceService s, CancellationToken ct) =>
        {
            await s.DeleteUsageAsync(applianceId, usageId, ct);
            return Results.NoContent();
        });
    }
}
