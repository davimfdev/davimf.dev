import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type PayerProfileSensitiveData = {
  phone?: string;
  identification: {
    type: string;
    number: string;
  };
  address: {
    zipCode: string;
    streetName: string;
    streetNumber: string;
    neighborhood: string;
    city: string;
    state: string;
    complement?: string;
  };
};

function payerEncryptionKey(): Buffer | null {
  const encoded = process.env.PAYMENTS_PAYER_ENCRYPTION_KEY;
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) return null;

  const key = Buffer.from(encoded, 'base64');
  return key.length === 32 && key.toString('base64') === encoded ? key : null;
}

/** Whether payer profiles can be safely persisted with the configured key. */
export function payerProfilePersistenceAvailable(): boolean {
  return payerEncryptionKey() !== null;
}

function encodeBase64Url(value: Buffer): string {
  return value.toString('base64url');
}

function decodeBase64Url(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const decoded = Buffer.from(value, 'base64url');
    return encodeBase64Url(decoded) === value ? decoded : null;
  } catch {
    return null;
  }
}

function isSensitiveData(value: unknown): value is PayerProfileSensitiveData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const identification = candidate.identification;
  const address = candidate.address;
  if (!identification || typeof identification !== 'object' || Array.isArray(identification)) return false;
  if (!address || typeof address !== 'object' || Array.isArray(address)) return false;

  const identity = identification as Record<string, unknown>;
  const location = address as Record<string, unknown>;
  const addressFields = ['zipCode', 'streetName', 'streetNumber', 'neighborhood', 'city', 'state'];
  return (
    (candidate.phone === undefined || typeof candidate.phone === 'string') &&
    typeof identity.type === 'string' &&
    typeof identity.number === 'string' &&
    addressFields.every((field) => typeof location[field] === 'string') &&
    (location.complement === undefined || typeof location.complement === 'string')
  );
}

/** Encrypts every payer detail that must never be stored as a plaintext SQL value. */
export function encryptPayerProfileSensitive(data: PayerProfileSensitiveData): string {
  const key = payerEncryptionKey();
  if (!key) throw new Error('Payer profile encryption unavailable.');

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${encodeBase64Url(iv)}.${encodeBase64Url(ciphertext)}.${encodeBase64Url(tag)}`;
}

/** Decrypts an authenticated payer-profile envelope, never surfacing its contents on failure. */
export function decryptPayerProfileSensitive(envelope: string): PayerProfileSensitiveData {
  try {
    const key = payerEncryptionKey();
    const parts = envelope.split('.');
    if (!key || parts.length !== 4 || parts[0] !== 'v1') throw new Error();
    const iv = decodeBase64Url(parts[1]);
    const ciphertext = decodeBase64Url(parts[2]);
    const tag = decodeBase64Url(parts[3]);
    if (!iv || !ciphertext || !tag || iv.length !== 12 || tag.length !== 16) throw new Error();

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decoded = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const parsed: unknown = JSON.parse(decoded);
    if (!isSensitiveData(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error('Payer profile decryption failed.');
  }
}
