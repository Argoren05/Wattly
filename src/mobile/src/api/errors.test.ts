/** Tests of API error types and user messages. */
import { ApiError, errorMessage, NetworkError } from './errors';

describe('ApiError', () => {
  test('finds field messages case-insensitively', () => {
    const error = new ApiError(400, 'Błąd', undefined, { Value: ['Zła wartość'] });

    expect(error.field('value')).toBe('Zła wartość');
    expect(error.field('Other')).toBeUndefined();
  });
});

describe('errorMessage', () => {
  test('uses the first field error for validation problems', () => {
    expect(errorMessage(new ApiError(400, 'Dane są nieprawidłowe', undefined, { Name: ['Pole jest wymagane.'] }))).toBe('Pole jest wymagane.');
  });

  test('uses the title for other API errors', () => {
    expect(errorMessage(new ApiError(409, 'Duplikat', 'reading.duplicate'))).toBe('Duplikat');
  });

  test('explains network problems and hides unknown errors', () => {
    expect(errorMessage(new NetworkError())).toMatch(/Brak połączenia/);
    expect(errorMessage(new Error('internal details'))).toBe('Wystąpił nieoczekiwany błąd.');
  });
});
