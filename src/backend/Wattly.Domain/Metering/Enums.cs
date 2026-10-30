namespace Wattly.Domain.Metering;

public enum MeterType
{
    Conventional,
    Smart,
}

public enum MeterDirectionality
{
    ImportOnly,
    Bidirectional,
}

public enum RegisterType
{
    /// <summary>Energy drawn from the grid.</summary>
    Import,

    /// <summary>Energy fed into the grid (e.g. photovoltaics).</summary>
    Export,
}

public enum ReadingSource
{
    Manual,
    Ocr,
    Import,
    Integration,
}

public enum ReadingStatus
{
    Active,
    Superseded,
    Voided,
}
