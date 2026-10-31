/** Tests of the configuration screens: property, contract, rates and meters. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import ContractSettings from '../../app/(app)/settings/contract';
import MetersSettings from '../../app/(app)/settings/meters';
import PropertySettings from '../../app/(app)/settings/property';
import RatesSettings from '../../app/(app)/settings/rates';
import { catalogApi, meterApi, propertyApi } from '../../api/endpoints';
import { ApiError } from '../../api/errors';
import { catalog, contract, meter, property, ratePlan } from '../../test/fixtures';
import { renderWithProviders } from '../../test/render';

jest.mock('../../api/endpoints');

beforeEach(() => {
  const data = catalog();
  jest.mocked(catalogApi.operators).mockResolvedValue(data.operators);
  jest.mocked(catalogApi.suppliers).mockResolvedValue(data.suppliers);
  jest.mocked(catalogApi.tariffs).mockResolvedValue(data.tariffs);
  jest.mocked(propertyApi.contract).mockResolvedValue(contract());
});

describe('property settings', () => {
  test('saves edited values', async () => {
    jest.mocked(propertyApi.update).mockResolvedValue(property());
    await renderWithProviders(<PropertySettings />, { properties: [property({ monthlyBudget: 150.5 })] });

    expect(screen.getByDisplayValue('150,5')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Nazwa'), 'Dom');
    await fireEvent.press(screen.getByRole('radio', { name: /12 mies/ }));
    await fireEvent.press(screen.getByRole('button', { name: /Zapisz/ }));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(propertyApi.update).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Dom', billingPeriodMonths: 12, monthlyBudget: 150.5 }));
  });

  test('validates the PPE number and saves it without spaces', async () => {
    jest.mocked(propertyApi.update).mockResolvedValue(property());
    await renderWithProviders(<PropertySettings />);

    await fireEvent.changeText(screen.getByLabelText('Numer PPE (opcjonalnie)'), '590322428100789766');
    expect(screen.getByText(/18 cyfr i cyfrę kontrolną/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^Zapisz$/ }));
    expect(propertyApi.update).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Numer PPE (opcjonalnie)'), '5903 2242 8100 789765');
    await fireEvent.changeText(screen.getByLabelText('Początek okresu rozliczeniowego'), '2026-02-07');
    await fireEvent.press(screen.getByRole('button', { name: /^Zapisz$/ }));
    await waitFor(() => expect(propertyApi.update).toHaveBeenCalledWith('p1', expect.objectContaining({
      ppeCode: '590322428100789765', billingAnchorDate: '2026-02-07',
    })));
  });

  test('deletes the property only after confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    jest.mocked(propertyApi.remove).mockResolvedValue(undefined);
    await renderWithProviders(<PropertySettings />, { properties: [property(), property({ id: 'p2', name: 'Dom' })] });

    alert.mockImplementationOnce((_t, _m, buttons) => buttons?.[0]?.onPress?.()); // "Anuluj"
    await fireEvent.press(screen.getByRole('button', { name: /Usuń nieruchomość/ }));
    await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
    expect(propertyApi.remove).not.toHaveBeenCalled();

    alert.mockImplementationOnce((_t, _m, buttons) => buttons?.[1]?.onPress?.()); // "Usuń"
    await fireEvent.press(screen.getByRole('button', { name: /Usuń nieruchomość/ }));
    await waitFor(() => expect(propertyApi.remove).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(app)/(tabs)/settings'));
  });
});

describe('contract settings', () => {
  test('corrects the start date of a saved contract', async () => {
    jest.mocked(propertyApi.contracts).mockResolvedValue([contract({ validFrom: '2026-10-01' })]);
    jest.mocked(propertyApi.updateContract).mockResolvedValue(contract());
    await renderWithProviders(<ContractSettings />);

    expect(await screen.findByText(/G12 · od/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /Popraw/ }));
    expect(screen.getByDisplayValue('7')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Obowiązuje od'), '2026-02-07');
    await fireEvent.press(screen.getByRole('button', { name: /Zapisz poprawki/ }));

    await waitFor(() => expect(propertyApi.updateContract).toHaveBeenCalledWith('c1', expect.objectContaining({ validFrom: '2026-02-07', contractedPowerKw: 7 })));
    expect(propertyApi.setContract).not.toHaveBeenCalled();
  });

  test('adds a new contract pre-filled from the latest one', async () => {
    jest.mocked(propertyApi.contracts).mockResolvedValue([contract()]);
    jest.mocked(propertyApi.setContract).mockResolvedValue(contract());
    await renderWithProviders(<ContractSettings />);

    await fireEvent.press(await screen.findByRole('button', { name: /Nowa umowa od/ }));
    expect(screen.getByRole('radio', { name: /^.*G12$/ })).toBeSelected();
    await fireEvent.press(screen.getByRole('radio', { name: /^.*G11$/ }));
    await fireEvent.changeText(screen.getByLabelText('Obowiązuje od'), '2026-11-01');
    await fireEvent.press(screen.getByRole('button', { name: /Zapisz umowę/ }));

    await waitFor(() => expect(propertyApi.setContract).toHaveBeenCalledWith('p1', expect.objectContaining({ tariffId: 't11', validFrom: '2026-11-01' })));
  });

  test('deletes a contract after confirmation', async () => {
    jest.spyOn(Alert, 'alert').mockImplementationOnce((_t, _m, buttons) => buttons?.[1]?.onPress?.());
    jest.mocked(propertyApi.contracts).mockResolvedValue([contract()]);
    jest.mocked(propertyApi.removeContract).mockResolvedValue(undefined);
    await renderWithProviders(<ContractSettings />);

    await fireEvent.press(await screen.findByRole('button', { name: /Usuń/ }));
    await waitFor(() => expect(propertyApi.removeContract).toHaveBeenCalledWith('c1'));
  });

  test('without contract shows the form and requires a tariff', async () => {
    jest.mocked(propertyApi.contracts).mockResolvedValue([]);
    await renderWithProviders(<ContractSettings />);

    await fireEvent.press(await screen.findByRole('button', { name: /Zapisz umowę/ }));
    expect(await screen.findByText('Wybierz taryfę.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Anuluj/ })).toBeNull();
  });
});

describe('rate settings', () => {
  test('lists plans and adds a new one, closing the previous open plan', async () => {
    jest.mocked(propertyApi.ratePlans).mockResolvedValue([ratePlan()]);
    jest.mocked(propertyApi.endRatePlan).mockResolvedValue(ratePlan());
    jest.mocked(propertyApi.createRatePlan).mockResolvedValue(ratePlan({ id: 'rp2' }));
    await renderWithProviders(<RatesSettings />);

    expect(await screen.findByText('Moje stawki')).toBeOnTheScreen();
    expect(screen.getByText(/0,5 zł\/kWh \+ 23% VAT/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /Nowe stawki od/ }));
    await fireEvent.changeText(screen.getByLabelText('Obowiązuje od'), '2026-11-01');
    await fireEvent.changeText(screen.getAllByLabelText(/Stawka netto/)[0]!, '0,7');
    await fireEvent.changeText(screen.getByLabelText('Źródło stawek'), 'Nowy cennik');
    await fireEvent.press(screen.getByRole('button', { name: /Zapisz cennik/ }));

    await waitFor(() => expect(propertyApi.createRatePlan).toHaveBeenCalled());
    expect(propertyApi.endRatePlan).toHaveBeenCalledWith('rp1', '2026-10-31');
  });

  test('corrects a saved plan in place, keeping its rates in the form', async () => {
    jest.mocked(propertyApi.ratePlans).mockResolvedValue([ratePlan()]);
    jest.mocked(propertyApi.updateRatePlan).mockResolvedValue(ratePlan());
    await renderWithProviders(<RatesSettings />);

    await fireEvent.press(await screen.findByRole('button', { name: /Popraw/ }));
    expect(screen.getByDisplayValue('0,5')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Obowiązuje od'), '2026-01-01');
    await fireEvent.press(screen.getByRole('button', { name: /Zapisz poprawki/ }));

    await waitFor(() => expect(propertyApi.updateRatePlan).toHaveBeenCalledWith('rp1', expect.objectContaining({
      validFrom: '2026-01-01', components: [expect.objectContaining({ netRate: 0.5, taxRate: 0.23 })],
    })));
    expect(propertyApi.endRatePlan).not.toHaveBeenCalled();
  });

  test('deletes a plan after confirmation', async () => {
    jest.spyOn(Alert, 'alert').mockImplementationOnce((_t, _m, buttons) => buttons?.[1]?.onPress?.());
    jest.mocked(propertyApi.ratePlans).mockResolvedValue([ratePlan()]);
    jest.mocked(propertyApi.removeRatePlan).mockResolvedValue(undefined);
    await renderWithProviders(<RatesSettings />);

    await fireEvent.press(await screen.findByRole('button', { name: /Usuń/ }));
    await waitFor(() => expect(propertyApi.removeRatePlan).toHaveBeenCalledWith('rp1'));
  });

  test('without contract explains that a tariff is needed', async () => {
    jest.mocked(propertyApi.contract).mockRejectedValue(new ApiError(404, 'Brak'));
    jest.mocked(propertyApi.ratePlans).mockResolvedValue([]);
    await renderWithProviders(<RatesSettings />);

    expect(await screen.findByText('Brak umowy')).toBeOnTheScreen();
  });

  test('warns when there are no rates', async () => {
    jest.mocked(propertyApi.ratePlans).mockResolvedValue([]);
    await renderWithProviders(<RatesSettings />);
    expect(await screen.findByText(/Brak stawek – koszty nie będą liczone/)).toBeOnTheScreen();
  });
});

describe('meter settings', () => {
  test('lists meters and adds a bidirectional meter with tariff zones', async () => {
    jest.mocked(meterApi.list).mockResolvedValue([meter()]);
    jest.mocked(meterApi.create).mockResolvedValue(meter({ id: 'm2' }));
    await renderWithProviders(<MetersSettings />);

    expect(await screen.findByText('Licznik główny')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /Dodaj licznik/ }));
    await fireEvent.press(screen.getByRole('radio', { name: /Dwukierunkowy/ }));
    await screen.findByText(/stref taryfy G12/);
    await fireEvent.press(screen.getAllByRole('button', { name: /Dodaj licznik/ })[0]!);

    await waitFor(() => expect(meterApi.create).toHaveBeenCalledWith('p1', expect.objectContaining({
      directionality: 'Bidirectional',
      registers: [
        expect.objectContaining({ zoneCode: 'DAY' }),
        expect.objectContaining({ zoneCode: 'NIGHT' }),
        expect.objectContaining({ registerType: 'Export' }),
      ],
    })));
  });

  test('cancel hides the form', async () => {
    jest.mocked(meterApi.list).mockResolvedValue([]);
    await renderWithProviders(<MetersSettings />);
    await fireEvent.press(await screen.findByRole('button', { name: /Dodaj licznik/ }));
    await fireEvent.press(screen.getByRole('button', { name: /Anuluj/ }));
    expect(screen.queryByLabelText('Numer licznika (opcjonalnie)')).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });
});
