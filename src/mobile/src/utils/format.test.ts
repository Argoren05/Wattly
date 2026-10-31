/** Tests of the pure formatting and parsing helpers. */
import {
  addDays, addMonths, formatDate, formatDateTime, formatKwh, formatMoney, formatPercent, parseDecimal, parseIsoDate,
  parseLocalDateTime, toIsoDate, toLocalDateTimeText, toOffsetIso,
} from './format';

describe('parseDecimal', () => {
  test('accepts comma and dot, rejects garbage', () => {
    expect(parseDecimal('1234,5')).toBe(1234.5);
    expect(parseDecimal(' 0.62 ')).toBe(0.62);
    expect(parseDecimal('1 000')).toBe(1000);
    expect(parseDecimal('-3')).toBe(-3);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('12a')).toBeNull();
  });
});

describe('dates', () => {
  test('parseIsoDate rejects impossible dates and other formats', () => {
    expect(parseIsoDate('2026-02-28')).toBe('2026-02-28');
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('30.10.2026')).toBeNull();
  });

  test('parseLocalDateTime returns ISO instant with offset in the device zone', () => {
    const iso = parseLocalDateTime('2026-10-30 18:05');
    expect(iso).toMatch(/^2026-10-30T18:05:00[+-]\d{2}:\d{2}$/);
    expect(new Date(iso!).getHours()).toBe(18);
    expect(parseLocalDateTime('2026-10-30 25:00')).toBeNull();
    expect(parseLocalDateTime('2026-13-01 10:00')).toBeNull();
    expect(parseLocalDateTime('jutro')).toBeNull();
  });

  test('round trip between text and Date', () => {
    const date = new Date(2026, 0, 5, 7, 9);
    expect(toIsoDate(date)).toBe('2026-01-05');
    expect(toLocalDateTimeText(date)).toBe('2026-01-05 07:09');
    expect(new Date(toOffsetIso(date)).getTime()).toBe(date.getTime());
  });

  test('addDays and addMonths do not mutate input', () => {
    const date = new Date(2026, 0, 31);
    expect(toIsoDate(addDays(date, 1))).toBe('2026-02-01');
    expect(addMonths(date, 1).getMonth()).toBeGreaterThanOrEqual(1);
    expect(toIsoDate(date)).toBe('2026-01-31');
  });
});

describe('formatting', () => {
  test('formats dates in Polish style', () => {
    expect(formatDate('2026-10-30')).toBe('30.10.2026');
    expect(formatDate(null)).toBe('–');
    expect(formatDateTime(new Date(2026, 9, 30, 8, 5).toISOString())).toBe('30.10.2026, 08:05');
    expect(formatDateTime(undefined)).toBe('–');
  });

  test('formats numbers with units and placeholders', () => {
    expect(formatKwh(12.34)).toMatch(/^12,3\s?kWh$/);
    expect(formatKwh(null)).toBe('–');
    expect(formatMoney(1234.5)).toMatch(/1\s?234,50\s?zł/);
    expect(formatMoney(undefined)).toBe('–');
    expect(formatPercent(12.345)).toBe('12,3%');
    expect(formatPercent(null)).toBe('–');
  });
});
