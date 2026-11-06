import { DEFAULT_PREFS, parsePrefs, planAll, type PaymentDue } from './planner';
import { DEFAULT_REMINDERS, parseReminders, type Reminder } from './schedule';

/** Sunday 1 November 2026, 10:00 local time. */
const NOW = new Date(2026, 10, 1, 10, 0);
const reminder = (patch: Partial<Reminder>): Reminder => ({ ...DEFAULT_REMINDERS, frequency: 'daily', id: 'r1', label: '', enabled: true, ...patch });
const payment = (patch: Partial<PaymentDue> = {}): PaymentDue => ({
  invoiceId: 'i1', propertyId: 'p1', invoiceNumber: 'E/TM3/1', dueDate: '2026-11-20', amount: 393.27, currency: 'PLN', ...patch,
});

describe('parseReminders', () => {
  test('migrates the single reminder of version 1.2 to a list', () => {
    expect(parseReminders(JSON.stringify({ frequency: 'weekly', time: '20:00', weekday: 7 })))
      .toEqual([expect.objectContaining({ id: 'r1', frequency: 'weekly', time: '20:00', enabled: true, label: '' })]);
    expect(parseReminders(JSON.stringify({ frequency: 'off' }))).toEqual([]);
  });

  test('reads a list, repairing entries and dropping invalid ones', () => {
    const list = parseReminders(JSON.stringify([
      { id: 'a', frequency: 'daily', time: '22:00', label: 'Licznik', enabled: false },
      { frequency: 'monthly', dayOfMonth: 1, time: '9:00' },
      'garbage', { frequency: 'off' },
    ]));
    expect(list).toEqual([
      expect.objectContaining({ id: 'a', label: 'Licznik', enabled: false }),
      expect.objectContaining({ id: 'r2', frequency: 'monthly', dayOfMonth: 1, enabled: true }),
    ]);
    expect(parseReminders('not json')).toEqual([]);
    expect(parseReminders(null)).toEqual([]);
  });
});

test('parsePrefs falls back to defaults for invalid values', () => {
  expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
  expect(parsePrefs(JSON.stringify({ payments: false, paymentDaysBefore: 99, budget: 'yes' }))).toEqual({ ...DEFAULT_PREFS, payments: false });
});

describe('planAll', () => {
  test('combines several reminders, skips disabled ones and uses the own text', () => {
    const plan = planAll([
      reminder({ id: 'daily', time: '22:00' }),
      reminder({ id: 'invoice', frequency: 'monthly', dayOfMonth: 5, time: '09:00', label: 'Spisz licznik do faktury' }),
      reminder({ id: 'off', enabled: false }),
    ], [], DEFAULT_PREFS, NOW, null);

    expect(plan.some((p) => p.id.startsWith('reading:off'))).toBe(false);
    const monthly = plan.find((p) => p.id.startsWith('reading:invoice'))!;
    expect(monthly).toMatchObject({ kind: 'reading', body: 'Spisz licznik do faktury', url: '/reading/new' });
    expect(new Date(monthly.at)).toEqual(new Date(2026, 10, 5, 9, 0));
    expect(plan.map((p) => p.at)).toEqual([...plan.map((p) => p.at)].sort());
  });

  test('plans payment reminders before and on the due day', () => {
    const plan = planAll([], [payment()], DEFAULT_PREFS, NOW, null);
    expect(plan).toEqual([
      expect.objectContaining({ id: 'payment:i1:before', title: 'Za 3 dni termin płatności', url: '/invoice/i1', at: new Date(2026, 10, 17, 10, 0).toISOString() }),
      expect.objectContaining({ id: 'payment:i1:due', title: 'Dziś termin płatności faktury', at: new Date(2026, 10, 20, 9, 0).toISOString() }),
    ]);
    expect(plan[0]!.body).toMatch(/E\/TM3\/1: 393,27\s?zł do 20\.11\.2026/);
  });

  test('payment options: only on the day, switched off, and moments already past', () => {
    expect(planAll([], [payment()], { ...DEFAULT_PREFS, paymentDaysBefore: 0 }, NOW, null).map((p) => p.id)).toEqual(['payment:i1:due']);
    expect(planAll([], [payment()], { ...DEFAULT_PREFS, payments: false }, NOW, null)).toEqual([]);
    expect(planAll([], [payment({ dueDate: '2026-11-02' })], DEFAULT_PREFS, NOW, null).map((p) => p.id)).toEqual(['payment:i1:due']);
    expect(planAll([], [payment({ dueDate: '2026-11-01' })], DEFAULT_PREFS, NOW, null)).toEqual([]);
  });

  test('never plans more than the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => reminder({ id: `r${i}`, time: `1${i % 10}:30` }));
    expect(planAll(many, [], DEFAULT_PREFS, NOW, null)).toHaveLength(60);
  });
});
