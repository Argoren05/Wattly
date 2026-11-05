/** Tests of the notification screens: settings list, reminder editor, history and the header bell. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';

import NotificationHistory from '../../app/(app)/notifications';
import ReminderEditor from '../../app/(app)/settings/reminder';
import NotificationSettings from '../../app/(app)/settings/reminders';
import { NotificationBell } from '../../components/NotificationBell';
import { PREFS_KEY, REMINDERS_KEY, STORE } from '../../reminders/center';
import { DEFAULT_REMINDERS } from '../../reminders/schedule';
import { renderWithProviders } from '../../test/render';

jest.mock('../../api/endpoints');

const secure = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const savedReminders = () => JSON.parse(secure.get(REMINDERS_KEY) ?? '[]') as { id: string; label: string; enabled: boolean; time: string; weekdays: number[] }[];
const daily = { ...DEFAULT_REMINDERS, frequency: 'daily', id: 'r1', label: '', enabled: true };

beforeEach(async () => {
  await AsyncStorage.clear();
});

/** Renders a screen after seeding device settings (renderWithProviders clears secure storage first). */
async function renderWith(ui: React.ReactElement, seed: Record<string, string> = {}) {
  const original = jest.mocked(SecureStore.getItemAsync).getMockImplementation()!;
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key: string) => seed[key] ?? secure.get(key) ?? null);
  await renderWithProviders(ui);
  for (const [key, value] of Object.entries(seed)) secure.set(key, value);
  jest.mocked(SecureStore.getItemAsync).mockImplementation(original);
}

describe('notification settings', () => {
  test('lists reminders, switches one off, deletes one and opens the editor', async () => {
    jest.spyOn(Alert, 'alert').mockImplementationOnce((_t, _m, buttons) => buttons?.[1]?.onPress?.());
    await renderWith(<NotificationSettings />, {
      [REMINDERS_KEY]: JSON.stringify([daily, { ...daily, id: 'r2', frequency: 'monthly', dayOfMonth: 1, label: 'Spisz licznik do faktury' }]),
    });

    expect(await screen.findByText('Codziennie o 22:00')).toBeOnTheScreen();
    expect(screen.getByText('Spisz licznik do faktury')).toBeOnTheScreen();

    await fireEvent(screen.getByLabelText('Odczyt licznika'), 'valueChange', false);
    await waitFor(() => expect(savedReminders().find((r) => r.id === 'r1')?.enabled).toBe(false));

    await fireEvent.press(screen.getAllByRole('button', { name: /Usuń/ })[1]!);
    await waitFor(() => expect(savedReminders().map((r) => r.id)).toEqual(['r1']));

    await fireEvent.press(screen.getByRole('button', { name: /Dodaj przypomnienie/ }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/settings/reminder', params: { id: 'new' } });
  });

  test('switches other kinds of notifications and the payment advance', async () => {
    await renderWith(<NotificationSettings />);

    await fireEvent(await screen.findByLabelText('Prognoza przekracza budżet'), 'valueChange', false);
    await waitFor(() => expect(JSON.parse(secure.get(PREFS_KEY)!)).toMatchObject({ budget: false }));
    await fireEvent.press(await screen.findByRole('radio', { name: /7 dni przed/ }));
    await waitFor(() => expect(JSON.parse(secure.get(PREFS_KEY)!)).toMatchObject({ paymentDaysBefore: 7 }));
  });
});

test('the editor adds a reminder with its own text', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'new' });
  await renderWith(<ReminderEditor />, { [REMINDERS_KEY]: JSON.stringify([daily]) });

  await fireEvent.press(await screen.findByRole('radio', { name: /Co miesiąc/ }));
  await fireEvent.changeText(screen.getByLabelText('Dzień miesiąca (1–28)'), '5');
  await fireEvent.changeText(screen.getByLabelText('Godzina'), '09:00');
  await fireEvent.changeText(screen.getByLabelText('Własna treść (opcjonalnie)'), 'Spisz licznik do faktury');
  await fireEvent.press(screen.getByRole('button', { name: /Dodaj przypomnienie/ }));

  await waitFor(() => expect(router.back).toHaveBeenCalled());
  expect(savedReminders()).toEqual([
    expect.objectContaining({ id: 'r1' }),
    expect.objectContaining({ label: 'Spisz licznik do faktury', time: '09:00' }),
  ]);
  jest.mocked(useLocalSearchParams).mockReturnValue({});
});

describe('history and bell', () => {
  const entries = [
    { id: 'budget:1', kind: 'budget', title: 'Prognoza przekracza budżet', body: 'Mieszkanie: …', at: '2026-11-02T08:00:00Z', url: '/', read: false },
    { id: 'reading:r1:1', kind: 'reading', title: 'Czas na odczyt licznika', body: 'Spisz…', at: '2026-11-01T21:00:00Z', url: '/reading/new', read: true },
  ];

  test('shows entries newest first, opens one and marks all read', async () => {
    await AsyncStorage.setItem(STORE.log, JSON.stringify(entries));
    await renderWithProviders(<NotificationHistory />);

    expect(await screen.findByRole('button', { name: 'Nieprzeczytane: Prognoza przekracza budżet' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Czas na odczyt licznika' }));
    expect(router.push).toHaveBeenCalledWith('/reading/new');

    await fireEvent.press(screen.getByRole('button', { name: /Oznacz jako przeczytane/ }));
    await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem(STORE.log))!).every((e: { read: boolean }) => e.read)).toBe(true));
  });

  test('empty history and the bell with the unread count', async () => {
    await renderWithProviders(<NotificationHistory />);
    expect(await screen.findByText('Brak powiadomień')).toBeOnTheScreen();

    await AsyncStorage.setItem(STORE.log, JSON.stringify(entries));
    await renderWithProviders(<NotificationBell />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Powiadomienia, nieprzeczytane: 1' }));
    expect(router.push).toHaveBeenCalledWith('/notifications');
  });
});
