/** Tests of the HTTP client: headers, error mapping and token refresh. */
import { apiUrl, configureTokenStore, http } from './client';
import { ApiError, NetworkError } from './errors';
import type { TokenResponse } from './types';

/** Builds a fetch Response-like object. */
const response = (status: number, body?: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => (body === undefined ? '' : JSON.stringify(body)) }) as Response;

describe('http client', () => {
  let tokens: TokenResponse | null;
  const fetchMock = jest.fn();

  beforeEach(() => {
    tokens = { tokenType: 'Bearer', accessToken: 'old', expiresIn: 1, refreshToken: 'r1' };
    configureTokenStore({ getTokens: () => tokens, setTokens: async (t) => void (tokens = t) });
    global.fetch = fetchMock;
    fetchMock.mockReset();
  });

  test('builds versioned URLs from the configured base', () => {
    expect(apiUrl('/properties')).toBe('http://api.test/api/v1/properties');
  });

  test('sends bearer token and JSON body', async () => {
    fetchMock.mockResolvedValueOnce(response(200, { id: 1 }));

    await expect(http.post('/x', { a: 1 })).resolves.toEqual({ id: 1 });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer old');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"a":1}');
  });

  test('returns undefined for 204', async () => {
    fetchMock.mockResolvedValueOnce(response(204));
    await expect(http.delete('/x')).resolves.toBeUndefined();
  });

  test('maps problem details to ApiError', async () => {
    fetchMock.mockResolvedValueOnce(response(409, { title: 'Duplikat', code: 'reading.duplicate' }));

    const error = (await http.get('/x').catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.code).toBe('reading.duplicate');
  });

  test('uses default messages when the body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429, json: async () => { throw new Error(); } } as unknown as Response);
    await expect(http.get('/x')).rejects.toThrow('Zbyt wiele prób');
  });

  test('wraps network failures', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(http.get('/x')).rejects.toBeInstanceOf(NetworkError);
  });

  test('refreshes the token once on 401 and retries', async () => {
    fetchMock
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, { tokenType: 'Bearer', accessToken: 'new', expiresIn: 1, refreshToken: 'r2' }))
      .mockResolvedValueOnce(response(200, { ok: true }));

    await expect(http.get('/x')).resolves.toEqual({ ok: true });
    expect(tokens?.accessToken).toBe('new');
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer new');
  });

  test('clears the session when refresh fails', async () => {
    fetchMock.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(401));

    await expect(http.get('/x')).rejects.toBeInstanceOf(ApiError);
    expect(tokens).toBeNull();
  });

  test('sends FormData without JSON content type', async () => {
    fetchMock.mockResolvedValueOnce(response(200, {}));
    const form = new FormData();

    await http.post('/upload', form);

    expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toBeUndefined();
    expect(fetchMock.mock.calls[0][1].body).toBe(form);
  });
});
