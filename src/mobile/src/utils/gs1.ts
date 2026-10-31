// GS1 helpers for metering point numbers (PPE). Pure functions, unit-tested with Node.
//
// A Polish PPE number (e.g. 590322428100789765) is a GS1 GSRN: 18 digits, the last one a check digit.
// The same rules are enforced by the API (Wattly.Application/Common/Gs1.cs); checking them here gives instant feedback.

/** Number of digits of a GSRN. */
export const GSRN_LENGTH = 18;

/** GS1 Application Identifier preceding a GSRN of a service provider/recipient in GS1-128 and DataMatrix codes. */
const GSRN_AI = '8018';

/**
 * Removes spaces and dashes users type to group digits.
 * @param value Raw input.
 */
export function normalizePpe(value: string): string {
  return value.replace(/[\s-]/g, '');
}

/**
 * GS1 check digit: digits weighted 3,1,3,1… from the rightmost data digit; the check digit tops the sum up to a multiple of 10.
 * @param data Digits without the check digit.
 */
export function gs1CheckDigit(data: string): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const digit = Number(data[data.length - 1 - i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Checks that the value is an 18-digit GSRN with a correct check digit.
 * @param value Normalized value.
 */
export function isValidPpe(value: string): boolean {
  return /^\d{18}$/.test(value) && gs1CheckDigit(value.slice(0, -1)) === Number(value[GSRN_LENGTH - 1]);
}

/**
 * Finds a PPE number in scanned barcode content. Accepts plain digits, GS1-128/DataMatrix data with the (8018)
 * identifier (with or without brackets and separator characters) and text that contains the number among other data.
 * @param data Decoded barcode content.
 * @returns The valid 18-digit number, or null when the code does not contain one.
 */
export function extractPpe(data: string): string | null {
  const digits = data.replace(/\D/g, '');
  if (isValidPpe(digits)) return digits;

  // GS1 element string: "8018" followed by the GSRN.
  for (let i = digits.indexOf(GSRN_AI); i >= 0; i = digits.indexOf(GSRN_AI, i + 1)) {
    const candidate = digits.slice(i + GSRN_AI.length, i + GSRN_AI.length + GSRN_LENGTH);
    if (isValidPpe(candidate)) return candidate;
  }

  // Any separate 18-digit group (e.g. "PPE: 590322428100789765" in a QR code).
  for (const group of data.match(/\d[\d\s-]{16,}\d/g) ?? []) {
    const candidate = normalizePpe(group);
    if (isValidPpe(candidate)) return candidate;
  }
  return null;
}
