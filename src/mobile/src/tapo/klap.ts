// KLAP v2 – the local protocol of TP-Link Tapo plugs (P110/P115) on port 80. Not documented by TP-Link; this follows
// the open-source python-kasa implementation (kasa/transports/klaptransport.py) and is verified against vectors computed
// with it (klap.test.ts). Pure functions – no network, no native modules.
//
// handshake1: client sends 16 random bytes (local seed); the plug answers remote seed (16) + sha256(local+remote+auth).
// handshake2: client proves the same auth hash with sha256(remote+local+auth) and the session cookie.
// requests:   AES-128-CBC with a key/IV derived from both seeds and the auth hash; the IV ends with a sequence number
//             incremented per request and every message is signed with sha256(sig + seq + ciphertext).

import { cbc } from '@noble/ciphers/aes';
import { sha1 } from '@noble/hashes/sha1';
import { sha256 } from '@noble/hashes/sha256';

import { utf8Decode, utf8Encode } from './bytes';

/** Joins byte arrays. */
export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** UTF-8 bytes of a text. */
const utf8 = utf8Encode;

/** Big-endian signed 32-bit integer. */
function int32be(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setInt32(0, value, false);
  return out;
}

/** Constant-time comparison of two hashes. */
export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/**
 * Hash of the Tapo account credentials the plug knows: sha256(sha1(e-mail) + sha1(password)).
 * @param username Tapo account e-mail.
 * @param password Tapo account password.
 */
export function authHash(username: string, password: string): Uint8Array {
  return sha256(concat(sha1(utf8(username)), sha1(utf8(password))));
}

/** Value the plug must return in handshake1 when it knows the same credentials. */
export const handshake1Hash = (local: Uint8Array, remote: Uint8Array, auth: Uint8Array) => sha256(concat(local, remote, auth));

/** Body of handshake2. */
export const handshake2Payload = (local: Uint8Array, remote: Uint8Array, auth: Uint8Array) => sha256(concat(remote, local, auth));

/** Encrypted session established after the handshake. */
export class KlapSession {
  private readonly key: Uint8Array;
  private readonly ivBase: Uint8Array;
  private readonly sig: Uint8Array;
  /** Sequence number of the last request (starts at the value derived from the seeds). */
  seq: number;

  /**
   * Derives the session keys.
   * @param local Local seed sent in handshake1.
   * @param remote Remote seed received in handshake1.
   * @param auth Credentials hash.
   */
  constructor(local: Uint8Array, remote: Uint8Array, auth: Uint8Array) {
    this.key = sha256(concat(utf8('lsk'), local, remote, auth)).slice(0, 16);
    const fullIv = sha256(concat(utf8('iv'), local, remote, auth));
    this.ivBase = fullIv.slice(0, 12);
    this.seq = new DataView(fullIv.buffer, fullIv.byteOffset + 28, 4).getInt32(0, false);
    this.sig = sha256(concat(utf8('ldk'), local, remote, auth)).slice(0, 28);
  }

  /** IV of a request: 12 derived bytes + the sequence number. */
  private iv(seq: number): Uint8Array {
    return concat(this.ivBase, int32be(seq));
  }

  /**
   * Encrypts and signs a request; increments the sequence number.
   * @param message JSON text of the request.
   * @returns Body to send and the sequence number for the `seq` query parameter.
   */
  encrypt(message: string): { payload: Uint8Array; seq: number } {
    this.seq = (this.seq + 1) | 0;
    const ciphertext = cbc(this.key, this.iv(this.seq)).encrypt(utf8(message));
    const signature = sha256(concat(this.sig, int32be(this.seq), ciphertext));
    return { payload: concat(signature, ciphertext), seq: this.seq };
  }

  /**
   * Verifies the signature of a response and decrypts it.
   * @param payload Response body (32-byte signature + AES blocks).
   * @param seq Sequence number of the request it answers.
   * @throws When the signature does not match (wrong session or tampered data).
   */
  decrypt(payload: Uint8Array, seq: number): string {
    if (payload.length < 48 || (payload.length - 32) % 16 !== 0) throw new Error('Not a KLAP message');
    const ciphertext = payload.slice(32);
    if (!equalBytes(payload.slice(0, 32), sha256(concat(this.sig, int32be(seq), ciphertext)))) throw new Error('Invalid KLAP signature');
    return utf8Decode(cbc(this.key, this.iv(seq)).decrypt(ciphertext));
  }
}
