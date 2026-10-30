using Wattly.Domain.Tariffs;

namespace Wattly.Application.Catalog;

public sealed record CatalogEntryDto(Guid Id, string Name, string Code, string CountryCode, bool IsActive);

public sealed record CatalogEntryRequest(string Name, string Code, string? CountryCode, bool? IsActive);

public sealed record TariffZoneDto(string Code, string Name, string? ScheduleDescription);

public sealed record TariffDto(Guid Id, string Code, string Name, string? Description, bool IsActive, IReadOnlyList<TariffZoneDto> Zones);

public sealed record TariffRequest(string Code, string Name, string? Description, bool? IsActive, IReadOnlyList<TariffZoneDto>? Zones);

public sealed record RateComponentDto(
    Guid Id,
    RateComponentType ComponentType,
    CostCategory Category,
    string Name,
    string? ZoneCode,
    RateUnit Unit,
    decimal NetRate,
    decimal TaxRate);

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

public sealed record RateComponentRequest(
    RateComponentType ComponentType,
    string Name,
    string? ZoneCode,
    RateUnit Unit,
    decimal NetRate,
    decimal TaxRate);

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

public sealed record EndRatePlanRequest(DateOnly ValidTo);
