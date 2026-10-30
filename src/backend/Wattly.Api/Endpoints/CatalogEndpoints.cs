using Wattly.Application.Catalog;

namespace Wattly.Api.Endpoints;

public static class CatalogEndpoints
{
    public static void MapCatalogEndpoints(this RouteGroupBuilder api)
    {
        var catalog = api.MapGroup("/catalog").WithTags("Catalog");
        catalog.MapGet("/operators", (CatalogService s, CancellationToken ct) => s.ListOperatorsAsync(false, ct));
        catalog.MapGet("/suppliers", (CatalogService s, CancellationToken ct) => s.ListSuppliersAsync(false, ct));
        catalog.MapGet("/tariffs", (CatalogService s, CancellationToken ct) => s.ListTariffsAsync(false, ct));
        catalog.MapGet("/tariffs/{tariffId:guid}", (Guid tariffId, CatalogService s, CancellationToken ct) => s.GetTariffAsync(tariffId, ct));
        catalog.MapGet("/tariffs/{tariffId:guid}/rate-plans", (Guid tariffId, RatePlanService s, CancellationToken ct) => s.ListCatalogAsync(tariffId, ct));

        var admin = api.MapGroup("/admin").WithTags("Administration").RequireAuthorization(AuthorizationPolicies.Admin);
        admin.MapGet("/operators", (CatalogService s, CancellationToken ct) => s.ListOperatorsAsync(true, ct));
        admin.MapPost("/operators", (CatalogEntryRequest r, CatalogService s, CancellationToken ct) => s.CreateOperatorAsync(r, ct));
        admin.MapPut("/operators/{id:guid}", (Guid id, CatalogEntryRequest r, CatalogService s, CancellationToken ct) => s.UpdateOperatorAsync(id, r, ct));
        admin.MapGet("/suppliers", (CatalogService s, CancellationToken ct) => s.ListSuppliersAsync(true, ct));
        admin.MapPost("/suppliers", (CatalogEntryRequest r, CatalogService s, CancellationToken ct) => s.CreateSupplierAsync(r, ct));
        admin.MapPut("/suppliers/{id:guid}", (Guid id, CatalogEntryRequest r, CatalogService s, CancellationToken ct) => s.UpdateSupplierAsync(id, r, ct));
        admin.MapGet("/tariffs", (CatalogService s, CancellationToken ct) => s.ListTariffsAsync(true, ct));
        admin.MapPost("/tariffs", (TariffRequest r, CatalogService s, CancellationToken ct) => s.CreateTariffAsync(r, ct));
        admin.MapPut("/tariffs/{id:guid}", (Guid id, TariffRequest r, CatalogService s, CancellationToken ct) => s.UpdateTariffAsync(id, r, ct));
        admin.MapPost("/tariffs/{tariffId:guid}/rate-plans", async (Guid tariffId, RatePlanRequest r, RatePlanService s, CancellationToken ct) =>
        {
            var created = await s.CreateCatalogPlanAsync(r with { TariffId = tariffId }, ct);
            return Results.Created($"/api/v1/rate-plans/{created.Id}", created);
        });
    }
}
