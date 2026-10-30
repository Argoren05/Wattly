/** Error returned by the API in RFC 9457 Problem Details format. */
export class ApiError extends Error {
  /**
   * @param status HTTP status code.
   * @param message Problem title (user-facing, Polish).
   * @param code Stable domain error code, e.g. `reading.duplicate`.
   * @param fieldErrors Validation messages per field.
   */
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * First validation message for a field (case-insensitive match of the API field name).
   * @param name Field name.
   */
  field(name: string): string | undefined {
    const key = Object.keys(this.fieldErrors).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? this.fieldErrors[key]?.[0] : undefined;
  }
}

/** The request did not reach the server (offline, DNS, timeout). */
export class NetworkError extends Error {
  /** Creates the error with a user-facing Polish message. */
  constructor() {
    super('Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.');
    this.name = 'NetworkError';
  }
}

/** Error raised by local form validation; its message is always safe to show to the user. */
export class ValidationError extends Error {
  /** @param message Message shown to the user. */
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Converts any error into a message for the user. Unknown errors are hidden behind a generic text,
 * so technical details never leak into the UI.
 * @param error Caught error.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const first = Object.values(error.fieldErrors)[0]?.[0];
    if (error.status === 400 && first) return first;
    return error.message;
  }
  if (error instanceof NetworkError || error instanceof ValidationError) return error.message;
  return 'Wystąpił nieoczekiwany błąd.';
}
