import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

import { forecast, invoice, reading } from '../test/fixtures';
import {
  checkBudget, clearLog, deliverDue, LAST_READING_KEY, loadLog, markRead, notifyNow, PREFS_KEY, recordReadingForReminders, REMINDERS_KEY,
  rescheduleAll, reportUnusualUsage, saveReminders, STORE, syncInvoicePayments,
} from './center';
import { DEFAULT_REMINDERS } from './schedule';

const secure = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const NOW = new Date(2026, 10, 1, 10, 0);
const daily = { ...DEFAULT_REMINDERS, frequency: 'daily' as const, id: 'r1', label: '', enabled: true };
const stored = async <T,>(key: string) => JSON.parse((await AsyncStorage.getItem(key)) ?? 'null') as T;

beforeEach(async () => {
  secure.clear();
  await AsyncStorage.clear();
});

test('re-planning schedules every notification with its id and remembers the plan', async () => {
  secure.set(REMINDERS_KEY, JSON.stringify([daily]));
  expect(await rescheduleAll(NOW)).toBe(36);

  const first = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls[0]![0];
  expect(first.identifier).toMatch(/^reading:r1:/);
  expect(first.content).toMatchObject({ title: 'Czas na odczyt licznika', data: { url: '/reading/new' } });
  expect(await stored<unknown[]>(STORE.planned)).toHaveLength(36);
});

test('notifications whose time passed move to the history as unread', async () => {
  secure.set(REMINDERS_KEY, JSON.stringify([daily]));
  await rescheduleAll(NOW);

  const log = await deliverDue(new Date(2026, 10, 3, 8, 0)); // 1.11 and 2.11 at 22:00 have been shown
  expect(log.map((e) => e.at)).toEqual([new Date(2026, 10, 2, 22, 0).toISOString(), new Date(2026, 10, 1, 22, 0).toISOString()]);
  expect(log.every((e) => !e.read)).toBe(true);
  expect(Notifications.setBadgeCountAsync).toHaveBeenLastCalledWith(2);
  expect(await stored<unknown[]>(STORE.planned)).toHaveLength(34);

  await markRead(log[0]!.id);
  expect((await stored<{ read: boolean }[]>(STORE.log)).map((e) => e.read)).toEqual([true, false]);
  await markRead();
  expect(Notifications.setBadgeCountAsync).toHaveBeenLastCalledWith(0);
  await clearLog();
  expect(await stored<unknown[]>(STORE.log)).toEqual([]);
});

test('invoice deadlines become payment reminders; past or paid-off ones are ignored', async () => {
  await syncInvoicePayments('p1', [
    invoice({ id: 'a', dueDate: '2099-03-16', amountDue: 393.27, totalGross: 672.13 }),
    invoice({ id: 'b', dueDate: '2020-01-01' }),
    invoice({ id: 'c', dueDate: '2099-05-01', amountDue: -20 }),
    invoice({ id: 'd', dueDate: null }),
  ]);
  const payments = await stored<Record<string, { invoiceId: string; amount: number }[]>>(STORE.payments);
  expect(payments.p1).toEqual([expect.objectContaining({ invoiceId: 'a', amount: 393.27 })]);
  expect(jest.mocked(Notifications.scheduleNotificationAsync).mock.calls.map((c) => c[0].identifier)).toEqual(['payment:a:before', 'payment:a:due']);

  jest.mocked(Notifications.cancelAllScheduledNotificationsAsync).mockClear();
  await syncInvoicePayments('p1', [invoice({ id: 'a', dueDate: '2099-03-16', amountDue: 393.27, totalGross: 672.13 })]);
  expect(Notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled(); // nothing changed
});

test('budget alert is shown once per billing period and only when enabled', async () => {
  const over = forecast({ budgetForPeriod: 300, budgetUsagePercent: 120, forecastCostGross: 360, periodStart: '2026-11-01' });
  await checkBudget('Mieszkanie', over);
  await checkBudget('Mieszkanie', over);
  const log = await loadLog();
  expect(log).toHaveLength(1);
  expect(log[0]).toMatchObject({ kind: 'budget', title: 'Prognoza przekracza budżet', read: false });
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ trigger: null }));

  await checkBudget('Mieszkanie', { ...over, periodStart: '2027-01-01' });
  expect(await loadLog()).toHaveLength(2);

  secure.set(PREFS_KEY, JSON.stringify({ budget: false }));
  await checkBudget('Mieszkanie', { ...over, periodStart: '2027-03-01' });
  await checkBudget('Mieszkanie', forecast({ budgetUsagePercent: 80 }));
  expect(await loadLog()).toHaveLength(2);
});

test('unusual consumption after a reading is reported', async () => {
  await reportUnusualUsage({ reading: reading({ id: 'x' }), warnings: [{ code: 'reading.unusual_jump', message: 'Nietypowo duży wzrost.' }] });
  await reportUnusualUsage({ reading: reading(), warnings: [] });
  expect(await loadLog()).toEqual([expect.objectContaining({ kind: 'usage', body: 'Nietypowo duży wzrost.', url: '/reading/x' })]);
});

test('alerts land in the history even without the notification permission', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
  await notifyNow('usage', 'Tytuł', 'Treść');
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(await loadLog()).toHaveLength(1);
});

test('saving reminders asks for permission; readings move the marker forward only', async () => {
  expect(await saveReminders([daily])).toBe('granted');
  expect(JSON.parse(secure.get(REMINDERS_KEY)!)).toHaveLength(1);

  await recordReadingForReminders(new Date());
  const marker = secure.get(LAST_READING_KEY);
  await recordReadingForReminders(new Date(2026, 1, 1));
  expect(secure.get(LAST_READING_KEY)).toBe(marker);
});
