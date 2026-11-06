/** Tests of the appliance screens: list with Tapo account and plugs, appliance details and "Na co schodzi prąd". */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import AppliancesBreakdown, { rangeDates } from '../../app/(app)/appliances';
import ApplianceDetails from '../../app/(app)/settings/appliance';
import AppliancesSettings from '../../app/(app)/settings/appliances';
import { applianceApi } from '../../api/endpoints';
import type { Appliance, ApplianceBreakdown } from '../../api/types';
import { TapoError } from '../../tapo/client';
import * as sync from '../../tapo/sync';
import { renderWithProviders } from '../../test/render';

jest.mock('../../api/endpoints');
jest.mock('../../tapo/sync', () => ({
  linkPlug: jest.fn(),
  syncAll: jest.fn(async () => null),
  loadAccount: jest.fn(async () => null),
  saveAccount: jest.fn(async () => undefined),
  loadPlugs: jest.fn(async () => ({})),
  savePlug: jest.fn(async () => undefined),
  loadSyncState: jest.fn(async () => null),
}));

/** Sample appliance. */
function appliance(overrides: Partial<Appliance> = {}): Appliance {
  return {
    id: 'a1', propertyId: 'p1', name: 'Pralka', source: 'Tapo', externalId: 'DEV1', model: 'P110',
    isHidden: false, lastUsageDate: '2026-11-04', createdAt: '2026-11-01T10:00:00Z', ...overrides,
  };
}

beforeEach(() => {
  jest.mocked(applianceApi.list).mockResolvedValue([appliance(), appliance({ id: 'a2', name: 'Lodówka', source: 'Manual', externalId: null, model: null, lastUsageDate: null })]);
  jest.mocked(applianceApi.usage).mockResolvedValue([]);
});

describe('appliance list', () => {
  test('shows appliances; adding a plug needs the Tapo account first', async () => {
    jest.mocked(sync.loadPlugs).mockResolvedValue({ a1: { host: '192.168.1.50' } });
    await renderWithProviders(<AppliancesSettings />);

    expect(await screen.findByText('Pralka')).toBeOnTheScreen();
    expect(screen.getByText(/Tapo P110 · 192\.168\.1\.50/)).toBeOnTheScreen();
    expect(screen.getByText('Wpisywane ręcznie')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Dodaj gniazdko Tapo/ })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: /Podaj konto Tapo/ }));
    await fireEvent.changeText(screen.getByLabelText('E-mail konta Tapo'), 'jan@example.com');
    await fireEvent.changeText(screen.getByLabelText('Hasło konta Tapo'), 'Haslo123!');
    jest.mocked(sync.loadAccount).mockResolvedValue({ email: 'jan@example.com', password: 'Haslo123!' });
    await fireEvent.press(screen.getByRole('button', { name: /Zapisz konto/ }));

    await waitFor(() => expect(sync.saveAccount).toHaveBeenCalledWith({ email: 'jan@example.com', password: 'Haslo123!' }));
    expect(await screen.findByText('jan@example.com')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Dodaj gniazdko Tapo/ })).toBeEnabled();
  });

  test('links a plug by IP address and shows friendly connection errors', async () => {
    jest.mocked(sync.loadAccount).mockResolvedValue({ email: 'jan@example.com', password: 'x' });
    jest.mocked(sync.linkPlug)
      .mockRejectedValueOnce(new TapoError('credentials', '403'))
      .mockResolvedValueOnce({ appliance: appliance(), created: true });
    await renderWithProviders(<AppliancesSettings />);

    await fireEvent.press(await screen.findByRole('button', { name: /Dodaj gniazdko Tapo/ }));
    await fireEvent.changeText(screen.getByLabelText('Adres IP gniazdka'), '192.168.1');
    expect(screen.getByText(/192\.168\.1\.50\./)).toBeOnTheScreen(); // format hint as error
    expect(screen.getByRole('button', { name: /Połącz i dodaj/ })).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Adres IP gniazdka'), '192.168.1.60');
    await fireEvent.press(screen.getByRole('button', { name: /Połącz i dodaj/ }));
    expect(await screen.findByText(/sprawdź e-mail i hasło/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /Połącz i dodaj/ }));
    await waitFor(() => expect(sync.syncAll).toHaveBeenCalled());
    expect(sync.linkPlug).toHaveBeenLastCalledWith('p1', '192.168.1.60', { email: 'jan@example.com', password: 'x' });
  });

  test('syncs on demand and lists the result per plug', async () => {
    jest.mocked(sync.loadPlugs).mockResolvedValue({ a1: { host: '192.168.1.50' } });
    jest.mocked(sync.syncAll).mockResolvedValueOnce({
      at: '2026-11-05T20:00:00Z',
      results: [{ applianceId: 'a1', ok: false, days: 0, error: 'Brak połączenia z gniazdkiem' }],
    });
    await renderWithProviders(<AppliancesSettings />);

    await fireEvent.press(await screen.findByRole('button', { name: /Synchronizuj teraz/ }));
    expect(await screen.findByText('Brak połączenia z gniazdkiem')).toBeOnTheScreen();
  });

  test('adds a manual appliance and opens it', async () => {
    jest.mocked(applianceApi.create).mockResolvedValue(appliance({ id: 'a3', name: 'Lodówka', source: 'Manual' }));
    await renderWithProviders(<AppliancesSettings />);

    await fireEvent.press(await screen.findByRole('button', { name: /Dodaj urządzenie ręcznie/ }));
    await fireEvent.changeText(screen.getByLabelText('Nazwa'), ' Lodówka ');
    await fireEvent.press(screen.getByRole('button', { name: /^Dodaj$/ }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith({ pathname: '/settings/appliance', params: { id: 'a3' } }));
    expect(applianceApi.create).toHaveBeenCalledWith('p1', { name: 'Lodówka', source: 'Manual' });
  });
});

describe('appliance details', () => {
  beforeEach(() => jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'a2' }));

  test('saves consumption of a period and removes an entry', async () => {
    jest.mocked(applianceApi.usage).mockResolvedValue([{ id: 'u1', periodStart: '2026-10-01', periodEnd: '2026-10-31', energyKwh: 24.5 }]);
    jest.mocked(applianceApi.saveUsage).mockResolvedValue({ created: 1, updated: 0 });
    jest.mocked(applianceApi.removeUsage).mockResolvedValue(undefined);
    await renderWithProviders(<ApplianceDetails />);

    expect(await screen.findByText('24,50 kWh')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Od'), '2026-09-01');
    await fireEvent.changeText(screen.getByLabelText('Do (włącznie)'), '2026-09-30');
    await fireEvent.changeText(screen.getByLabelText('Zużycie (kWh)'), '22,3');
    await fireEvent.press(screen.getByRole('button', { name: /Zapisz zużycie/ }));
    await waitFor(() => expect(applianceApi.saveUsage).toHaveBeenCalledWith('a2', [{ periodStart: '2026-09-01', periodEnd: '2026-09-30', energyKwh: 22.3 }]));

    await fireEvent.press(screen.getByRole('button', { name: /^Usuń$/ }));
    await waitFor(() => expect(applianceApi.removeUsage).toHaveBeenCalledWith('a2', 'u1'));
  });

  test('renames, hides and deletes after confirmation (forgetting the plug address)', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'a1' });
    jest.mocked(applianceApi.update).mockResolvedValue(appliance());
    jest.mocked(applianceApi.remove).mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, 'alert').mockImplementationOnce((_t, _m, buttons) => buttons?.[1]?.onPress?.());
    await renderWithProviders(<ApplianceDetails />);

    expect(await screen.findByText('Gniazdko Tapo')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Nazwa'), 'Pralka Bosch');
    await fireEvent(screen.getByLabelText('Ukryj w zestawieniu'), 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: /^Zapisz$/ }));
    await waitFor(() => expect(applianceApi.update).toHaveBeenCalledWith('a1', expect.objectContaining({ name: 'Pralka Bosch', isHidden: true, source: 'Tapo', externalId: 'DEV1' })));

    await fireEvent.press(screen.getByRole('button', { name: /Usuń urządzenie/ }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(alert).toHaveBeenCalled();
    expect(applianceApi.remove).toHaveBeenCalledWith('a1');
    expect(sync.savePlug).toHaveBeenCalledWith('a1', null);
  });
});

describe('what uses the electricity', () => {
  const data: ApplianceBreakdown = {
    from: '2026-10-07', to: '2026-11-05', days: 30, meterKwh: 250, meterIsEstimate: false, pricePerKwhGross: 0.5166, currencyCode: 'PLN',
    items: [
      { applianceId: 'a1', name: 'Pralka', energyKwh: 36, costGross: 18.6, sharePercent: 14.4, coveredDays: 30 },
      { applianceId: 'a2', name: 'Lodówka', energyKwh: 15, costGross: 7.75, sharePercent: 6, coveredDays: 10 },
    ],
    other: { applianceId: null, name: 'Pozostałe', energyKwh: 199, costGross: 102.8, sharePercent: 79.6, coveredDays: 30 },
    appliancesExceedMeter: false,
  };

  test('ranges end yesterday', () => {
    const today = new Date(2026, 10, 5);
    expect(rangeDates('days30', today)).toEqual(['2026-10-06', '2026-11-04']);
    expect(rangeDates('days90', today)).toEqual(['2026-08-07', '2026-11-04']);
    expect(rangeDates('lastMonth', today)).toEqual(['2026-10-01', '2026-10-31']);
  });

  test('shows appliances, the rest and partial coverage', async () => {
    jest.mocked(applianceApi.breakdown).mockResolvedValue(data);
    await renderWithProviders(<AppliancesBreakdown />);

    expect(await screen.findByText('Pralka')).toBeOnTheScreen();
    expect(screen.getByText(/36,0 kWh · ≈ 18,60 zł · 14,4/)).toBeOnTheScreen();
    expect(screen.getByText('Pozostałe')).toBeOnTheScreen();
    expect(screen.getByText('Dane z 10 z 30 dni')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: /Poprzedni miesiąc/ }));
    await waitFor(() => expect(applianceApi.breakdown).toHaveBeenLastCalledWith('p1', expect.stringMatching(/-01$/), expect.any(String)));
  });

  test('without appliances points to the setup; without readings warns', async () => {
    jest.mocked(applianceApi.breakdown).mockResolvedValueOnce({ ...data, items: [], other: null });
    await renderWithProviders(<AppliancesBreakdown />);
    await fireEvent.press(await screen.findByRole('button', { name: /Urządzenia/ }));
    expect(router.push).toHaveBeenCalledWith('/settings/appliances');

    jest.mocked(applianceApi.breakdown).mockResolvedValueOnce({ ...data, meterKwh: null, other: null, appliancesExceedMeter: true });
    await renderWithProviders(<AppliancesBreakdown />);
    expect(await screen.findByText(/Brak odczytów licznika/)).toBeOnTheScreen();
    expect(screen.getByText(/zużyły więcej niż pokazuje licznik/)).toBeOnTheScreen();
  });
});
