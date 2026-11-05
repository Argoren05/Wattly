import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { Forecast, Invoice, ReadingSaved } from '../api/types';
import { formatMoney, toIsoDate } from '../utils/format';
import { parsePrefs, planAll, type NotificationKind, type NotificationPrefs, type PaymentDue, type PlannedNotification } from './planner';
import { parseReminders, type Reminder } from './schedule';

// Notification centre of the app (DEC-031, DEC-033). Everything is local to the phone:
// - scheduled notifications (reading reminders, payment deadlines) are planned for the coming weeks and re-planned
//   on start, after a reading, after invoices change and after settings change;
// - alerts (budget, unusual consumption) are shown immediately when the app detects them;
// - every notification lands in a history list (newest first, at most 100) with read/unread state.

/** Reminder list (small – kept in secure storage, like other settings). */
export const REMINDERS_KEY = 'wattly.reminders';
/** Kinds of notifications switched on. */
export const PREFS_KEY = 'wattly.notificationPrefs';
/** Time of the last reading saved on this device. */
export const LAST_READING_KEY = 'wattly.lastReadingAt';
/** Larger data in AsyncStorage: planned notifications, history, payments, alert markers. */
export const STORE = {
  planned: 'wattly.notifications.planned',
  log: 'wattly.notifications.log',
  payments: 'wattly.notifications.payments',
  alerts: 'wattly.notifications.alerts',
} as const;
/** Android notification channel. */
export const CHANNEL = 'reading-reminders';
/** Size of the history. */
export const MAX_LOG = 100;

/** Entry of the notification history. */
export interface LogEntry extends PlannedNotification {
  read: boolean;
}

/** Result of asking for the notification permission. */
export type PermissionState = 'granted' | 'denied' | 'blocked';

/** Reads JSON from AsyncStorage; a broken value counts as missing. */
async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Writes JSON to AsyncStorage. */
const writeJson = (key: string, value: unknown) => AsyncStorage.setItem(key, JSON.stringify(value));

/** Reminder list. */
export async function loadReminders(): Promise<Reminder[]> {
  return parseReminders(await SecureStore.getItemAsync(REMINDERS_KEY).catch(() => null));
}

/** Notification preferences. */
export async function loadPrefs(): Promise<NotificationPrefs> {
  return parsePrefs(await SecureStore.getItemAsync(PREFS_KEY).catch(() => null));
}

/**
 * Asks for permission to show notifications (Android 13+ and iOS ask once).
 * @returns `blocked` when refused permanently – only the system settings can change it.
 */
export async function ensurePermission(): Promise<PermissionState> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'blocked';
  const requested = await Notifications.requestPermissionsAsync();
  if (requested.granted) return 'granted';
  return requested.canAskAgain ? 'denied' : 'blocked';
}

/**
 * Moves planned notifications whose time has passed into the history (they have been shown by the system).
 * @param now Current time.
 * @returns The history, newest first.
 */
export async function deliverDue(now = new Date()): Promise<LogEntry[]> {
  const planned = await readJson<PlannedNotification[]>(STORE.planned, []);
  const log = await readJson<LogEntry[]>(STORE.log, []);
  const due = planned.filter((p) => new Date(p.at) <= now);
  if (due.length === 0) return log;
  const known = new Set(log.map((e) => e.id));
  const merged = [...due.filter((p) => !known.has(p.id)).map((p) => ({ ...p, read: false })), ...log]
    .sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_LOG);
  await writeJson(STORE.log, merged);
  await writeJson(STORE.planned, planned.filter((p) => new Date(p.at) > now));
  await updateBadge(merged);
  return merged;
}

/** Number on the app icon = unread history entries (where the launcher supports badges). */
async function updateBadge(log: LogEntry[]): Promise<void> {
  await Notifications.setBadgeCountAsync(log.filter((e) => !e.read).length).catch(() => false);
}

/** Upcoming payments of all properties. */
async function allPayments(): Promise<PaymentDue[]> {
  const byProperty = await readJson<Record<string, PaymentDue[]>>(STORE.payments, {});
  return Object.values(byProperty).flat();
}

/**
 * Cancels and re-plans every scheduled notification (reading reminders and payment deadlines).
 * @param now Current time (injectable for tests).
 * @returns Number of planned notifications.
 */
export async function rescheduleAll(now = new Date()): Promise<number> {
  await deliverDue(now);
  const [reminders, prefs, payments] = await Promise.all([loadReminders(), loadPrefs(), allPayments()]);
  const lastRaw = await SecureStore.getItemAsync(LAST_READING_KEY).catch(() => null);
  const last = lastRaw ? new Date(lastRaw) : null;
  const plan = planAll(reminders, payments, prefs, now, last && !Number.isNaN(last.getTime()) ? last : null);

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (plan.length > 0 && Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Wattly – przypomnienia i alerty', importance: AndroidImportance.DEFAULT });
  }
  for (const item of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content: { title: item.title, body: item.body, data: { url: item.url, id: item.id } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(item.at), channelId: CHANNEL },
    });
  }
  await writeJson(STORE.planned, plan);
  return plan.length;
}

/**
 * Shows a notification now and records it in the history.
 * @param kind Kind of the alert.
 * @param title Title.
 * @param body Text.
 * @param url Screen opened when tapped.
 */
export async function notifyNow(kind: NotificationKind, title: string, body: string, url?: string): Promise<void> {
  const entry: LogEntry = { id: `${kind}:${Date.now()}`, kind, title, body, url, at: new Date().toISOString(), read: false };
  const log = [entry, ...(await readJson<LogEntry[]>(STORE.log, []))].slice(0, MAX_LOG);
  await writeJson(STORE.log, log);
  await updateBadge(log);
  if ((await Notifications.getPermissionsAsync()).granted) {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Wattly – przypomnienia i alerty', importance: AndroidImportance.DEFAULT });
    }
    await Notifications.scheduleNotificationAsync({ identifier: entry.id, content: { title, body, data: { url, id: entry.id } }, trigger: null });
  }
}

/**
 * Saves the reminder list and re-plans. Enabled reminders ask for the notification permission first.
 * @param reminders New list.
 */
export async function saveReminders(reminders: Reminder[]): Promise<PermissionState> {
  const permission = reminders.some((r) => r.enabled) ? await ensurePermission() : 'granted';
  await SecureStore.setItemAsync(REMINDERS_KEY, JSON.stringify(reminders));
  await rescheduleAll();
  return permission;
}

/**
 * Saves notification preferences and re-plans.
 * @param prefs New preferences.
 */
export async function savePrefs(prefs: NotificationPrefs): Promise<PermissionState> {
  const permission = prefs.payments || prefs.budget || prefs.usage ? await ensurePermission() : 'granted';
  await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs));
  await rescheduleAll();
  return permission;
}

/**
 * Remembers upcoming invoice payments of a property (called whenever its invoices are loaded or saved) and re-plans
 * when they changed. Paid-on-time history is not tracked: a deadline in the past is simply dropped.
 * @param propertyId Property.
 * @param invoices Its invoices.
 */
export async function syncInvoicePayments(propertyId: string, invoices: Invoice[]): Promise<void> {
  try {
    const today = toIsoDate(new Date());
    const upcoming: PaymentDue[] = invoices
      .filter((i) => i.dueDate && i.dueDate >= today && (i.amountDue ?? i.totalGross) > 0)
      .map((i) => ({ invoiceId: i.id, propertyId, invoiceNumber: i.invoiceNumber, dueDate: i.dueDate!, amount: i.amountDue ?? i.totalGross, currency: i.currencyCode }));
    const all = await readJson<Record<string, PaymentDue[]>>(STORE.payments, {});
    if (JSON.stringify(all[propertyId] ?? []) === JSON.stringify(upcoming)) return;
    await writeJson(STORE.payments, { ...all, [propertyId]: upcoming });
    await rescheduleAll();
  } catch {
    // A notification problem must never break the invoices screen.
  }
}

/**
 * Budget alert, at most once per billing period and property, when the forecast exceeds the budget.
 * @param propertyName Name shown in the text.
 * @param forecast Forecast of the current billing period.
 */
export async function checkBudget(propertyName: string, forecast: Forecast): Promise<void> {
  try {
    if (forecast.budgetUsagePercent === null || forecast.budgetUsagePercent <= 100 || forecast.budgetForPeriod === null) return;
    if (!(await loadPrefs()).budget) return;
    const alerts = await readJson<Record<string, string>>(STORE.alerts, {});
    const key = `budget:${forecast.propertyId}`;
    if (alerts[key] === forecast.periodStart) return;
    await writeJson(STORE.alerts, { ...alerts, [key]: forecast.periodStart });
    await notifyNow('budget', 'Prognoza przekracza budżet',
      `${propertyName}: prognoza ${formatMoney(forecast.forecastCostGross, forecast.currencyCode)} przy budżecie ${formatMoney(forecast.budgetForPeriod, forecast.currencyCode)} na ten okres.`, '/');
  } catch {
    // Ignored on purpose.
  }
}

/**
 * Unusual-consumption alert after a reading the server flagged (the user confirmed an unusual jump).
 * @param saved Result of saving the reading.
 */
export async function reportUnusualUsage(saved: ReadingSaved): Promise<void> {
  try {
    const warning = saved.warnings.find((w) => w.code === 'reading.unusual_jump');
    if (!warning || !(await loadPrefs()).usage) return;
    await notifyNow('usage', 'Nietypowo duże zużycie', warning.message, `/reading/${saved.reading.id}`);
  } catch {
    // Ignored on purpose.
  }
}

/**
 * Remembers that a reading was saved and re-plans, so today's reading reminders are skipped.
 * @param readingAt Time of the saved reading.
 */
export async function recordReadingForReminders(readingAt: Date): Promise<void> {
  try {
    const previous = await SecureStore.getItemAsync(LAST_READING_KEY);
    if (previous && new Date(previous) >= readingAt) return;
    await SecureStore.setItemAsync(LAST_READING_KEY, readingAt.toISOString());
    if ((await loadReminders()).some((r) => r.enabled)) await rescheduleAll();
  } catch {
    // Ignored on purpose.
  }
}

/** History, newest first (planned notifications whose time passed are included). */
export const loadLog = () => deliverDue();

/**
 * Marks history entries as read.
 * @param id One entry, or all when omitted.
 */
export async function markRead(id?: string): Promise<void> {
  const log = (await readJson<LogEntry[]>(STORE.log, [])).map((e) => (id === undefined || e.id === id ? { ...e, read: true } : e));
  await writeJson(STORE.log, log);
  await updateBadge(log);
}

/** Removes the whole history. */
export async function clearLog(): Promise<void> {
  await writeJson(STORE.log, []);
  await updateBadge([]);
}
