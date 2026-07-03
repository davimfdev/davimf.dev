import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

function sessionSecret(): Buffer {
  const value = process.env.DASHBOARD_SESSION_SECRET;
  if (!value || Buffer.byteLength(value, 'utf8') < 32) {
    throw new Error('DASHBOARD_SESSION_SECRET must contain at least 32 bytes');
  }
  return Buffer.from(value, 'utf8');
}

function encryptionKey(): Buffer {
  const value = process.env.DASHBOARD_TOKEN_ENCRYPTION_KEY;
  if (!value) throw new Error('DASHBOARD_TOKEN_ENCRYPTION_KEY is required');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new Error('DASHBOARD_TOKEN_ENCRYPTION_KEY must be 32 bytes encoded as base64');
  }
  return key;
}

export function hashSessionId(id: string): string {
  return createHash('sha256').update(id, 'utf8').digest('hex');
}

export function signSessionId(id: string): string {
  const signature = createHmac('sha256', sessionSecret()).update(id, 'utf8').digest('base64url');
  return `${id}.${signature}`;
}

export function verifySessionCookie(value: string): string | null {
  const separator = value.lastIndexOf('.');
  if (separator <= 0) return null;
  const id = value.slice(0, separator);
  const provided = value.slice(separator + 1);
  const expected = createHmac('sha256', sessionSecret()).update(id, 'utf8').digest('base64url');
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

export function encryptToken(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptToken(value: string): string {
  const [ivValue, tagValue, encryptedValue, extra] = value.split('.');
  if (!ivValue || !tagValue || !encryptedValue || extra) throw new Error('Invalid encrypted token');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
