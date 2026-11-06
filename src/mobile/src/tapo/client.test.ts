import { utf8Decode, utf8Encode } from './bytes';
import { parseSessionCookie, TapoClient, TapoError, tapoErrorMessage, type TapoTransport } from './client';
import { authHash, handshake1Hash, handshake2Payload, KlapSession, equalBytes } from './klap';

/** Simulated plug speaking KLAP (the other side of the protocol), with the account it is bound to. */
function fakePlug(options: { email?: string; password?: string; handlers?: Record<string, (params: unknown) => unknown>; tamper?: boolean } = {}) {
  const auth = authHash(options.email ?? 'jan@example.com', options.password ?? 'Haslo123!');
  const remote = Uint8Array.from({ length: 16 }, (_, i) => 200 - i);
  let local: Uint8Array | null = null;
  let session: KlapSession | null = null;
  const requests: { method: string; params?: unknown }[] = [];
  const handlers: Record<string, (params: unknown) => unknown> = {
    get_device_info: () => ({ device_id: 'ABC123', model: 'P110', nickname: Buffer.from('Pralka łazienka').toString('base64') }),
    ...options.handlers,
  };

  const transport: TapoTransport = {
    async post(url, body, cookie) {
      const path = url.replace(/^http:\/\/[^/]+\/app\//, '');
      if (path === 'handshake1') {
        local = body;
        return { status: 200, body: Uint8Array.from([...remote, ...handshake1Hash(local, remote, auth)]), setCookie: 'TP_SESSIONID=S3SS10N;TIMEOUT=86400' };
      }
      if (path === 'handshake2') {
        if (cookie !== 'TP_SESSIONID=S3SS10N' || !local || !equalBytes(body, handshake2Payload(local, remote, auth))) return { status: 403, body: new Uint8Array(), setCookie: null };
        session = new KlapSession(local, remote, auth);
        return { status: 200, body: new Uint8Array(), setCookie: null };
      }
      const seq = Number(/seq=(-?\d+)/.exec(path)![1]);
      const request = JSON.parse(session!.decrypt(body, seq)) as { method: string; params?: unknown };
      requests.push(request);
      const handler = handlers[request.method];
      const reply = handler ? { error_code: 0, result: handler(request.params) } : { error_code: -1 };
      session!.seq = seq - 1; // the plug answers with the sequence number of the request
      const { payload } = session!.encrypt(JSON.stringify(reply));
      if (options.tamper) payload[40] = (payload[40] ?? 0) ^ 1;
      return { status: 200, body: payload, setCookie: null };
    },
  };
  return { transport, requests };
}

const random = (n: number) => Uint8Array.from({ length: n }, (_, i) => i * 7);

test('connects, reads device info and decodes the Tapo nickname', async () => {
  const plug = fakePlug();
  const client = new TapoClient('192.168.1.50', ' jan@example.com ', 'Haslo123!', plug.transport, random);

  expect(await client.getDeviceInfo()).toEqual({ deviceId: 'ABC123', model: 'P110', nickname: 'Pralka łazienka', hasEnergyMonitoring: true });
  expect(plug.requests).toEqual([{ method: 'get_device_info' }]);
});

test('asks for the daily history of a quarter from local midnight', async () => {
  const plug = fakePlug({ handlers: { get_energy_data: () => ({ start_timestamp: 1782856800, interval: 1440, data: [1200, 950] }) } });
  const client = new TapoClient('10.0.0.2', 'jan@example.com', 'Haslo123!', plug.transport, random);
  const quarter = new Date(2026, 9, 1);

  expect(await client.getDailyEnergy(quarter)).toEqual({ startTimestamp: 1782856800, dailyWh: [1200, 950] });
  const ts = quarter.getTime() / 1000;
  expect(plug.requests[0]).toEqual({ method: 'get_energy_data', params: { start_timestamp: ts, end_timestamp: ts, interval: 1440 } });
});

test('wrong Tapo password, device errors and tampered answers have their own errors', async () => {
  await expect(new TapoClient('h', 'jan@example.com', 'zle', fakePlug().transport, random).getDeviceInfo())
    .rejects.toMatchObject({ kind: 'credentials' });
  await expect(new TapoClient('h', 'jan@example.com', 'Haslo123!', fakePlug().transport, random).request('unknown_method'))
    .rejects.toMatchObject({ kind: 'device' });
  await expect(new TapoClient('h', 'jan@example.com', 'Haslo123!', fakePlug({ tamper: true }).transport, random).getDeviceInfo())
    .rejects.toMatchObject({ kind: 'protocol' });
});

test('plugs with other firmware (no KLAP) are reported as protocol errors', async () => {
  const transport: TapoTransport = { post: async () => ({ status: 404, body: utf8Encode('<html>'), setCookie: null }) };
  await expect(new TapoClient('h', 'a', 'b', transport, random).connect()).rejects.toMatchObject({ kind: 'protocol' });
  const shortBody: TapoTransport = { post: async () => ({ status: 200, body: new Uint8Array(10), setCookie: null }) };
  await expect(new TapoClient('h', 'a', 'b', shortBody, random).connect()).rejects.toMatchObject({ kind: 'protocol' });
});

test('session cookie parsing and friendly messages', () => {
  expect(parseSessionCookie('TP_SESSIONID=ABC;TIMEOUT=86400')).toBe('TP_SESSIONID=ABC');
  expect(parseSessionCookie(null)).toBeNull();
  expect(tapoErrorMessage(new TapoError('unreachable', 'x'))).toMatch(/tej samej sieci Wi-Fi/);
  expect(tapoErrorMessage(new TapoError('credentials', 'x'))).toMatch(/e-mail i hasło/);
  expect(tapoErrorMessage(new TapoError('protocol', 'x'))).toMatch(/TPAP/);
  expect(tapoErrorMessage(new TapoError('device', 'kod -1'))).toMatch(/kod -1/);
  expect(tapoErrorMessage(new Error('?'))).toBe('Nie udało się połączyć z gniazdkiem.');
  expect(utf8Decode(utf8Encode('ok'))).toBe('ok');
});
