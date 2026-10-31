import Constants from 'expo-constants';

import { ApiError, NetworkError } from './errors';
import type { TokenResponse } from './types';

/**
 * API base URL: EXPO_PUBLIC_API_URL (build-time env) wins over the value baked into app config.
 * `||` instead of `??`: CI passes an unset variable as an empty string, which must not become the base URL.
 */
const baseUrl: string =
  process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig?.extra?.apiUrl as string | undefined) || 'http://localhost:5103';

/**
 * Builds the absolute URL of a versioned API path.
 * @param path Path starting with '/', e.g. '/properties'.
 */
export const apiUrl = (path: string) => `${baseUrl.replace(/\/$/, '')}/api/v1${path}`;

/** Access to the session tokens owned by AuthProvider. */
interface TokenStore {
  getTokens(): TokenResponse | null;
  setTokens(tokens: TokenResponse | null): Promise<void>;
}

/** Token store registered by AuthProvider; null until the provider mounts. */
/**
 * Statuses returned by the hosting proxy while a sleeping server wakes up (Cloud Run scaling from zero, DEC-027).
 * The request did not reach the API, so repeating it once is safe.
 */
const WAKE_UP_STATUSES = new Set([502, 503]);

/** Pause before repeating a request that hit a waking server (ms); exported for tests. */
export const wakeUp = { delayMs: 2500 };

/** Waits the given number of milliseconds. */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let tokenStore: TokenStore | null = null;
/** Shared refresh promise, so parallel 401 responses trigger only one refresh. */
let refreshInFlight: Promise<boolean> | null = null;

/** Connects the HTTP client with the auth state (called once by AuthProvider). */
export function configureTokenStore(store: TokenStore) {
  tokenStore = store;
}

/** Request body: JSON-serialisable object or multipart form data. */
type Body = object | FormData | undefined;

/**
 * Sends a request with the bearer token, maps errors to ApiError/NetworkError and retries once after a token refresh on 401.
 * @param method HTTP method.
 * @param path API path (without /api/v1).
 * @param body Optional JSON object or FormData.
 * @param retry Whether a 401 may trigger a refresh and retry.
 * @returns Parsed JSON body, or undefined for empty responses.
 */
export async function request<T>(method: string, path: string, body?: Body, retry = true): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = tokenStore?.getTokens()?.accessToken;
  if (token) headers.Authorization = `Bearer ${token}`;

  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  /** Sends the request once. */
  const send = async (): Promise<Response> => {
    try {
      return await fetch(apiUrl(path), {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      });
    } catch {
      throw new NetworkError();
    }
  };

  let response = await send();
  if (WAKE_UP_STATUSES.has(response.status)) {
    // The server was asleep – give it a moment to start and try once more.
    await sleep(wakeUp.delayMs);
    response = await send();
  }

  if (response.status === 401 && retry && token && (await refreshTokens())) {
    return request<T>(method, path, body, false);
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Converts a failed response into an ApiError using its Problem Details body. */
async function toApiError(response: Response): Promise<ApiError> {
  try {
    const problem = (await response.json()) as { title?: string; code?: string; errors?: Record<string, string[]> };
    return new ApiError(response.status, problem.title ?? defaultMessage(response.status), problem.code, problem.errors ?? {});
  } catch {
    return new ApiError(response.status, defaultMessage(response.status));
  }
}

/** Polish message for responses without a Problem Details title. */
function defaultMessage(status: number): string {
  if (status === 401) return 'Sesja wygasła. Zaloguj się ponownie.';
  if (status === 403) return 'Brak uprawnień.';
  if (status === 404) return 'Nie znaleziono zasobu.';
  if (status === 429) return 'Zbyt wiele prób. Odczekaj chwilę.';
  return 'Wystąpił błąd serwera.';
}

/** Exchanges the refresh token once for concurrent 401 responses; clears the session if it fails. */
async function refreshTokens(): Promise<boolean> {
  if (!tokenStore) return false;
  refreshInFlight ??= (async () => {
    const refreshToken = tokenStore?.getTokens()?.refreshToken;
    if (!refreshToken) return false;
    try {
      const response = await fetch(apiUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        await tokenStore?.setTokens(null);
        return false;
      }
      await tokenStore?.setTokens((await response.json()) as TokenResponse);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** Shorthand HTTP helpers used by the endpoint modules. */
export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: Body) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: Body) => request<T>('PUT', path, body),
  delete: (path: string) => request<void>('DELETE', path),
};
