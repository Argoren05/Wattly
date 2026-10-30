using Wattly.Domain.Metering;

namespace Wattly.Application.Metering;

public sealed record RegisterDto(
    Guid Id,
    Guid MeterId,
    string? Code,
    string Name,
    RegisterType RegisterType,
    string? ZoneCode,
    string Unit,
    int DecimalPlaces);

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

public sealed record RegisterRequest(string Name, RegisterType RegisterType, string? ZoneCode, string? Code, int? DecimalPlaces);

public sealed record MeterRequest(
    string Name,
    string? SerialNumber,
    MeterType MeterType,
    MeterDirectionality Directionality,
    DateOnly? InstalledAt,
    DateOnly? RemovedAt,
    bool? IsActive,
    IReadOnlyList<RegisterRequest>? Registers);

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

public sealed record ReadingRequest(
    DateTimeOffset ReadingAt,
    decimal Value,
    ReadingSource? Source,
    decimal? Confidence,
    string? Note,
    bool ConfirmAnomaly = false);

public sealed record ReadingWarningDto(string Code, string Message);

public sealed record ReadingSavedDto(ReadingDto Reading, IReadOnlyList<ReadingWarningDto> Warnings);

public sealed record VoidReadingRequest(string? Reason);
