/** Tests of the update banners and the blocking "update required" screen. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { MobileRelease } from '../api/types';
import { useAppUpdates, type AppUpdatesState } from '../updates/UpdateContext';
import { UpdateGate } from './UpdateBanner';

jest.mock('../updates/UpdateContext', () => ({ useAppUpdates: jest.fn() }));

const release = (o: Partial<MobileRelease> = {}): MobileRelease => ({
  platform: 'android', currentVersion: '1.0.0', latestVersion: '1.2.0', minimumVersion: '1.0.0', downloadUrl: 'https://x/app.apk',
  releaseNotes: 'Nowe funkcje', updateAvailable: true, updateRequired: false, ...o,
});

function state(o: Partial<AppUpdatesState> = {}): AppUpdatesState {
  return {
    ota: 'upToDate', release: null, releaseDismissed: false,
    restart: jest.fn(async () => undefined), dismissRelease: jest.fn(), openDownload: jest.fn(async () => undefined), checkNow: jest.fn(async () => undefined),
    ...o,
  };
}

const renderGate = (s: AppUpdatesState) => {
  jest.mocked(useAppUpdates).mockReturnValue(s);
  return render(<UpdateGate><Text>Treść aplikacji</Text></UpdateGate>);
};

test('shows only the app when everything is up to date', async () => {
  await renderGate(state());

  expect(screen.getByText('Treść aplikacji')).toBeOnTheScreen();
  expect(screen.queryByText(/Nowa wersja/)).toBeNull();
});

test('offers a restart after an OTA download', async () => {
  const s = state({ ota: 'ready' });
  await renderGate(s);

  await fireEvent.press(screen.getByRole('button', { name: /Uruchom ponownie/ }));

  expect(screen.getByText('Nowa wersja aplikacji jest gotowa')).toBeOnTheScreen();
  expect(s.restart).toHaveBeenCalled();
});

test('optional installer update can be downloaded or postponed', async () => {
  const s = state({ release: release() });
  await renderGate(s);

  await fireEvent.press(screen.getByRole('button', { name: /Pobierz instalator/ }));
  await fireEvent.press(screen.getByRole('button', { name: /Później/ }));

  expect(screen.getByText('Dostępna wersja 1.2.0')).toBeOnTheScreen();
  expect(s.openDownload).toHaveBeenCalled();
  expect(s.dismissRelease).toHaveBeenCalled();
  expect(screen.getByText('Treść aplikacji')).toBeOnTheScreen();
});

test('dismissed banner is hidden', async () => {
  await renderGate(state({ release: release(), releaseDismissed: true }));
  expect(screen.queryByText('Dostępna wersja 1.2.0')).toBeNull();
});

test('required update blocks the app', async () => {
  const s = state({ release: release({ updateRequired: true, currentVersion: '0.9.0' }) });
  await renderGate(s);

  expect(screen.getByText('Wymagana aktualizacja')).toBeOnTheScreen();
  expect(screen.queryByText('Treść aplikacji')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /Pobierz aktualizację/ }));
  expect(s.openDownload).toHaveBeenCalled();
});

test('required update without link points to the store', async () => {
  await renderGate(state({ release: release({ updateRequired: true, downloadUrl: null }) }));
  expect(screen.getByText('Pobierz nową wersję ze sklepu z aplikacjami.')).toBeOnTheScreen();
});
