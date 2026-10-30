using Wattly.Application.Catalog;
using Wattly.Application.Properties;

namespace Wattly.Api.Endpoints;

public static class PropertyEndpoints
{
    public static void MapPropertyEndpoints(this RouteGroupBuilder api)
    {
        var properties = api.MapGroup("/properties").WithTags("Properties");

        properties.MapGet("/", (PropertyService s, CancellationToken ct) => s.ListAsync(ct));
        properties.MapPost("/", async (PropertyRequest request, PropertyService s, CancellationToken ct) =>
        {
            var created = await s.CreateAsync(request, ct);
            return Results.Created($"/api/v1/properties/{created.Id}", created);
        });
        properties.MapGet("/{propertyId:guid}", (Guid propertyId, PropertyService s, CancellationToken ct) => s.GetAsync(propertyId, ct));
        properties.MapPut("/{propertyId:guid}", (Guid propertyId, PropertyRequest request, PropertyService s, CancellationToken ct) =>
            s.UpdateAsync(propertyId, request, ct));
        properties.MapDelete("/{propertyId:guid}", async (Guid propertyId, PropertyService s, CancellationToken ct) =>
        {
            await s.DeleteAsync(propertyId, ct);
            return Results.NoContent();
        });

        properties.MapGet("/{propertyId:guid}/energy-contract", (Guid propertyId, EnergyContractService s, CancellationToken ct) =>
            s.GetCurrentAsync(propertyId, ct)).WithTags("Contracts");
        properties.MapPut("/{propertyId:guid}/energy-contract", (Guid propertyId, EnergyContractRequest request, EnergyContractService s, CancellationToken ct) =>
            s.UpsertAsync(propertyId, request, ct)).WithTags("Contracts");
        properties.MapGet("/{propertyId:guid}/energy-contracts", (Guid propertyId, EnergyContractService s, CancellationToken ct) =>
            s.ListAsync(propertyId, ct)).WithTags("Contracts");

        properties.MapGet("/{propertyId:guid}/rate-plans", (Guid propertyId, RatePlanService s, CancellationToken ct) =>
            s.ListForPropertyAsync(propertyId, ct)).WithTags("Rate plans");
        properties.MapPost("/{propertyId:guid}/rate-plans", async (Guid propertyId, RatePlanRequest request, RatePlanService s, CancellationToken ct) =>
        {
            var created = await s.CreatePropertyPlanAsync(propertyId, request, ct);
            return Results.Created($"/api/v1/rate-plans/{created.Id}", created);
        }).WithTags("Rate plans");

        var plans = api.MapGroup("/rate-plans").WithTags("Rate plans");
        plans.MapGet("/{ratePlanId:guid}", (Guid ratePlanId, RatePlanService s, CancellationToken ct) => s.GetAsync(ratePlanId, ct));
        plans.MapPost("/{ratePlanId:guid}/end", (Guid ratePlanId, EndRatePlanRequest request, RatePlanService s, CancellationToken ct) =>
            s.EndAsync(ratePlanId, request, ct));
    }
}
