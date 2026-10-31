// Pure formatting helpers (pl-PL). No React Native imports so they can be unit-tested with Node.

/** Locale of all user-visible formatting. */
const LOCALE = 'pl-PL';

/**
 * Formats energy, e.g. "12,3 kWh"; '–' for missing values.
 * @param value Value in kWh.
 * @param fractionDigits Decimal places.
 */
export function formatKwh(value: number | null | undefined, fractionDigits = 1): string {
  if (value === null || value === undefined) return '–';
  return `${value.toLocaleString(LOCALE, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })} kWh`;
}

/**
 * Formats an amount in the given currency, e.g. "1 234,50 zł".
 * @param value Amount.
 * @param currency ISO 4217 code.
 */
export function formatMoney(value: number | null | undefined, currency = 'PLN'): string {
  if (value === null || value === undefined) return '–';
  return value.toLocaleString(LOCALE, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formats a percentage with one decimal place.
 * @param value Percentage (e.g. 12.5).
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–';
  return `${value.toLocaleString(LOCALE, { maximumFractionDigits: 1 })}%`;
}

/** Pads a number to two digits. */
const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-30" -> "30.10.2026" */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '–';
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

/** Instant -> local "30.10.2026, 18:00" in the device time zone. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  const date = new Date(iso);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parses a decimal typed with comma or dot. Returns null for empty or invalid input. */
export function parseDecimal(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.');
  if (normalized === '' || !/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

/** Local date as "YYYY-MM-DD". */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local date-time as editable text "YYYY-MM-DD HH:mm". */
export function toLocalDateTimeText(date: Date): string {
  return `${toIsoDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parses "YYYY-MM-DD" (strict, real calendar date). */
export function parseIsoDate(text: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? text.trim() : null;
}

/** Parses "YYYY-MM-DD HH:mm" in the device time zone and returns an ISO 8601 instant with offset. */
export function parseLocalDateTime(text: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  const date = new Date(y, mo - 1, d, h, mi);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d || date.getHours() !== h || h > 23 || mi > 59) return null;
  return toOffsetIso(date);
}

/** ISO string with the local UTC offset, e.g. 2026-10-30T18:00:00+01:00. */
export function toOffsetIso(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${toIsoDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/**
 * Returns a new date shifted by whole days.
 * @param date Start date.
 * @param days Number of days (may be negative).
 */
export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * Returns a new date shifted by calendar months.
 * @param date Start date.
 * @param months Number of months (may be negative).
 */
export function addMonths(date: Date, months: number): Date {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}
