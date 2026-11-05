import { authHash, handshake1Hash, handshake2Payload, KlapSession } from './klap';

// Vectors computed with the python-kasa algorithm (hashlib + cryptography), not with this code:
// user "jan@example.com", password "Haslo123!", local seed 00..0f, remote seed 64..73.
const V = {
  auth: '3d186103b294c7b82e2a3fc50f2f4759fe8c40434828a78dad1e14b1105442fe',
  h1: 'e174a9e54063bcc0ab1230f201fa35ea11493ffd2d8b8d4430cbef3b7ecbbcb0',
  h2: 'ed888552e8e9d3bd3443c6aef8c3fb0856a38cfc202fc4c7bf449cbc44188208',
  seqStart: 653890725,
  message: '{"method":"get_device_info"}',
  payload: '941004ab44d5d03256be80cf3618f36ef41d296db887f8c73da9a3aa2c8c6391b6da770c2ff82cdbea696b0f991262c2da1ccb833c6ce23bded8b8fdc50b43c1',
};
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const bytes = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));
const local = Uint8Array.from({ length: 16 }, (_, i) => i);
const remote = Uint8Array.from({ length: 16 }, (_, i) => 100 + i);

test('handshake hashes match python-kasa', () => {
  const auth = authHash('jan@example.com', 'Haslo123!');
  expect(hex(auth)).toBe(V.auth);
  expect(hex(handshake1Hash(local, remote, auth))).toBe(V.h1);
  expect(hex(handshake2Payload(local, remote, auth))).toBe(V.h2);
});

test('session derives the sequence, encrypts and signs like python-kasa', () => {
  const session = new KlapSession(local, remote, authHash('jan@example.com', 'Haslo123!'));
  expect(session.seq).toBe(V.seqStart);

  const { payload, seq } = session.encrypt(V.message);
  expect(seq).toBe(V.seqStart + 1);
  expect(hex(payload)).toBe(V.payload);
  // The plug signs its answer the same way, so our own request decrypts as a valid response.
  expect(session.decrypt(payload, seq)).toBe(V.message);
});

test('tampered or foreign messages are rejected', () => {
  const session = new KlapSession(local, remote, authHash('jan@example.com', 'Haslo123!'));
  const tampered = bytes(V.payload);
  tampered[40] = (tampered[40] ?? 0) ^ 1;
  expect(() => session.decrypt(tampered, V.seqStart + 1)).toThrow('Invalid KLAP signature');
  expect(() => session.decrypt(bytes(V.payload), V.seqStart + 2)).toThrow('Invalid KLAP signature');
  expect(() => session.decrypt(new Uint8Array(20), 1)).toThrow('Not a KLAP message');
});

test('the sequence number wraps like a signed 32-bit integer', () => {
  const session = new KlapSession(local, remote, authHash('a', 'b'));
  session.seq = 2147483647;
  expect(session.encrypt('{}').seq).toBe(-2147483648);
});
