/** Tests of the configuration screens: property, contract, rates and meters. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

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

  test('shows local validation errors', async () => {
    await renderWithProviders(<PropertySettings />);
    await fireEvent.changeText(screen.getByLabelText('Początek okresu rozliczeniowego'), 'zła');
    await fireEvent.press(screen.getByRole('button', { name: /Zapisz/ }));

    expect(await screen.findByText('Podaj datę w formacie RRRR-MM-DD.')).toBeOnTheScreen();
    expect(propertyApi.update).not.toHaveBeenCalled();
  });
});

describe('contract settings', () => {
  test('is prefilled from the current contract and saves changes', async () => {
    jest.mocked(propertyApi.setContract).mockResolvedValue(contract());
    await renderWithProviders(<ContractSettings />);

    expect(await screen.findByDisplayValue('7')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: /^.*G12$/ })).toBeSelected();
    await fireEvent.press(screen.getByRole('radio', { name: /^.*G11$/ }));
    await fireEvent.press(screen.getByRole('button', { name: /Zapisz umowę/ }));

    await waitFor(() => expect(propertyApi.setContract).toHaveBeenCalledWith('p1', expect.objectContaining({ tariffId: 't11', contractedPowerKw: 7 })));
  });

  test('without contract requires a tariff', async () => {
    jest.mocked(propertyApi.contract).mockRejectedValue(new ApiError(404, 'Brak'));
    await renderWithProviders(<ContractSettings />);

    await fireEvent.press(await screen.findByRole('button', { name: /Zapisz umowę/ }));
    expect(await screen.findByText('Wybierz taryfę.')).toBeOnTheScreen();
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

    await fireEvent.press(screen.getByRole('button', { name: /Dodaj nowe stawki/ }));
    await fireEvent.changeText(screen.getByLabelText('Obowiązuje od'), '2026-11-01');
    await fireEvent.changeText(screen.getAllByLabelText(/Stawka netto/)[0]!, '0,7');
    await fireEvent.changeText(screen.getByLabelText('Źródło stawek'), 'Nowy cennik');
    await fireEvent.press(screen.getByRole('button', { name: /Zapisz cennik/ }));

    await waitFor(() => expect(propertyApi.createRatePlan).toHaveBeenCalled());
    expect(propertyApi.endRatePlan).toHaveBeenCalledWith('rp1', '2026-10-31');
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
