/** Tests of the main tab screens: dashboard, readings, statistics, invoices and settings. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import Dashboard from '../../app/(app)/(tabs)/index';
import Invoices from '../../app/(app)/(tabs)/invoices';
import Readings from '../../app/(app)/(tabs)/readings';
import Settings from '../../app/(app)/(tabs)/settings';
import Stats from '../../app/(app)/(tabs)/stats';
import { analyticsApi, authApi, invoiceApi, meterApi, readingApi } from '../../api/endpoints';
import { forecast, invoice, meter, property, reading, series } from '../../test/fixtures';
import { renderWithProviders } from '../../test/render';

jest.mock('../../api/endpoints');

describe('dashboard', () => {
  beforeEach(() => jest.mocked(analyticsApi.consumption).mockResolvedValue(series()));

  test('shows forecast, consumption, budget warning and chart', async () => {
    jest.mocked(analyticsApi.forecast).mockResolvedValue(forecast());
    await renderWithProviders(<Dashboard />);

    expect(await screen.findByText('Prognoza rachunku')).toBeOnTheScreen();
    expect(screen.getByText(/427,63/)).toBeOnTheScreen();
    expect(screen.getByText(/410,0\s?kWh/)).toBeOnTheScreen();
    expect(screen.getByText('Prognoza zbliża się do budżetu lub go przekracza.')).toBeOnTheScreen();
    expect(await screen.findByText('Na podstawie odczytów')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /Dodaj odczyt/ }));
    await fireEvent.press(screen.getByRole('button', { name: /Rozbicie kosztów/ }));
    expect(router.push).toHaveBeenCalledWith('/reading/new');
    expect(router.push).toHaveBeenCalledWith('/breakdown');

    await fireEvent.press(screen.getByRole('button', { name: /Pokaż założenia/ }));
    expect(screen.getByText(/Prognoza zakłada średnie zużycie/)).toBeOnTheScreen();
  });

  test('without readings invites to add the first reading', async () => {
    jest.mocked(analyticsApi.forecast).mockResolvedValue(forecast({ readingsCount: 0 }));
    await renderWithProviders(<Dashboard />);

    expect(await screen.findByText('Brak odczytów')).toBeOnTheScreen();
  });

  test('with one reading shows placeholders instead of misleading zeros', async () => {
    jest.mocked(analyticsApi.forecast).mockResolvedValue(forecast({ readingsCount: 2, isComplete: false, forecastConsumptionKwh: 0, forecastCostGross: 0 }));
    jest.mocked(analyticsApi.consumption).mockResolvedValue(series({ points: [{ periodStart: '2026-10-01', periodEnd: '2026-10-01', consumptionKwh: null, costGross: null, isEstimate: false, isPartial: true }] }));
    await renderWithProviders(<Dashboard />);

    expect(await screen.findByText('Potrzebny kolejny odczyt')).toBeOnTheScreen();
    expect(screen.queryByText(/0,00\s?zł/)).toBeNull();
    expect(await screen.findByText(/Za mało odczytów, aby pokazać wykres/)).toBeOnTheScreen();
  });

  test('missing contract or rates link to settings', async () => {
    jest.mocked(analyticsApi.forecast).mockResolvedValueOnce(forecast({ hasContract: false }));
    await renderWithProviders(<Dashboard />);
    await fireEvent.press(await screen.findByRole('button', { name: /Skonfiguruj umowę/ }));
    expect(router.push).toHaveBeenCalledWith('/settings/contract');

    jest.mocked(analyticsApi.forecast).mockResolvedValueOnce(forecast({ hasRatePlans: false }));
    await renderWithProviders(<Dashboard />);
    await fireEvent.press(await screen.findByRole('button', { name: /Wprowadź stawki/ }));
    expect(router.push).toHaveBeenCalledWith('/settings/rates');
  });

  test('load error offers retry', async () => {
    jest.mocked(analyticsApi.forecast).mockRejectedValue(new Error('x'));
    await renderWithProviders(<Dashboard />);
    expect(await screen.findByText('Nie udało się wczytać danych')).toBeOnTheScreen();
  });
});

describe('readings', () => {
  test('lists readings with consumption, source and status, and switches registers', async () => {
    jest.mocked(meterApi.list).mockResolvedValue([meter()]);
    jest.mocked(readingApi.list).mockResolvedValue({
      items: [reading(), reading({ id: 'old', status: 'Superseded', consumptionSincePrevious: null, daysSincePrevious: null })], page: 1, pageSize: 50, totalCount: 2,
    });
    await renderWithProviders(<Readings />);

    expect(await screen.findByText(/\+100,0\s?kWh/)).toBeOnTheScreen();
    expect(screen.getByText(/Skorygowany/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: /Noc/ }));
    await waitFor(() => expect(readingApi.list).toHaveBeenCalledWith('rNight', 1, false));
    await fireEvent.press(screen.getByRole('radio', { name: /Z historią zmian/ }));
    await waitFor(() => expect(readingApi.list).toHaveBeenCalledWith('rNight', 1, true));

    await fireEvent.press(screen.getAllByRole('button', { name: /Odczyt/ })[0]!);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/reading/[id]', params: { id: 'read1' } });
  });

  test('without meter points to meter settings; empty register shows empty state', async () => {
    jest.mocked(meterApi.list).mockResolvedValueOnce([]);
    await renderWithProviders(<Readings />);
    await fireEvent.press(await screen.findByRole('button', { name: /Ustawienia liczników/ }));
    expect(router.push).toHaveBeenCalledWith('/settings/meters');

    jest.mocked(meterApi.list).mockResolvedValue([meter()]);
    jest.mocked(readingApi.list).mockResolvedValue({ items: [], page: 1, pageSize: 50, totalCount: 0 });
    await renderWithProviders(<Readings />);
    expect(await screen.findByText('Brak odczytów')).toBeOnTheScreen();
  });
});

describe('statistics', () => {
  test('shows consumption by default and compares with the previous period', async () => {
    jest.mocked(analyticsApi.consumption).mockResolvedValueOnce(series({ totalConsumptionKwh: 120 })).mockResolvedValue(series({ totalConsumptionKwh: 100 }));
    await renderWithProviders(<Stats />);

    expect(await screen.findByText('Porównanie okresów')).toBeOnTheScreen();
    expect(await screen.findByText('+20%')).toBeOnTheScreen();
    expect(analyticsApi.consumption).toHaveBeenCalledWith('p1', expect.any(String), expect.any(String), 'Month');
  });

  test('switches to costs and other granularity', async () => {
    jest.mocked(analyticsApi.consumption).mockResolvedValue(series());
    jest.mocked(analyticsApi.costs).mockResolvedValue(series({ totalCostGross: 50 }));
    await renderWithProviders(<Stats />);

    await fireEvent.press(screen.getByRole('radio', { name: /Koszt/ }));
    await fireEvent.press(screen.getByRole('radio', { name: /Dziennie/ }));

    await waitFor(() => expect(analyticsApi.costs).toHaveBeenCalledWith('p1', expect.any(String), expect.any(String), 'Day'));
    expect(await screen.findByText('Szacowany koszt')).toBeOnTheScreen();
    expect(screen.getByText('Założenia')).toBeOnTheScreen();
  });
});

describe('invoices', () => {
  test('lists invoices with comparison and opens details', async () => {
    jest.mocked(invoiceApi.list).mockResolvedValue([invoice(), invoice({ id: 'i2', invoiceNumber: 'FV/2', comparison: null })]);
    await renderWithProviders(<Invoices />);

    expect(await screen.findByText('FV/1/2026')).toBeOnTheScreen();
    expect(screen.getByText(/Szacunek Wattly/)).toBeOnTheScreen();
    expect(screen.getByText('Brak danych do porównania')).toBeOnTheScreen();

    await fireEvent.press(screen.getAllByRole('button', { name: /FV\/1\/2026/ })[0]!);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/invoice/[id]', params: { id: 'i1' } });
  });

  test('empty list invites to add an invoice', async () => {
    jest.mocked(invoiceApi.list).mockResolvedValue([]);
    await renderWithProviders(<Invoices />);

    await fireEvent.press(await screen.findByRole('button', { name: /Dodaj fakturę/ }));
    expect(router.push).toHaveBeenCalledWith('/invoice/new');
  });
});

describe('settings', () => {
  test('shows account, app version and navigation to configuration', async () => {
    jest.mocked(authApi.me).mockResolvedValue({ id: 'u', email: 'jan@example.com', roles: [] });
    await renderWithProviders(<Settings />, { properties: [property(), property({ id: 'p2', name: 'Dom' })] });

    expect(await screen.findByText('jan@example.com')).toBeOnTheScreen();
    expect(screen.getByText('Wersja 1.0.0')).toBeOnTheScreen();
    expect(screen.getByText(/wyłączone w tej wersji/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Sprawdź aktualizacje/ })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: /Stawki/ }));
    expect(router.push).toHaveBeenCalledWith('/settings/rates');

    await fireEvent.press(screen.getByRole('radio', { name: /Dom/ }));
    expect(screen.getByRole('radio', { name: /Dom/ })).toBeSelected();
  });

  test('sign out returns to the login screen', async () => {
    jest.mocked(authApi.me).mockResolvedValue({ id: 'u', email: 'jan@example.com', roles: [] });
    jest.mocked(authApi.logout).mockResolvedValue(undefined);
    await renderWithProviders(<Settings />);

    await fireEvent.press(await screen.findByRole('button', { name: /Wyloguj/ }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  });

  test('offers restart when an update is downloaded', async () => {
    const reloadAsync = jest.fn(async () => undefined);
    jest.mocked(authApi.me).mockResolvedValue({ id: 'u', email: null, roles: [] });
    await renderWithProviders(<Settings />, {
      updates: {
        updates: { isEnabled: true, checkForUpdateAsync: async () => ({ isAvailable: true }), fetchUpdateAsync: async () => ({ isNew: true }), reloadAsync },
        installedVersion: null,
      },
    });

    await fireEvent.press(await screen.findByRole('button', { name: /Uruchom ponownie/ }));
    expect(reloadAsync).toHaveBeenCalled();
  });
});
