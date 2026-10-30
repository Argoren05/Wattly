using Wattly.Domain.Common;

namespace Wattly.Domain.Metering;

/// <summary>Register of a meter, e.g. import in a tariff zone or export.</summary>
public class MeterRegister : Entity
{
    public Guid MeterId { get; set; }
    public Meter Meter { get; set; } = null!;

    /// <summary>OBIS code or other identifier, if known.</summary>
    public string? Code { get; set; }

    public required string Name { get; set; }
    public RegisterType RegisterType { get; set; }

    /// <summary>Tariff zone code; null for single-zone registers.</summary>
    public string? ZoneCode { get; set; }

    public string Unit { get; set; } = Units.KilowattHour;
    public int DecimalPlaces { get; set; } = 1;

    public List<MeterReading> Readings { get; set; } = [];
}
