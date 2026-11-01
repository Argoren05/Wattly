/** Tests of Settings → Przypomnienia. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

import RemindersSettings from '../../app/(app)/settings/reminders';
import { REMINDERS_KEY } from '../../reminders/reminders';
import { renderWithProviders } from '../../test/render';

jest.mock('../../api/endpoints');

const saved = () => JSON.parse((SecureStore as unknown as { __store: Map<string, string> }).__store.get(REMINDERS_KEY) ?? 'null');

test('turns on daily reminders at a chosen time on chosen days', async () => {
  await renderWithProviders(<RemindersSettings />);

  await fireEvent.press(await screen.findByRole('radio', { name: /Codziennie/ }));
  await fireEvent.changeText(screen.getByLabelText('Godzina'), '21:30');
  await fireEvent.press(screen.getByRole('checkbox', { name: 'So' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Nd' }));
  expect(screen.getByText(/Pn, Wt, Śr, Cz, Pt o 21:30/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: /Zapisz/ }));

  await waitFor(() => expect(router.back).toHaveBeenCalled());
  expect(saved()).toMatchObject({ frequency: 'daily', time: '21:30', weekdays: [1, 2, 3, 4, 5], skipWhenRead: true });
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
});

test('requires a weekday and explains a blocked permission', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false, canAskAgain: false } as never);
  await renderWithProviders(<RemindersSettings />);

  await fireEvent.press(await screen.findByRole('radio', { name: /Codziennie/ }));
  for (const day of ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']) await fireEvent.press(screen.getByRole('checkbox', { name: day }));
  await fireEvent.press(screen.getByRole('button', { name: /Zapisz/ }));
  expect(await screen.findByText('Wybierz co najmniej jeden dzień tygodnia.')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('radio', { name: /Co miesiąc/ }));
  await fireEvent.press(screen.getByRole('button', { name: /Zapisz/ }));
  expect(await screen.findByText(/wyłączone w ustawieniach telefonu/)).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: /Otwórz ustawienia telefonu/ })).toBeOnTheScreen();
  expect(router.back).not.toHaveBeenCalled();
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: true } as never);
});
