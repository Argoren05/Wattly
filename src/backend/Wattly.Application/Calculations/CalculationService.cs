using Microsoft.EntityFrameworkCore;
using Wattly.Application.Common;
using Wattly.Domain.Billing;

namespace Wattly.Application.Calculations;

public sealed class CalculationService(IWattlyDbContext db, ICurrentUser currentUser, TimeProvider clock)
{
    public static readonly TimeSpan MaxPeriod = TimeSpan.FromDays(3 * 366);

    public async Task<CalculationResultDto> PreviewAsync(Guid propertyId, CalculationRequest request, CancellationToken ct)
    {
        Validate(request);
        var data = await PropertyEnergyData.LoadAsync(db, currentUser.UserId, propertyId, ct);
        return CostEngine.Calculate(data, request.From, request.To, clock.GetUtcNow());
    }

    /// <summary>Calculates and stores the result together with a snapshot of the rates used.</summary>
    public async Task<CalculationResultDto> SaveAsync(Guid propertyId, CalculationRequest request, CancellationToken ct)
    {
        var result = await PreviewAsync(propertyId, request, ct);

        var entity = new CostCalculation
        {
            PropertyId = propertyId,
            PeriodStart = result.PeriodStart,
            PeriodEnd = result.PeriodEnd,
            CalculatedAt = result.CalculatedAt,
            CalculationVersion = result.CalculationVersion,
            ConsumptionKwh = result.ConsumptionKwh,
            EnergyCostNet = result.EnergyCostNet,
            DistributionCostNet = result.DistributionCostNet,
            OtherCostNet = result.OtherCostNet,
            TotalNet = result.TotalNet,
            TaxAmount = result.TaxAmount,
            TotalGross = result.TotalGross,
            CurrencyCode = result.CurrencyCode,
            IsEstimate = result.IsEstimate,
            IsComplete = result.IsComplete,
            Assumptions = result.Assumptions.ToList(),
            CreatedByUserId = currentUser.UserId,
            Lines = result.Lines.Select(l => new CostCalculationLine
            {
                TariffRatePlanId = l.RatePlanId,
                RatePlanName = l.RatePlanName,
                ComponentType = l.ComponentType,
                Category = l.Category,
                ComponentName = l.ComponentName,
                ZoneCode = l.ZoneCode,
                Unit = l.Unit,
                Quantity = l.Quantity,
                NetRate = l.NetRate,
                TaxRate = l.TaxRate,
                NetAmount = l.NetAmount,
                SegmentStart = l.SegmentStart,
                SegmentEnd = l.SegmentEnd,
            }).ToList(),
        };

        db.CostCalculations.Add(entity);
        await db.SaveChangesAsync(ct);
        return result with { Id = entity.Id };
    }

    public async Task<PagedResult<CalculationSummaryDto>> ListAsync(Guid propertyId, int? page, int? pageSize, CancellationToken ct)
    {
        await db.EnsurePropertyAccessAsync(currentUser.UserId, propertyId, ct);
        var (p, size) = Paging.Normalize(page, pageSize);
        var query = db.CostCalculations.AsNoTracking().Where(c => c.PropertyId == propertyId);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(c => c.CalculatedAt).Skip((p - 1) * size).Take(size)
            .Select(c => new CalculationSummaryDto(c.Id, c.PeriodStart, c.PeriodEnd, c.CalculatedAt, c.ConsumptionKwh, c.TotalGross, c.CurrencyCode, c.IsEstimate, c.IsComplete))
            .ToListAsync(ct);
        return new PagedResult<CalculationSummaryDto>(items, p, size, total);
    }

    /// <summary>Returns a stored calculation exactly as it was computed (rates from the snapshot, not current price lists).</summary>
    public async Task<CalculationResultDto> GetAsync(Guid calculationId, CancellationToken ct)
    {
        var c = await db.CostCalculations.AsNoTracking().Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == calculationId, ct)
                ?? throw new NotFoundException("Kalkulacja");
        await db.EnsurePropertyAccessAsync(currentUser.UserId, c.PropertyId, ct);

        var lines = c.Lines.OrderBy(l => l.SegmentStart).ThenBy(l => l.Category).ThenBy(l => l.ComponentName).ToList();
        var taxes = lines.GroupBy(l => l.TaxRate).OrderBy(g => g.Key)
            .Select(g => new TaxSummaryDto(g.Key, g.Sum(l => l.NetAmount), Domain.Calculations.CostCalculator.RoundMoney(g.Sum(l => l.NetAmount) * g.Key)))
            .ToList();
        var plans = lines.GroupBy(l => l.TariffRatePlanId)
            .Select(g => new AppliedRatePlanDto(g.Key, g.First().RatePlanName, null, null, null))
            .ToList();
        var zones = lines.Where(l => l.ZoneCode != null && l.Unit == Domain.Tariffs.RateUnit.Kwh && l.ComponentType == Domain.Tariffs.RateComponentType.Energy)
            .GroupBy(l => l.ZoneCode)
            .Select(g => new ZoneConsumptionDto(g.Key, g.Sum(l => l.Quantity)))
            .ToList();

        return new CalculationResultDto(
            c.Id, c.PropertyId, c.PeriodStart, c.PeriodEnd, c.CalculatedAt, c.CalculationVersion, c.ConsumptionKwh, zones, [], plans,
            lines.Select(l => new CostLineDto(l.TariffRatePlanId, l.RatePlanName, l.ComponentType, l.Category, l.ComponentName, l.ZoneCode,
                l.Unit, l.Quantity, l.NetRate, l.TaxRate, l.NetAmount, l.SegmentStart, l.SegmentEnd)).ToList(),
            taxes, c.EnergyCostNet, c.DistributionCostNet, c.OtherCostNet, c.TotalNet, c.TaxAmount, c.TotalGross, c.CurrencyCode,
            c.IsEstimate, c.IsComplete, c.Assumptions);
    }

    private static void Validate(CalculationRequest request) => new Validation()
        .Require(request.From != default && request.To != default, nameof(request.From), "Zakres dat jest wymagany.")
        .Require(request.To > request.From, nameof(request.To), "Koniec okresu musi być późniejszy niż początek.")
        .Require(request.To - request.From <= MaxPeriod, nameof(request.To), "Maksymalny okres kalkulacji to 3 lata.")
        .ThrowIfInvalid();
}
