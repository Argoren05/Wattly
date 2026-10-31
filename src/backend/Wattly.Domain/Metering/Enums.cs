namespace Wattly.Domain.Metering;

/// <summary>Technology of the meter.</summary>
public enum MeterType
{
    /// <summary>Classic meter read manually.</summary>
    Conventional,

    /// <summary>Remote-read (AMI) meter.</summary>
    Smart,
}

/// <summary>Whether the meter measures only consumption or also energy fed into the grid.</summary>
public enum MeterDirectionality
{
    /// <summary>Consumption only.</summary>
    ImportOnly,

    /// <summary>Consumption and export (e.g. photovoltaics).</summary>
    Bidirectional,
}

/// <summary>Direction of energy measured by a register.</summary>
public enum RegisterType
{
    /// <summary>Energy drawn from the grid.</summary>
    Import,

    /// <summary>Energy fed into the grid (e.g. photovoltaics).</summary>
    Export,
}

/// <summary>Origin of a reading.</summary>
public enum ReadingSource
{
    /// <summary>Typed in by the user.</summary>
    Manual,

    /// <summary>Recognised from a photo and confirmed by the user.</summary>
    Ocr,

    /// <summary>Imported from a file.</summary>
    Import,

    /// <summary>Delivered by a device or operator integration.</summary>
    Integration,
}

/// <summary>Lifecycle state of a reading; readings are never physically modified.</summary>
public enum ReadingStatus
{
    /// <summary>Current reading used by calculations.</summary>
    Active,

    /// <summary>Replaced by a correction (kept for audit).</summary>
    Superseded,

    /// <summary>Cancelled by the user (kept for audit).</summary>
    Voided,
}
