import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { parseReminderSettings, planReminders, type ReminderSettings } from './schedule';

// Local reading reminders (no server, no push tokens): the phone schedules one-off notifications for the next weeks.
// They are re-planned on every app start, after each saved reading and when settings change, so "skip when a reading
// was added that day" works without a server round-trip.

/** Storage key of the reminder settings. */
export const REMINDERS_KEY = 'wattly.reminders';
/** Storage key of the time of the last reading saved on this device. */
export const LAST_READING_KEY = 'wattly.lastReadingAt';
/** Android notification channel (users can tune sound/vibration of it in system settings). */
export const REMINDER_CHANNEL = 'reading-reminders';
/** Screen opened when the user taps a reminder. */
export const REMINDER_URL = '/reading/new';

/** Result of asking for the notification permission. */
export type PermissionState = 'granted' | 'denied' | 'blocked';

/** Reads the saved settings (defaults when none). */
export async function loadReminderSettings(): Promise<ReminderSettings> {
  return parseReminderSettings(await SecureStore.getItemAsync(REMINDERS_KEY).catch(() => null));
}

/**
 * Asks for permission to show notifications (Android 13+ and iOS ask the user once).
 * @returns `blocked` when the user denied it permanently – it can only be changed in system settings.
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
 * Cancels planned reminders and plans them again from the saved settings and the last reading.
 * @param now Current time (injectable for tests).
 * @returns Number of planned notifications.
 */
export async function rescheduleReminders(now = new Date()): Promise<number> {
  const settings = await loadReminderSettings();
  const lastRaw = await SecureStore.getItemAsync(LAST_READING_KEY).catch(() => null);
  const lastReadingAt = lastRaw ? new Date(lastRaw) : null;

  await Notifications.cancelAllScheduledNotificationsAsync();
  const moments = planReminders(settings, now, lastReadingAt && !Number.isNaN(lastReadingAt.getTime()) ? lastReadingAt : null);
  if (moments.length === 0) return 0;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: 'Przypomnienia o odczycie',
      importance: AndroidImportance.DEFAULT,
    });
  }

  for (const date of moments) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Czas na odczyt licznika',
        body: 'Spisz wskazanie licznika i dodaj je w Wattly – prognoza będzie dokładniejsza.',
        data: { url: REMINDER_URL },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: REMINDER_CHANNEL },
    });
  }
  return moments.length;
}

/**
 * Saves new settings and plans the reminders. Turning reminders on asks for the notification permission first.
 * @param settings New settings.
 * @returns Permission state (`granted` also when reminders are switched off).
 */
export async function saveReminderSettings(settings: ReminderSettings): Promise<PermissionState> {
  const permission = settings.frequency === 'off' ? 'granted' : await ensurePermission();
  await SecureStore.setItemAsync(REMINDERS_KEY, JSON.stringify(settings));
  await rescheduleReminders();
  return permission;
}

/**
 * Remembers that a reading was saved and re-plans reminders, so today's reminder is skipped.
 * Never throws – a reminder problem must not disturb saving a reading.
 * @param readingAt Time of the saved reading.
 */
export async function recordReadingForReminders(readingAt: Date): Promise<void> {
  try {
    const previousRaw = await SecureStore.getItemAsync(LAST_READING_KEY);
    // Back-dated readings must not move the marker backwards.
    if (previousRaw && new Date(previousRaw) >= readingAt) return;
    await SecureStore.setItemAsync(LAST_READING_KEY, readingAt.toISOString());
    const settings = await loadReminderSettings();
    if (settings.frequency !== 'off') await rescheduleReminders();
  } catch {
    // Ignored on purpose.
  }
}
