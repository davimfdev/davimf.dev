import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

// Sem 0/O, 1/I/L: o código é lido numa tela e digitado em outra.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export const PAIRING_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/;

export function generatePairingCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET.charAt(randomInt(CODE_ALPHABET.length));
  }
  return code;
}

export function normalizeCode(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

export function formatCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

function secretFrom(name: 'ELF_PAIRING_SIGNING_SECRET' | 'ELF_PAIRING_ENCRYPTION_SECRET'): Buffer {
  const value = process.env[name];
  if (!value || Buffer.byteLength(value, 'utf8') < 32) {
    throw new Error(`${name} precisa de no mínimo 32 bytes`);
  }
  return Buffer.from(value, 'utf8');
}

export function generatePollToken(): string {
  return randomBytes(32).toString('base64url');
}

function pollSignature(token: string): string {
  return createHmac('sha256', secretFrom('ELF_PAIRING_SIGNING_SECRET'))
    .update(token, 'utf8')
    .digest('base64url');
}

export function signPollToken(token: string): string {
  return `${token}.${pollSignature(token)}`;
}

/** Devolve o token, ou `null` se a assinatura não confere. */
export function verifyPollToken(value: string): string | null {
  const separator = value.lastIndexOf('.');
  if (separator <= 0) return null;
  const token = value.slice(0, separator);
  const provided = Buffer.from(value.slice(separator + 1), 'utf8');
  const expected = Buffer.from(pollSignature(token), 'utf8');
  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? token : null;
}

/** Chave derivada por HKDF, nunca o segredo cru. Segredo separado da assinatura. */
function encryptionKey(): Buffer {
  return Buffer.from(
    hkdfSync('sha256', secretFrom('ELF_PAIRING_ENCRYPTION_SECRET'), 'elf-pairing-v1', 'session-ciphertext', 32),
  );
}

/**
 * Cifra o token de sessão enquanto ele espera a coleta. AES-256-GCM só é
 * decifrável e verificável com o IV e a tag, então os três viajam juntos. A AAD
 * amarra o ciphertext à linha de pareamento: movê-lo para outra linha faz a
 * decifragem falhar.
 */
export function encryptSessionToken(plaintext: string, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
  ].join('.');
}

export function decryptSessionToken(payload: string, aad: string): string {
  const [version, iv, ciphertext, tag, ...rest] = payload.split('.');
  if (version !== 'v1' || !iv || !ciphertext || !tag || rest.length > 0) {
    throw new Error('Payload de pareamento inválido');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
