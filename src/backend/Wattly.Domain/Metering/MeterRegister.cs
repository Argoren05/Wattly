using Wattly.Domain.Common;

namespace Wattly.Domain.Metering;

/// <summary>Register of a meter, e.g. import in a tariff zone or export.</summary>
public class MeterRegister : Entity
{
    /// <summary>Owning meter.</summary>
    public Guid MeterId { get; set; }

    /// <summary>Navigation to the meter.</summary>
    public Meter Meter { get; set; } = null!;

    /// <summary>OBIS code or other identifier, if known.</summary>
    public string? Code { get; set; }

    /// <summary>Display name, e.g. "Dzień".</summary>
    public required string Name { get; set; }

    /// <summary>Import or export.</summary>
    public RegisterType RegisterType { get; set; }

    /// <summary>Tariff zone code; null for single-zone registers.</summary>
    public string? ZoneCode { get; set; }

    /// <summary>Unit of the register (always kWh for electricity).</summary>
    public string Unit { get; set; } = Units.KilowattHour;

    /// <summary>Number of decimal places displayed by the meter (0–4).</summary>
    public int DecimalPlaces { get; set; } = 1;

    /// <summary>Readings of the register.</summary>
    public List<MeterReading> Readings { get; set; } = [];
}
