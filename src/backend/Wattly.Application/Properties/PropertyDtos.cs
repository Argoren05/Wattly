namespace Wattly.Application.Properties;

/// <summary>Property returned by the API.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="Name">Display name.</param>
/// <param name="AddressLine">Street and number.</param>
/// <param name="PostalCode">Postal code.</param>
/// <param name="City">City.</param>
/// <param name="CountryCode">ISO country code.</param>
/// <param name="TimeZoneId">IANA time zone.</param>
/// <param name="CurrencyCode">ISO currency code.</param>
/// <param name="BillingPeriodMonths">Billing period length in months.</param>
/// <param name="BillingAnchorDate">First day of a billing period.</param>
/// <param name="MonthlyBudget">Optional monthly gross budget.</param>
/// <param name="CreatedAt">Creation time.</param>
/// <param name="UpdatedAt">Last modification time.</param>
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

/// <summary>Create/update request for a property. Omitted optional settings keep their current (or default) values.</summary>
/// <param name="Name">Display name (required).</param>
/// <param name="AddressLine">Street and number.</param>
/// <param name="PostalCode">Postal code.</param>
/// <param name="City">City.</param>
/// <param name="CountryCode">ISO country code (default PL).</param>
/// <param name="TimeZoneId">IANA time zone (default Europe/Warsaw).</param>
/// <param name="CurrencyCode">ISO currency (default PLN).</param>
/// <param name="BillingPeriodMonths">1, 2, 3, 6 or 12.</param>
/// <param name="BillingAnchorDate">First day of a billing period (default: first day of the current month).</param>
/// <param name="MonthlyBudget">Monthly gross budget; null removes it.</param>
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

/// <summary>Energy contract returned by the API.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="PropertyId">Property.</param>
/// <param name="SupplierId">Energy seller.</param>
/// <param name="SupplierName">Seller name.</param>
/// <param name="OperatorId">Distribution operator.</param>
/// <param name="OperatorName">Operator name.</param>
/// <param name="TariffId">Tariff.</param>
/// <param name="TariffCode">Tariff code.</param>
/// <param name="ContractedPowerKw">Contracted power.</param>
/// <param name="ValidFrom">First day of validity.</param>
/// <param name="ValidTo">Last day of validity (inclusive) or null.</param>
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

/// <summary>Request setting the contract starting at <paramref name="ValidFrom"/>.</summary>
/// <param name="SupplierId">Energy seller (optional).</param>
/// <param name="OperatorId">Distribution operator (optional).</param>
/// <param name="TariffId">Tariff (required).</param>
/// <param name="ContractedPowerKw">Contracted power (optional).</param>
/// <param name="ValidFrom">First day of validity.</param>
/// <param name="ValidTo">Last day of validity (inclusive) or null.</param>
public sealed record EnergyContractRequest(
    Guid? SupplierId,
    Guid? OperatorId,
    Guid TariffId,
    decimal? ContractedPowerKw,
    DateOnly ValidFrom,
    DateOnly? ValidTo);
