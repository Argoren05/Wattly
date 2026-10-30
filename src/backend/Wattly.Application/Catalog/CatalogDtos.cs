using Wattly.Domain.Tariffs;

namespace Wattly.Application.Catalog;

/// <summary>Operator or supplier catalog entry.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="Name">Company name.</param>
/// <param name="Code">Unique code.</param>
/// <param name="CountryCode">ISO country code.</param>
/// <param name="IsActive">Whether users can select it.</param>
public sealed record CatalogEntryDto(Guid Id, string Name, string Code, string CountryCode, bool IsActive);

/// <summary>Create/update request for an operator or supplier (administrators only).</summary>
/// <param name="Name">Company name.</param>
/// <param name="Code">Unique code (upper-cased).</param>
/// <param name="CountryCode">ISO country code (default PL).</param>
/// <param name="IsActive">Active flag (default: unchanged / true).</param>
public sealed record CatalogEntryRequest(string Name, string Code, string? CountryCode, bool? IsActive);

/// <summary>Tariff zone.</summary>
/// <param name="Code">Zone code.</param>
/// <param name="Name">Zone name.</param>
/// <param name="ScheduleDescription">Description of the hours.</param>
public sealed record TariffZoneDto(string Code, string Name, string? ScheduleDescription);

/// <summary>Tariff with zones.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="Code">Tariff code.</param>
/// <param name="Name">Display name.</param>
/// <param name="Description">Description.</param>
/// <param name="IsActive">Whether it can be selected.</param>
/// <param name="Zones">Zones; empty for single-zone tariffs.</param>
public sealed record TariffDto(Guid Id, string Code, string Name, string? Description, bool IsActive, IReadOnlyList<TariffZoneDto> Zones);

/// <summary>Create/update request for a tariff (administrators only).</summary>
/// <param name="Code">Unique code.</param>
/// <param name="Name">Display name.</param>
/// <param name="Description">Description.</param>
/// <param name="IsActive">Active flag.</param>
/// <param name="Zones">Zones (none or at least two).</param>
public sealed record TariffRequest(string Code, string Name, string? Description, bool? IsActive, IReadOnlyList<TariffZoneDto>? Zones);

/// <summary>Rate component of a plan.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="ComponentType">Kind.</param>
/// <param name="Category">Summary category.</param>
/// <param name="Name">Name.</param>
/// <param name="ZoneCode">Zone or null.</param>
/// <param name="Unit">Rate unit.</param>
/// <param name="NetRate">Net rate.</param>
/// <param name="TaxRate">VAT fraction.</param>
public sealed record RateComponentDto(
    Guid Id,
    RateComponentType ComponentType,
    CostCategory Category,
    string Name,
    string? ZoneCode,
    RateUnit Unit,
    decimal NetRate,
    decimal TaxRate);

/// <summary>Rate plan with components.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="TariffId">Tariff.</param>
/// <param name="TariffCode">Tariff code.</param>
/// <param name="SupplierId">Supplier scope.</param>
/// <param name="OperatorId">Operator scope.</param>
/// <param name="PropertyId">Property for user-defined plans; null for catalog plans.</param>
/// <param name="Name">Name.</param>
/// <param name="ValidFrom">First day of validity.</param>
/// <param name="ValidTo">Last day of validity (inclusive) or null.</param>
/// <param name="CurrencyCode">Currency.</param>
/// <param name="SourceReference">Source of the rates.</param>
/// <param name="PublishedAt">Publication date of the source.</param>
/// <param name="CreatedAt">Creation time.</param>
/// <param name="Components">Components.</param>
public sealed record RatePlanDto(
    Guid Id,
    Guid TariffId,
    string TariffCode,
    Guid? SupplierId,
    Guid? OperatorId,
    Guid? PropertyId,
    string Name,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    string CurrencyCode,
    string SourceReference,
    DateOnly? PublishedAt,
    DateTimeOffset CreatedAt,
    IReadOnlyList<RateComponentDto> Components);

/// <summary>Component in a create request.</summary>
/// <param name="ComponentType">Kind.</param>
/// <param name="Name">Name.</param>
/// <param name="ZoneCode">Zone (only for kWh components).</param>
/// <param name="Unit">Rate unit.</param>
/// <param name="NetRate">Net rate (≥ 0).</param>
/// <param name="TaxRate">VAT fraction 0–1.</param>
public sealed record RateComponentRequest(
    RateComponentType ComponentType,
    string Name,
    string? ZoneCode,
    RateUnit Unit,
    decimal NetRate,
    decimal TaxRate);

/// <summary>Request creating a rate plan.</summary>
/// <param name="TariffId">Tariff.</param>
/// <param name="SupplierId">Supplier scope.</param>
/// <param name="OperatorId">Operator scope.</param>
/// <param name="Name">Name.</param>
/// <param name="ValidFrom">First day of validity.</param>
/// <param name="ValidTo">Last day of validity (inclusive) or null.</param>
/// <param name="CurrencyCode">Currency (default PLN).</param>
/// <param name="SourceReference">Source of the rates (required).</param>
/// <param name="PublishedAt">Publication date of the source.</param>
/// <param name="Components">1–50 components.</param>
public sealed record RatePlanRequest(
    Guid TariffId,
    Guid? SupplierId,
    Guid? OperatorId,
    string Name,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    string? CurrencyCode,
    string SourceReference,
    DateOnly? PublishedAt,
    IReadOnlyList<RateComponentRequest>? Components);

/// <summary>Request shortening the validity of a rate plan.</summary>
/// <param name="ValidTo">New last day of validity (inclusive).</param>
public sealed record EndRatePlanRequest(DateOnly ValidTo);
