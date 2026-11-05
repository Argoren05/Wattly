// Reading reminders: settings and planning of notification times. Pure functions – no native modules,
// so the rules are unit-tested with Node. Scheduling with expo-notifications is in ./reminders.ts.

/** How often the user wants to be reminded. */
export type ReminderFrequency = 'off' | 'daily' | 'weekly' | 'monthly';

/** Reminder settings (kept on the device – a reminder is a property of the phone, not of the account). */
export interface ReminderSettings {
  frequency: ReminderFrequency;
  /** Local time "HH:mm". */
  time: string;
  /** Days of week for daily reminders: 1 = Monday … 7 = Sunday. */
  weekdays: number[];
  /** Day of week for weekly reminders (1 = Monday … 7 = Sunday). */
  weekday: number;
  /** Day of month for monthly reminders (1–28, so every month has it). */
  dayOfMonth: number;
  /** Do not remind on a day for which a reading has already been added. */
  skipWhenRead: boolean;
}

/** Defaults: off; when switched on – every day at 22:00, skipping days with a reading. */
export const DEFAULT_REMINDERS: ReminderSettings = {
  frequency: 'off', time: '22:00', weekdays: [1, 2, 3, 4, 5, 6, 7], weekday: 7, dayOfMonth: 1, skipWhenRead: true,
};

/** How far ahead notifications are planned. They are re-planned on every app start and after each reading. */
export const PLANNING_HORIZON_DAYS = 35;

/** Short Polish names of weekdays, index 1 = Monday. */
const SHORT_DAYS = ['', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

/**
 * Short Polish name of a weekday.
 * @param day 1 = Monday … 7 = Sunday.
 */
export function weekdayLabel(day: number): string {
  return SHORT_DAYS[day] ?? '';
}

/**
 * Reads saved settings, ignoring invalid values (e.g. written by another app version).
 * @param raw Stored JSON or null.
 */
export function parseReminderSettings(raw: string | null): ReminderSettings {
  let value: Partial<ReminderSettings> = {};
  try {
    value = raw ? (JSON.parse(raw) as Partial<ReminderSettings>) : {};
  } catch {
    return DEFAULT_REMINDERS;
  }
  const day = (n: unknown, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= max;
  const weekdays = Array.isArray(value.weekdays) ? [...new Set(value.weekdays.filter((d) => day(d, 7)))].sort() : [];
  return {
    frequency: value.frequency && ['off', 'daily', 'weekly', 'monthly'].includes(value.frequency) ? value.frequency : DEFAULT_REMINDERS.frequency,
    time: parseTime(value.time ?? '') ? value.time! : DEFAULT_REMINDERS.time,
    weekdays: weekdays.length > 0 ? weekdays : DEFAULT_REMINDERS.weekdays,
    weekday: day(value.weekday, 7) ? value.weekday! : DEFAULT_REMINDERS.weekday,
    dayOfMonth: day(value.dayOfMonth, 28) ? value.dayOfMonth! : DEFAULT_REMINDERS.dayOfMonth,
    skipWhenRead: typeof value.skipWhenRead === 'boolean' ? value.skipWhenRead : DEFAULT_REMINDERS.skipWhenRead,
  };
}

/**
 * Parses "HH:mm".
 * @param text Time text.
 * @returns Hours and minutes, or null when invalid.
 */
export function parseTime(text: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

/** Same calendar day in the device time zone. */
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** ISO weekday of a date: 1 = Monday … 7 = Sunday. */
const isoWeekday = (date: Date) => ((date.getDay() + 6) % 7) + 1;

/**
 * Plans the moments of the next reminders.
 * @param settings Reminder settings.
 * @param now Current time.
 * @param lastReadingAt Time of the most recent reading added on this device (used by `skipWhenRead`).
 * @param horizonDays How many days ahead to plan.
 * @returns Future moments in ascending order (empty when reminders are off).
 */
export function planReminders(settings: ReminderSettings, now: Date, lastReadingAt: Date | null, horizonDays = PLANNING_HORIZON_DAYS): Date[] {
  const time = parseTime(settings.time);
  if (settings.frequency === 'off' || !time) return [];

  const result: Date[] = [];
  for (let offset = 0; offset <= horizonDays; offset++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, time.hour, time.minute);
    if (at <= now) continue;

    const due =
      settings.frequency === 'daily' ? settings.weekdays.includes(isoWeekday(at))
        : settings.frequency === 'weekly' ? isoWeekday(at) === settings.weekday
          : at.getDate() === settings.dayOfMonth;
    if (!due) continue;

    // A reading already added that day makes the reminder pointless.
    if (settings.skipWhenRead && lastReadingAt && sameDay(lastReadingAt, at)) continue;
    result.push(at);
  }
  return result;
}

/**
 * Human-readable summary shown in Settings, e.g. "Codziennie o 22:00" or "Co tydzień w niedzielę o 20:00".
 * @param settings Reminder settings.
 */
export function describeReminders(settings: ReminderSettings): string {
  const names = ['', 'poniedziałek', 'wtorek', 'środę', 'czwartek', 'piątek', 'sobotę', 'niedzielę'];
  switch (settings.frequency) {
    case 'off':
      return 'Wyłączone';
    case 'daily':
      return settings.weekdays.length === 7
        ? `Codziennie o ${settings.time}`
        : `${settings.weekdays.map(weekdayLabel).join(', ')} o ${settings.time}`;
    case 'weekly':
      return `Co tydzień w ${names[settings.weekday] ?? ''} o ${settings.time}`;
    case 'monthly':
      return `Co miesiąc ${settings.dayOfMonth}. dnia o ${settings.time}`;
  }
}
