namespace Wattly.Application.Properties;

public sealed record PropertyDto(
    Guid Id,
    string Name,
    string? AddressLine,
    string? PostalCode,
    string? City,
    string CountryCode,
    string TimeZoneId,
    string CurrencyCode,
    int BillingPeriodMonths,
    DateOnly BillingAnchorDate,
    decimal? MonthlyBudget,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record PropertyRequest(
    string Name,
    string? AddressLine,
    string? PostalCode,
    string? City,
    string? CountryCode,
    string? TimeZoneId,
    string? CurrencyCode,
    int? BillingPeriodMonths,
    DateOnly? BillingAnchorDate,
    decimal? MonthlyBudget);

public sealed record EnergyContractDto(
    Guid Id,
    Guid PropertyId,
    Guid? SupplierId,
    string? SupplierName,
    Guid? OperatorId,
    string? OperatorName,
    Guid TariffId,
    string TariffCode,
    decimal? ContractedPowerKw,
    DateOnly ValidFrom,
    DateOnly? ValidTo);

public sealed record EnergyContractRequest(
    Guid? SupplierId,
    Guid? OperatorId,
    Guid TariffId,
    decimal? ContractedPowerKw,
    DateOnly ValidFrom,
    DateOnly? ValidTo);
