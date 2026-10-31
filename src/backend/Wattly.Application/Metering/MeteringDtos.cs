using Wattly.Domain.Metering;

namespace Wattly.Application.Metering;

/// <summary>Meter register.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="MeterId">Meter.</param>
/// <param name="Code">OBIS code.</param>
/// <param name="Name">Name.</param>
/// <param name="RegisterType">Import or export.</param>
/// <param name="ZoneCode">Tariff zone.</param>
/// <param name="Unit">Unit.</param>
/// <param name="DecimalPlaces">Allowed decimal places.</param>
public sealed record RegisterDto(
    Guid Id,
    Guid MeterId,
    string? Code,
    string Name,
    RegisterType RegisterType,
    string? ZoneCode,
    string Unit,
    int DecimalPlaces);

/// <summary>Meter with registers.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="PropertyId">Property.</param>
/// <param name="Name">Name.</param>
/// <param name="SerialNumber">Serial number.</param>
/// <param name="MeterType">Technology.</param>
/// <param name="Directionality">Import only or bidirectional.</param>
/// <param name="InstalledAt">Installation date.</param>
/// <param name="RemovedAt">Removal date.</param>
/// <param name="IsActive">Active flag.</param>
/// <param name="Registers">Registers.</param>
public sealed record MeterDto(
    Guid Id,
    Guid PropertyId,
    string Name,
    string? SerialNumber,
    MeterType MeterType,
    MeterDirectionality Directionality,
    DateOnly? InstalledAt,
    DateOnly? RemovedAt,
    bool IsActive,
    IReadOnlyList<RegisterDto> Registers);

/// <summary>Register in a create request.</summary>
/// <param name="Name">Name.</param>
/// <param name="RegisterType">Import or export.</param>
/// <param name="ZoneCode">Tariff zone.</param>
/// <param name="Code">OBIS code.</param>
/// <param name="DecimalPlaces">0–4 (default 1).</param>
public sealed record RegisterRequest(string Name, RegisterType RegisterType, string? ZoneCode, string? Code, int? DecimalPlaces);

/// <summary>Create/update request for a meter.</summary>
/// <param name="Name">Name.</param>
/// <param name="SerialNumber">Serial number.</param>
/// <param name="MeterType">Technology.</param>
/// <param name="Directionality">Import only or bidirectional.</param>
/// <param name="InstalledAt">Installation date.</param>
/// <param name="RemovedAt">Removal date.</param>
/// <param name="IsActive">Active flag.</param>
/// <param name="Registers">Registers (create only; default: one import register).</param>
public sealed record MeterRequest(
    string Name,
    string? SerialNumber,
    MeterType MeterType,
    MeterDirectionality Directionality,
    DateOnly? InstalledAt,
    DateOnly? RemovedAt,
    bool? IsActive,
    IReadOnlyList<RegisterRequest>? Registers);

/// <summary>Reading with consumption since the previous active reading.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="RegisterId">Register.</param>
/// <param name="ReadingAt">Moment of the reading.</param>
/// <param name="Value">Register value.</param>
/// <param name="Unit">Unit.</param>
/// <param name="Source">Origin.</param>
/// <param name="Confidence">OCR confidence.</param>
/// <param name="Note">Note.</param>
/// <param name="Status">Lifecycle state.</param>
/// <param name="SupersedesReadingId">Corrected reading.</param>
/// <param name="VoidReason">Reason of cancellation.</param>
/// <param name="CreatedAt">Creation time.</param>
/// <param name="ConsumptionSincePrevious">Difference to the previous active reading.</param>
/// <param name="DaysSincePrevious">Days since the previous active reading.</param>
public sealed record ReadingDto(
    Guid Id,
    Guid RegisterId,
    DateTimeOffset ReadingAt,
    decimal Value,
    string Unit,
    ReadingSource Source,
    decimal? Confidence,
    string? Note,
    ReadingStatus Status,
    Guid? SupersedesReadingId,
    string? VoidReason,
    DateTimeOffset CreatedAt,
    decimal? ConsumptionSincePrevious,
    decimal? DaysSincePrevious);

/// <summary>New reading or correction.</summary>
/// <param name="ReadingAt">Moment of the reading.</param>
/// <param name="Value">Register value.</param>
/// <param name="Source">Manual (default) or confirmed OCR.</param>
/// <param name="Confidence">OCR confidence.</param>
/// <param name="Note">Note.</param>
/// <param name="ConfirmAnomaly">Save even when an unusual jump is detected.</param>
public sealed record ReadingRequest(
    DateTimeOffset ReadingAt,
    decimal Value,
    ReadingSource? Source,
    decimal? Confidence,
    string? Note,
    bool ConfirmAnomaly = false);

/// <summary>Non-blocking warning about a saved reading.</summary>
/// <param name="Code">Warning code.</param>
/// <param name="Message">Explanation.</param>
public sealed record ReadingWarningDto(string Code, string Message);

/// <summary>Saved reading with warnings.</summary>
/// <param name="Reading">The saved reading.</param>
/// <param name="Warnings">Confirmed warnings.</param>
public sealed record ReadingSavedDto(ReadingDto Reading, IReadOnlyList<ReadingWarningDto> Warnings);

/// <summary>Cancellation request.</summary>
/// <param name="Reason">Optional reason.</param>
public sealed record VoidReadingRequest(string? Reason);
