// src/lib/ticketCrypto.test.ts
import { describe, it, expect } from 'vitest';
import { decryptBundle, type EncryptedBundle } from './ticketCrypto';

const ITER = 210000;
const b64e = (u: Uint8Array) => Buffer.from(u).toString('base64');

async function pbkdf2(password: string, salt: Uint8Array) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, km, 256);
  return new Uint8Array(bits);
}

async function makeBundle(plain: string, password: string): Promise<EncryptedBundle> {
  const saltKey = crypto.getRandomValues(new Uint8Array(16));
  const saltHash = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyBits = await pbkdf2(password, saltKey);
  const key = await crypto.subtle.importKey('raw', keyBits, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)));
  const passwordHash = await pbkdf2(password, saltHash);
  return {
    guildName: 'G', channelName: 'c', iterations: ITER,
    saltKey: b64e(saltKey), saltHash: b64e(saltHash), iv: b64e(iv),
    ciphertext: b64e(ct), passwordHash: b64e(passwordHash),
  };
}

describe('decryptBundle', () => {
  it('decrypts with correct password', async () => {
    const b = await makeBundle('{"oi":"çãé😀"}', 'senha123');
    expect(await decryptBundle(b, 'senha123')).toBe('{"oi":"çãé😀"}');
  });
  it('throws WRONG_PASSWORD on bad password', async () => {
    const b = await makeBundle('dados', 'certa');
    await expect(decryptBundle(b, 'errada')).rejects.toThrow('WRONG_PASSWORD');
  });
});
