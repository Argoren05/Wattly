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

/** Numeric day, month and year – the order and separators come from the locale (e.g. 30.10.2026 or 10/30/2026). */
const DATE_PARTS: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };

/**
 * Formats a calendar date in the phone's format: dates follow the system language and region settings.
 * "2026-10-30" -> "30.10.2026" for Polish.
 * @param isoDate Date "YYYY-MM-DD" (a longer ISO string is cut to the date).
 * @param locale BCP 47 locale; undefined = the device setting.
 */
export function formatDate(isoDate: string | null | undefined, locale?: string): string {
  if (!isoDate) return '–';
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(locale, DATE_PARTS);
}

/**
 * Formats an instant as local date and time in the phone's format (12/24-hour clock from the device).
 * @param iso ISO 8601 instant.
 * @param locale BCP 47 locale; undefined = the device setting.
 */
export function formatDateTime(iso: string | null | undefined, locale?: string): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString(locale, { ...DATE_PARTS, hour: '2-digit', minute: '2-digit' });
}

/**
 * Parses the local "YYYY-MM-DD" or "YYYY-MM-DD HH:mm" text used by date fields into a Date (device time zone).
 * @param text Field value.
 * @returns The date, or null when the text is not a real calendar date/time.
 */
export function parseFieldDate(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(text.trim());
  if (!match) return null;
  const [y, mo, d, h, mi] = [match[1], match[2], match[3], match[4] ?? '0', match[5] ?? '0'].map(Number) as [number, number, number, number, number];
  const date = new Date(y, mo - 1, d, h, mi);
  const valid = date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d && h <= 23 && mi <= 59;
  return valid ? date : null;
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
