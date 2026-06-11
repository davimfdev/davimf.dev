// src/lib/ticketCrypto.ts
export interface EncryptedBundle {
  guildName: string;
  channelName: string;
  saltKey: string;
  saltHash: string;
  iv: string;
  ciphertext: string;
  passwordHash: string;
  iterations: number;
}

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const km = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, km, 256);
  return new Uint8Array(bits);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Returns the decrypted plaintext JSON string. Throws Error('WRONG_PASSWORD') or Error('CORRUPT'). */
export async function decryptBundle(d: EncryptedBundle, password: string): Promise<string> {
  const hash = await pbkdf2(password, b64(d.saltHash), d.iterations);
  if (!timingSafeEqual(hash, b64(d.passwordHash))) throw new Error('WRONG_PASSWORD');
  try {
    const keyBits = await pbkdf2(password, b64(d.saltKey), d.iterations);
    const key = await crypto.subtle.importKey('raw', keyBits, 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(d.iv) }, key, b64(d.ciphertext));
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error('CORRUPT');
  }
}
