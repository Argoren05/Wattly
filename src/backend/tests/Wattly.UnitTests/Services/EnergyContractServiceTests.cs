using Wattly.Application.Common;
using Wattly.Application.Properties;
using Wattly.UnitTests.Support;

namespace Wattly.UnitTests.Services;

/// <summary>Tests of <see cref="EnergyContractService"/>.</summary>
public class EnergyContractServiceTests
{
    [Fact]
    public async Task Upsert_creates_contract_and_returns_tariff_code()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var tariff = t.AddTariff();
        var service = new EnergyContractService(t.Db, t.User, t.Clock);

        var contract = await service.UpsertAsync(property.Id, new EnergyContractRequest(null, null, tariff.Id, 7m, new DateOnly(2026, 1, 1), null), CancellationToken.None);

        Assert.Equal("G12", contract.TariffCode);
        Assert.Equal(7m, contract.ContractedPowerKw);
    }

    [Fact]
    public async Task New_contract_closes_previous_open_contract()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var tariff = t.AddTariff();
        var service = new EnergyContractService(t.Db, t.User, t.Clock);
        await service.UpsertAsync(property.Id, new EnergyContractRequest(null, null, tariff.Id, null, new DateOnly(2026, 1, 1), null), CancellationToken.None);

        await service.UpsertAsync(property.Id, new EnergyContractRequest(null, null, tariff.Id, null, new DateOnly(2026, 6, 1), null), CancellationToken.None);

        var history = await service.ListAsync(property.Id, CancellationToken.None);
        Assert.Equal(2, history.Count);
        Assert.Equal(new DateOnly(2026, 5, 31), history.Single(c => c.ValidFrom == new DateOnly(2026, 1, 1)).ValidTo);
    }

    [Fact]
    public async Task Update_corrects_start_date_of_existing_contract()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var tariff = t.AddTariff();
        var service = new EnergyContractService(t.Db, t.User, t.Clock);
        var wrong = await service.UpsertAsync(property.Id, new EnergyContractRequest(null, null, tariff.Id, 4m, new DateOnly(2026, 10, 1), null), CancellationToken.None);

        var fixedContract = await service.UpdateAsync(wrong.Id, new EnergyContractRequest(null, null, tariff.Id, 4m, new DateOnly(2026, 2, 7), null), CancellationToken.None);

        Assert.Equal(wrong.Id, fixedContract.Id);
        Assert.Equal(new DateOnly(2026, 2, 7), Assert.Single(await service.ListAsync(property.Id, CancellationToken.None)).ValidFrom);
    }

    [Fact]
    public async Task Update_reports_overlap_instead_of_shortening_other_contracts()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var tariff = t.AddTariff();
        var service = new EnergyContractService(t.Db, t.User, t.Clock);
        await service.UpsertAsync(property.Id, new EnergyContractRequest(null, null, tariff.Id, null, new DateOnly(2026, 1, 1), null), CancellationToken.None);
        var later = await service.UpsertAsync(property.Id, new EnergyContractRequest(null, null, tariff.Id, null, new DateOnly(2026, 6, 1), null), CancellationToken.None);

        var conflict = await Assert.ThrowsAsync<ConflictException>(() =>
            service.UpdateAsync(later.Id, new EnergyContractRequest(null, null, tariff.Id, null, new DateOnly(2026, 3, 1), null), CancellationToken.None));

        Assert.Equal("contract.overlap", conflict.Code);
        Assert.Equal(new DateOnly(2026, 5, 31), (await service.ListAsync(property.Id, CancellationToken.None)).Single(c => c.Id != later.Id).ValidTo);
    }

    [Fact]
    public async Task Delete_removes_contract_and_foreign_contracts_are_not_found()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var foreign = t.AddProperty(ownerId: Guid.NewGuid());
        var tariff = t.AddTariff();
        var service = new EnergyContractService(t.Db, t.User, t.Clock);
        var own = await service.UpsertAsync(property.Id, new EnergyContractRequest(null, null, tariff.Id, null, new DateOnly(2026, 1, 1), null), CancellationToken.None);
        var foreignContract = new Wattly.Domain.Households.EnergyContract { PropertyId = foreign.Id, TariffId = tariff.Id, ValidFrom = new DateOnly(2026, 1, 1) };
        t.Db.EnergyContracts.Add(foreignContract);
        await t.Db.SaveChangesAsync();

        await service.DeleteAsync(own.Id, CancellationToken.None);

        Assert.Empty(await service.ListAsync(property.Id, CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => service.DeleteAsync(foreignContract.Id, CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.UpdateAsync(foreignContract.Id, new EnergyContractRequest(null, null, tariff.Id, null, new DateOnly(2026, 1, 1), null), CancellationToken.None));
    }

    [Fact]
    public async Task Same_start_date_updates_existing_contract()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var tariff = t.AddTariff();
        var other = t.AddTariff("G11");
        var service = new EnergyContractService(t.Db, t.User, t.Clock);
        await service.UpsertAsync(property.Id, new EnergyContractRequest(null, null, tariff.Id, null, new DateOnly(2026, 1, 1), null), CancellationToken.None);

        await service.UpsertAsync(property.Id, new EnergyContractRequest(null, null, other.Id, null, new DateOnly(2026, 1, 1), null), CancellationToken.None);

        var current = Assert.Single(await service.ListAsync(property.Id, CancellationToken.None));
        Assert.Equal("G11", current.TariffCode);
    }

    [Fact]
    public async Task Overlap_with_later_contract_is_a_conflict()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var tariff = t.AddTariff();
        var service = new EnergyContractService(t.Db, t.User, t.Clock);
        await service.UpsertAsync(property.Id, new EnergyContractRequest(null, null, tariff.Id, null, new DateOnly(2026, 6, 1), null), CancellationToken.None);

        var error = await Assert.ThrowsAsync<ConflictException>(() =>
            service.UpsertAsync(property.Id, new EnergyContractRequest(null, null, tariff.Id, null, new DateOnly(2026, 1, 1), null), CancellationToken.None));

        Assert.Equal("contract.overlap", error.Code);
    }

    [Fact]
    public async Task Invalid_references_and_dates_are_rejected()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var service = new EnergyContractService(t.Db, t.User, t.Clock);

        var error = await Assert.ThrowsAsync<ValidationFailedException>(() => service.UpsertAsync(property.Id,
            new EnergyContractRequest(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), -1, new DateOnly(2026, 5, 1), new DateOnly(2026, 1, 1)), CancellationToken.None));

        Assert.Contains("TariffId", error.Errors.Keys);
        Assert.Contains("SupplierId", error.Errors.Keys);
        Assert.Contains("OperatorId", error.Errors.Keys);
        Assert.Contains("ValidTo", error.Errors.Keys);
        Assert.Contains("ContractedPowerKw", error.Errors.Keys);
    }

    [Fact]
    public async Task Current_contract_is_the_one_valid_today_or_404_without_contracts()
    {
        using var t = new TestContext();
        var property = t.AddProperty();
        var tariff = t.AddTariff();
        var service = new EnergyContractService(t.Db, t.User, t.Clock);

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetCurrentAsync(property.Id, CancellationToken.None));

        t.AddContract(property, tariff);
        Assert.Equal(new DateOnly(2026, 1, 1), (await service.GetCurrentAsync(property.Id, CancellationToken.None)).ValidFrom);
    }
}
