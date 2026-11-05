import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

import { ensurePermission, LAST_READING_KEY, recordReadingForReminders, REMINDERS_KEY, rescheduleReminders, saveReminderSettings } from './reminders';
import { DEFAULT_REMINDERS } from './schedule';

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const NOW = new Date(2026, 10, 1, 10, 0);

beforeEach(() => store.clear());

test('saving settings asks for permission and plans one notification per day of the horizon', async () => {
  const permission = await saveReminderSettings({ ...DEFAULT_REMINDERS, frequency: 'daily' });

  expect(permission).toBe('granted');
  expect(JSON.parse(store.get(REMINDERS_KEY)!)).toMatchObject({ frequency: 'daily', time: '22:00' });
  expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
  const first = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls[0]![0];
  expect(first.content).toMatchObject({ title: 'Czas na odczyt licznika', data: { url: '/reading/new' } });
  expect(first.trigger).toMatchObject({ type: 'date', channelId: 'reading-reminders' });
});

test('turning reminders off cancels them without asking for permission', async () => {
  await saveReminderSettings(DEFAULT_REMINDERS);
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test('permission states', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({ granted: false, canAskAgain: true } as never);
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValueOnce({ granted: false, canAskAgain: true } as never);
  await expect(ensurePermission()).resolves.toBe('denied');

  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
  await expect(ensurePermission()).resolves.toBe('blocked');
});

test('a reading saved today removes today’s reminder; back-dated readings do not move the marker', async () => {
  store.set(REMINDERS_KEY, JSON.stringify({ ...DEFAULT_REMINDERS, frequency: 'daily' }));
  expect(await rescheduleReminders(NOW)).toBe(36); // today 22:00 + 35 days

  await recordReadingForReminders(new Date());
  const marker = store.get(LAST_READING_KEY)!;
  await recordReadingForReminders(new Date(2026, 1, 1));
  expect(store.get(LAST_READING_KEY)).toBe(marker);

  store.set(LAST_READING_KEY, new Date(2026, 10, 1, 9, 0).toISOString());
  expect(await rescheduleReminders(NOW)).toBe(35);
});
