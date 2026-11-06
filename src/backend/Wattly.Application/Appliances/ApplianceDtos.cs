using Wattly.Domain.Appliances;

namespace Wattly.Application.Appliances;

/// <summary>Appliance returned by the API.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="PropertyId">Property.</param>
/// <param name="Name">Display name.</param>
/// <param name="Source">Data source.</param>
/// <param name="ExternalId">Identifier in the source system.</param>
/// <param name="Model">Device model.</param>
/// <param name="IsHidden">Left out of the breakdown.</param>
/// <param name="LastUsageDate">Last day with data, if any.</param>
/// <param name="CreatedAt">Creation time.</param>
public sealed record ApplianceDto(
    Guid Id, Guid PropertyId, string Name, ApplianceSource Source, string? ExternalId, string? Model, bool IsHidden, DateOnly? LastUsageDate, DateTimeOffset CreatedAt);

/// <summary>Create/update request of an appliance.</summary>
/// <param name="Name">Display name (required).</param>
/// <param name="Source">Data source (ignored on update).</param>
/// <param name="ExternalId">Identifier in the source system (ignored on update).</param>
/// <param name="Model">Device model.</param>
/// <param name="IsHidden">Left out of the breakdown.</param>
public sealed record ApplianceRequest(string Name, ApplianceSource Source = ApplianceSource.Manual, string? ExternalId = null, string? Model = null, bool IsHidden = false);

/// <summary>Consumption entry.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="PeriodStart">First day.</param>
/// <param name="PeriodEnd">Last day (inclusive).</param>
/// <param name="EnergyKwh">Energy (kWh).</param>
public sealed record ApplianceUsageDto(Guid Id, DateOnly PeriodStart, DateOnly PeriodEnd, decimal EnergyKwh);

/// <summary>Consumption entry to save.</summary>
/// <param name="PeriodStart">First day.</param>
/// <param name="PeriodEnd">Last day (inclusive).</param>
/// <param name="EnergyKwh">Energy (kWh).</param>
public sealed record ApplianceUsageEntry(DateOnly PeriodStart, DateOnly PeriodEnd, decimal EnergyKwh);

/// <summary>Batch of consumption entries; an entry for the same period replaces the stored one.</summary>
/// <param name="Entries">Entries (at most 400).</param>
public sealed record ApplianceUsageRequest(IReadOnlyList<ApplianceUsageEntry>? Entries);

/// <summary>Result of saving a batch.</summary>
/// <param name="Created">New entries.</param>
/// <param name="Updated">Replaced entries.</param>
public sealed record ApplianceUsageSaved(int Created, int Updated);

/// <summary>One line of the breakdown.</summary>
/// <param name="ApplianceId">Appliance (null for "other").</param>
/// <param name="Name">Name.</param>
/// <param name="EnergyKwh">Energy in the range (kWh).</param>
/// <param name="CostGross">Cost at the per-kWh rates (gross), null without rates.</param>
/// <param name="SharePercent">Share of the meter consumption, null without meter data.</param>
/// <param name="CoveredDays">Days of the range with data for the appliance.</param>
public sealed record BreakdownItemDto(Guid? ApplianceId, string Name, decimal EnergyKwh, decimal? CostGross, decimal? SharePercent, int CoveredDays);

/// <summary>Where the electricity went in a date range.</summary>
/// <param name="From">First day.</param>
/// <param name="To">Last day (inclusive).</param>
/// <param name="Days">Days of the range.</param>
/// <param name="MeterKwh">Consumption from the meter readings, null when there are no readings for the range.</param>
/// <param name="MeterIsEstimate">Meter consumption contains interpolation/extrapolation.</param>
/// <param name="PricePerKwhGross">Average gross price of the per-kWh components (energy, variable distribution, fees), null without rates.</param>
/// <param name="CurrencyCode">Currency.</param>
/// <param name="Items">Appliances, largest first.</param>
/// <param name="Other">Rest of the meter consumption (meter minus appliances), null without meter data.</param>
/// <param name="AppliancesExceedMeter">The appliances report more than the meter – data of different periods or a wrong reading.</param>
public sealed record ApplianceBreakdownDto(
    DateOnly From, DateOnly To, int Days, decimal? MeterKwh, bool MeterIsEstimate, decimal? PricePerKwhGross, string CurrencyCode,
    IReadOnlyList<BreakdownItemDto> Items, BreakdownItemDto? Other, bool AppliancesExceedMeter);
