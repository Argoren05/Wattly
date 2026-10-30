/** Error returned by the API in RFC 9457 Problem Details format. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** First validation message for a field (case-insensitive match of the API field name). */
  field(name: string): string | undefined {
    const key = Object.keys(this.fieldErrors).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? this.fieldErrors[key]?.[0] : undefined;
  }
}

export class NetworkError extends Error {
  constructor() {
    super('Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.');
    this.name = 'NetworkError';
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const first = Object.values(error.fieldErrors)[0]?.[0];
    if (error.status === 400 && first) return first;
    return error.message;
  }
  if (error instanceof NetworkError) return error.message;
  return 'Wystąpił nieoczekiwany błąd.';
}
