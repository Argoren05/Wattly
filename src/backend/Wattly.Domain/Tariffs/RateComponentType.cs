namespace Wattly.Domain.Tariffs;

/// <summary>Kind of a price component on an electricity bill.</summary>
public enum RateComponentType
{
    /// <summary>Active energy sold by the supplier (per kWh).</summary>
    Energy,

    /// <summary>Distribution fees depending on consumption (per kWh).</summary>
    VariableDistribution,

    /// <summary>Fixed distribution fees (per month/day).</summary>
    FixedDistribution,

    /// <summary>Supplier's subscription/trade fee (per month/day).</summary>
    Subscription,

    /// <summary>Capacity fee (per month, per kWh or per kW of contracted power).</summary>
    Capacity,

    /// <summary>Any other fee.</summary>
    Other,
}

/// <summary>Unit in which a component rate is expressed.</summary>
public enum RateUnit
{
    /// <summary>Per kilowatt-hour consumed.</summary>
    Kwh,

    /// <summary>Per calendar month (prorated for partial months).</summary>
    Month,

    /// <summary>Per day.</summary>
    Day,

    /// <summary>Per kW of contracted power per month.</summary>
    Kw,
}

/// <summary>Cost category used for summaries (energy vs distribution vs other).</summary>
public enum CostCategory
{
    /// <summary>Energy sold by the supplier.</summary>
    Energy,

    /// <summary>Distribution and capacity fees charged by the operator.</summary>
    Distribution,

    /// <summary>Remaining fees.</summary>
    Other,
}

/// <summary>Helpers for <see cref="RateComponentType"/>.</summary>
public static class RateComponentTypeExtensions
{
    /// <summary>Maps a component type to its summary category.</summary>
    /// <param name="type">Component type.</param>
    public static CostCategory ToCategory(this RateComponentType type) => type switch
    {
        RateComponentType.Energy => CostCategory.Energy,
        RateComponentType.VariableDistribution or RateComponentType.FixedDistribution or RateComponentType.Capacity => CostCategory.Distribution,
        _ => CostCategory.Other,
    };
}
