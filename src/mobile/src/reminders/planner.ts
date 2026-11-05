// Plans every scheduled notification of the app from the reminder list and invoice payment deadlines.
// Pure functions (no native modules) – tested with Node. Side effects live in ./center.ts.

import { formatMoney } from '../utils/format';
import { planReminders, PLANNING_HORIZON_DAYS, type Reminder } from './schedule';

/** Kinds of notifications; each can be switched off in Settings (reading reminders per reminder). */
export type NotificationKind = 'reading' | 'payment' | 'budget' | 'usage';

/** A notification planned for a moment or already shown. */
export interface PlannedNotification {
  /** Stable id, also used as the system notification identifier. */
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** ISO instant when it is (or was) shown. */
  at: string;
  /** Screen opened when tapped. */
  url?: string;
}

/** Invoice payment the app reminds about. */
export interface PaymentDue {
  invoiceId: string;
  propertyId: string;
  invoiceNumber: string;
  /** YYYY-MM-DD. */
  dueDate: string;
  amount: number;
  currency: string;
}

/** Which kinds of notifications are on (device setting). */
export interface NotificationPrefs {
  /** Remind about invoice payment deadlines. */
  payments: boolean;
  /** How many days before the deadline (0 = only on the day). */
  paymentDaysBefore: number;
  /** Alert when the forecast exceeds the budget of the billing period. */
  budget: boolean;
  /** Alert about unusually high consumption after a reading. */
  usage: boolean;
}

/** Defaults: everything on, payment reminder 3 days before. */
export const DEFAULT_PREFS: NotificationPrefs = { payments: true, paymentDaysBefore: 3, budget: true, usage: true };

/** Upper limit of planned notifications (Android allows a few hundred; this keeps planning fast). */
export const MAX_PLANNED = 60;

/**
 * Reads saved preferences, ignoring invalid values.
 * @param raw Stored JSON or null.
 */
export function parsePrefs(raw: string | null): NotificationPrefs {
  let value: Partial<NotificationPrefs> = {};
  try {
    value = raw ? (JSON.parse(raw) as Partial<NotificationPrefs>) : {};
  } catch {
    return DEFAULT_PREFS;
  }
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const days = value.paymentDaysBefore;
  return {
    payments: bool(value.payments, DEFAULT_PREFS.payments),
    paymentDaysBefore: typeof days === 'number' && Number.isInteger(days) && days >= 0 && days <= 14 ? days : DEFAULT_PREFS.paymentDaysBefore,
    budget: bool(value.budget, DEFAULT_PREFS.budget),
    usage: bool(value.usage, DEFAULT_PREFS.usage),
  };
}

/** Pads to two digits. */
const pad = (n: number) => String(n).padStart(2, '0');
/** Compact local timestamp for ids, e.g. 202611052200. */
const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
/** "2026-11-20" -> "20.11.2026". */
const plDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/**
 * Plans reading reminders and payment reminders.
 * @param reminders Reminder list (disabled ones are skipped).
 * @param payments Upcoming payments of all properties.
 * @param prefs Notification preferences.
 * @param now Current time.
 * @param lastReadingAt Last reading saved on this device (for "skip when read").
 * @returns Future notifications sorted by time, at most {@link MAX_PLANNED}.
 */
export function planAll(reminders: Reminder[], payments: PaymentDue[], prefs: NotificationPrefs, now: Date, lastReadingAt: Date | null): PlannedNotification[] {
  const plan: PlannedNotification[] = [];

  for (const reminder of reminders.filter((r) => r.enabled)) {
    for (const at of planReminders(reminder, now, lastReadingAt, PLANNING_HORIZON_DAYS)) {
      plan.push({
        id: `reading:${reminder.id}:${stamp(at)}`,
        kind: 'reading',
        title: 'Czas na odczyt licznika',
        body: reminder.label.trim() || 'Spisz wskazanie licznika i dodaj je w Wattly – prognoza będzie dokładniejsza.',
        at: at.toISOString(),
        url: '/reading/new',
      });
    }
  }

  if (prefs.payments) {
    for (const payment of payments) {
      const [y, m, d] = payment.dueDate.split('-').map(Number) as [number, number, number];
      const amount = `${formatMoney(payment.amount, payment.currency)}`;
      const moments: { suffix: string; at: Date; title: string }[] = [
        { suffix: 'due', at: new Date(y, m - 1, d, 9, 0), title: 'Dziś termin płatności faktury' },
      ];
      if (prefs.paymentDaysBefore > 0) {
        moments.unshift({
          suffix: 'before', at: new Date(y, m - 1, d - prefs.paymentDaysBefore, 10, 0),
          title: `Za ${prefs.paymentDaysBefore} ${prefs.paymentDaysBefore === 1 ? 'dzień' : 'dni'} termin płatności`,
        });
      }
      for (const moment of moments.filter((x) => x.at > now)) {
        plan.push({
          id: `payment:${payment.invoiceId}:${moment.suffix}`,
          kind: 'payment',
          title: moment.title,
          body: `Faktura ${payment.invoiceNumber}: ${amount} do ${plDate(payment.dueDate)}.`,
          at: moment.at.toISOString(),
          url: `/invoice/${payment.invoiceId}`,
        });
      }
    }
  }

  return plan.sort((a, b) => a.at.localeCompare(b.at)).slice(0, MAX_PLANNED);
}
