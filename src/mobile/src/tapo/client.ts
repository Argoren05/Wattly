import { getRandomBytes } from 'expo-crypto';

import { base64Decode, utf8Decode } from './bytes';
import { authHash, equalBytes, handshake1Hash, handshake2Payload, KlapSession } from './klap';

/** Why talking to a plug failed – each kind gets its own message for the user. */
export type TapoErrorKind = 'unreachable' | 'credentials' | 'thirdParty' | 'protocol' | 'device' | 'unsupported';

/** Error of the Tapo client. */
export class TapoError extends Error {
  /**
   * @param kind Category of the failure.
   * @param message Technical details (logged/shown under the friendly text).
   */
  constructor(readonly kind: TapoErrorKind, message: string) {
    super(message);
    this.name = 'TapoError';
  }
}

/** Polish explanation of a failure. */
export function tapoErrorMessage(error: unknown): string {
  if (!(error instanceof TapoError)) return 'Nie udało się połączyć z gniazdkiem.';
  switch (error.kind) {
    case 'unreachable':
      return 'Brak połączenia z gniazdkiem – telefon musi być w tej samej sieci Wi-Fi, a adres IP aktualny.';
    case 'credentials':
      return 'Gniazdko nie przyjęło danych konta Tapo – sprawdź e-mail i hasło.';
    case 'thirdParty':
      return 'Gniazdko odrzuciło połączenie lokalne. W aplikacji Tapo włącz: Ja → Usługi zewnętrzne (Third-Party Services) → Zgodność z usługami zewnętrznymi (Third-Party Compatibility), odczekaj minutę i spróbuj ponownie. Gdy już jest włączona – wyłącz ją, wyjdź z ekranu i włącz ponownie.';
    case 'protocol':
      return `Gniazdko odpowiada w nieobsługiwany sposób – możliwe, że nowe oprogramowanie (TPAP) zmieniło protokół. Sprawdź, czy w aplikacji Tapo jest włączona zgodność z usługami zewnętrznymi. (${error.message})`;
    case 'device':
      return `Gniazdko zgłosiło błąd (${error.message}).`;
    case 'unsupported':
      return error.message;
  }
}

/** Minimal HTTP used by the client (fetch in the app, a fake in tests). */
export interface TapoTransport {
  post(url: string, body: Uint8Array, cookie: string | null): Promise<{ status: number; body: Uint8Array; setCookie: string | null }>;
}

/** HTTP over fetch; the plug speaks plain HTTP in the home network (allowed in app.json). */
export const fetchTransport: TapoTransport = {
  async post(url, body, cookie) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
        headers: { 'Content-Type': 'application/octet-stream', ...(cookie ? { Cookie: cookie } : {}) },
        signal: controller.signal,
      });
      return { status: response.status, body: new Uint8Array(await response.arrayBuffer()), setCookie: response.headers.get('set-cookie') };
    } catch (e) {
      throw new TapoError('unreachable', e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
    }
  },
};

/** Basic information about a plug. */
export interface TapoDeviceInfo {
  deviceId: string;
  model: string;
  /** Name given in the Tapo app. */
  nickname: string;
  /** Whether the plug measures energy (P110, P115, P110M…). */
  hasEnergyMonitoring: boolean;
}

/** Daily energy history returned by the plug. */
export interface TapoDailyEnergy {
  /** Local midnight of the first day (Unix seconds). */
  startTimestamp: number;
  /** Energy per day in Wh, from the first day up to today. */
  dailyWh: number[];
}

/** Session cookie from a Set-Cookie header ("TP_SESSIONID=…; TIMEOUT=…"). */
export function parseSessionCookie(header: string | null): string | null {
  const match = header?.match(/TP_SESSIONID=([^;,\s]+)/);
  return match ? `TP_SESSIONID=${match[1]}` : null;
}

/** Client of one Tapo plug in the local network (KLAP protocol). */
export class TapoClient {
  private session: KlapSession | null = null;
  private cookie: string | null = null;
  private readonly auth: Uint8Array;

  /**
   * @param host IP address (or host name) of the plug.
   * @param username Tapo account e-mail.
   * @param password Tapo account password.
   * @param transport HTTP implementation.
   * @param random Random bytes source (crypto-secure on the phone).
   */
  constructor(
    private readonly host: string,
    username: string,
    password: string,
    private readonly transport: TapoTransport = fetchTransport,
    private readonly random: (n: number) => Uint8Array = getRandomBytes,
  ) {
    this.auth = authHash(username.trim(), password);
  }

  /** Base URL of the KLAP endpoints. */
  private url(path: string): string {
    return `http://${this.host}/app/${path}`;
  }

  /** Two-step handshake; afterwards requests can be sent. */
  async connect(): Promise<void> {
    const local = this.random(16);
    const first = await this.transport.post(this.url('handshake1'), local, null);
    // Firmware 1.4+ answers 403 when "Third-Party Compatibility" is off (it then expects TPAP, which is not supported).
    if (first.status === 403) throw new TapoError('thirdParty', 'handshake1 HTTP 403');
    if (first.status !== 200) throw new TapoError('protocol', `handshake1 HTTP ${first.status}`);
    if (first.body.length !== 48) throw new TapoError('protocol', `handshake1 returned ${first.body.length} bytes`);
    const remote = first.body.slice(0, 16);
    if (!equalBytes(first.body.slice(16), handshake1Hash(local, remote, this.auth))) throw new TapoError('credentials', 'handshake1 hash mismatch');

    this.cookie = parseSessionCookie(first.setCookie);
    const second = await this.transport.post(this.url('handshake2'), handshake2Payload(local, remote, this.auth), this.cookie);
    if (second.status !== 200) throw new TapoError(second.status === 403 ? 'credentials' : 'protocol', `handshake2 HTTP ${second.status}`);
    this.session = new KlapSession(local, remote, this.auth);
  }

  /**
   * Sends one request and returns its `result`.
   * @param method Tapo method, e.g. "get_device_info".
   * @param params Parameters.
   */
  async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.session) await this.connect();
    const session = this.session!;
    const { payload, seq } = session.encrypt(JSON.stringify(params ? { method, params } : { method }));
    const response = await this.transport.post(`${this.url('request')}?seq=${seq}`, payload, this.cookie);
    if (response.status !== 200) throw new TapoError('protocol', `request HTTP ${response.status}`);
    let decoded: { error_code?: number; result?: T };
    try {
      decoded = JSON.parse(session.decrypt(response.body, seq)) as { error_code?: number; result?: T };
    } catch (e) {
      throw new TapoError('protocol', e instanceof Error ? e.message : 'invalid response');
    }
    if (decoded.error_code !== 0) throw new TapoError('device', `kod ${decoded.error_code ?? '?'}`);
    return decoded.result as T;
  }

  /** Id, model and name of the plug. */
  async getDeviceInfo(): Promise<TapoDeviceInfo> {
    const info = await this.request<{ device_id: string; model: string; nickname?: string; type?: string }>('get_device_info');
    let nickname = '';
    try {
      nickname = utf8Decode(base64Decode(info.nickname ?? '')).trim();
    } catch {
      nickname = '';
    }
    return { deviceId: info.device_id, model: info.model, nickname: nickname || info.model, hasEnergyMonitoring: /^P1(10|15)/i.test(info.model) };
  }

  /**
   * Daily energy of the quarter that starts on `quarterStart` (the plug keeps daily data per calendar quarter).
   * @param quarterStart Local midnight of the first day of a quarter.
   */
  async getDailyEnergy(quarterStart: Date): Promise<TapoDailyEnergy> {
    const timestamp = Math.floor(quarterStart.getTime() / 1000);
    const result = await this.request<{ start_timestamp: number; data: number[]; interval: number }>('get_energy_data', {
      start_timestamp: timestamp, end_timestamp: timestamp, interval: 1440,
    });
    if (!Array.isArray(result.data) || result.interval !== 1440) throw new TapoError('protocol', 'unexpected energy data');
    return { startTimestamp: result.start_timestamp, dailyWh: result.data };
  }
}
