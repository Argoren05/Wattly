namespace Wattly.Domain.Tariffs;

public enum RateComponentType
{
    Energy,
    VariableDistribution,
    FixedDistribution,
    Subscription,
    Capacity,
    Other,
}

public enum RateUnit
{
    Kwh,
    Month,
    Day,
    Kw,
}

public enum CostCategory
{
    Energy,
    Distribution,
    Other,
}

public static class RateComponentTypeExtensions
{
    public static CostCategory ToCategory(this RateComponentType type) => type switch
    {
        RateComponentType.Energy => CostCategory.Energy,
        RateComponentType.VariableDistribution or RateComponentType.FixedDistribution or RateComponentType.Capacity => CostCategory.Distribution,
        _ => CostCategory.Other,
    };
}
