import { DEFAULT_REMINDERS, describeReminders, parseReminderSettings, parseTime, planReminders, type ReminderSettings } from './schedule';

/** Sunday 1 November 2026, 10:00 local time. */
const NOW = new Date(2026, 10, 1, 10, 0);
const settings = (patch: Partial<ReminderSettings>): ReminderSettings => ({ ...DEFAULT_REMINDERS, frequency: 'daily', ...patch });
const days = (dates: Date[]) => dates.map((d) => `${d.getDate()}.${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`);

describe('planReminders', () => {
  test('daily reminders start today when the time has not passed yet', () => {
    const planned = planReminders(settings({ time: '22:00' }), NOW, null, 3);
    expect(days(planned)).toEqual(['1.11 22:00', '2.11 22:00', '3.11 22:00', '4.11 22:00']);
  });

  test('a time already passed today starts tomorrow', () => {
    expect(days(planReminders(settings({ time: '08:30' }), NOW, null, 1))).toEqual(['2.11 8:30']);
  });

  test('only selected weekdays are used', () => {
    // 2.11.2026 is a Monday, 4.11 a Wednesday.
    expect(days(planReminders(settings({ weekdays: [1, 3] }), NOW, null, 7))).toEqual(['2.11 22:00', '4.11 22:00']);
  });

  test('weekly and monthly reminders', () => {
    expect(days(planReminders(settings({ frequency: 'weekly', weekday: 7, time: '20:00' }), NOW, null, 14)))
      .toEqual(['1.11 20:00', '8.11 20:00', '15.11 20:00']);
    expect(days(planReminders(settings({ frequency: 'monthly', dayOfMonth: 5 }), NOW, null, 40))).toEqual(['5.11 22:00', '5.12 22:00']);
  });

  test('a reading added today skips today’s reminder only when enabled', () => {
    const readToday = new Date(2026, 10, 1, 9, 0);
    expect(days(planReminders(settings({}), NOW, readToday, 1))).toEqual(['2.11 22:00']);
    expect(days(planReminders(settings({ skipWhenRead: false }), NOW, readToday, 1))).toEqual(['1.11 22:00', '2.11 22:00']);
  });

  test('nothing is planned when reminders are off or the time is invalid', () => {
    expect(planReminders(DEFAULT_REMINDERS, NOW, null)).toEqual([]);
    expect(planReminders(settings({ time: '25:00' }), NOW, null)).toEqual([]);
  });
});

test('parseReminderSettings repairs invalid values', () => {
  expect(parseReminderSettings(null)).toEqual(DEFAULT_REMINDERS);
  expect(parseReminderSettings('nope')).toEqual(DEFAULT_REMINDERS);
  expect(parseReminderSettings(JSON.stringify({ frequency: 'hourly', time: '99:99', weekdays: [0, 8, 3, 3], weekday: 9, dayOfMonth: 31, skipWhenRead: 'yes' })))
    .toEqual({ ...DEFAULT_REMINDERS, weekdays: [3] });
  expect(parseReminderSettings(JSON.stringify({ frequency: 'weekly', time: '7:05', weekday: 2, dayOfMonth: 15, skipWhenRead: false })))
    .toMatchObject({ frequency: 'weekly', time: '7:05', weekday: 2, dayOfMonth: 15, skipWhenRead: false });
});

test('parseTime and describeReminders', () => {
  expect(parseTime('7:05')).toEqual({ hour: 7, minute: 5 });
  expect(parseTime('24:00')).toBeNull();
  expect(describeReminders(DEFAULT_REMINDERS)).toBe('Wyłączone');
  expect(describeReminders(settings({}))).toBe('Codziennie o 22:00');
  expect(describeReminders(settings({ weekdays: [1, 5] }))).toBe('Pn, Pt o 22:00');
  expect(describeReminders(settings({ frequency: 'weekly', weekday: 7 }))).toBe('Co tydzień w niedzielę o 22:00');
  expect(describeReminders(settings({ frequency: 'monthly', dayOfMonth: 1 }))).toBe('Co miesiąc 1. dnia o 22:00');
});
