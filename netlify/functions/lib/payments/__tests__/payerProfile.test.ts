import { afterEach, describe, expect, it } from 'vitest';
import {
  decryptPayerProfileSensitive,
  encryptPayerProfileSensitive,
  payerProfilePersistenceAvailable,
} from '../infrastructure/payerProfileCrypto';
import {
  deletePayerProfile,
  findPayerProfile,
  upsertPayerProfile,
  type PayerProfileData,
} from '../repositories/PayerProfileRepository';
import { FakeSql, uninstallSql } from './helpers';

const SENSITIVE_PROFILE = {
  phone: '+5511999999999',
  identification: { type: 'CPF', number: '12345678909' },
  address: {
    zipCode: '01310100',
    streetName: 'Avenida Paulista',
    streetNumber: '1000',
    neighborhood: 'Bela Vista',
    city: 'Sao Paulo',
    state: 'SP',
    complement: 'Apto 42',
  },
};

const PROFILE: PayerProfileData = {
  firstName: 'Davi',
  lastName: 'Moraes',
  email: 'davi@example.com',
  ...SENSITIVE_PROFILE,
};

describe('payer-profile encryption', () => {
  afterEach(() => {
    delete process.env.PAYMENTS_PAYER_ENCRYPTION_KEY;
    uninstallSql();
  });

  it('is unavailable when the encryption key is missing', () => {
    delete process.env.PAYMENTS_PAYER_ENCRYPTION_KEY;

    expect(payerProfilePersistenceAvailable()).toBe(false);
  });

  it('is unavailable for a base64 key that decodes to 31 bytes', () => {
    process.env.PAYMENTS_PAYER_ENCRYPTION_KEY = Buffer.alloc(31, 1).toString('base64');

    expect(payerProfilePersistenceAvailable()).toBe(false);
  });

  it('is available for a base64 key that decodes to exactly 32 bytes', () => {
    process.env.PAYMENTS_PAYER_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');

    expect(payerProfilePersistenceAvailable()).toBe(true);
  });

  it('round-trips sensitive details without embedding them in the ciphertext', () => {
    process.env.PAYMENTS_PAYER_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

    const ciphertext = encryptPayerProfileSensitive(SENSITIVE_PROFILE);
    const nextCiphertext = encryptPayerProfileSensitive(SENSITIVE_PROFILE);

    expect(ciphertext).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(nextCiphertext).not.toBe(ciphertext);
    expect(ciphertext).not.toContain('12345678909');
    expect(ciphertext).not.toContain('+5511999999999');
    expect(ciphertext).not.toContain('Avenida Paulista');
    expect(decryptPayerProfileSensitive(ciphertext)).toEqual(SENSITIVE_PROFILE);
  });

  it('fails closed without exposing PII when the key changes or ciphertext is tampered', () => {
    process.env.PAYMENTS_PAYER_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    const ciphertext = encryptPayerProfileSensitive(SENSITIVE_PROFILE);
    process.env.PAYMENTS_PAYER_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString('base64');

    expect(() => decryptPayerProfileSensitive(ciphertext)).toThrow('Payer profile decryption failed.');
    process.env.PAYMENTS_PAYER_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    expect(() => decryptPayerProfileSensitive(`${ciphertext}x`)).toThrow('Payer profile decryption failed.');
  });

  it('upserts, finds, and deletes profiles strictly by the owner key', async () => {
    process.env.PAYMENTS_PAYER_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    const sql = new FakeSql();
    let stored: Record<string, unknown> | null = null;
    sql.use([
      {
        match: (query) => query.includes('INSERT INTO payer_profiles'),
        rows: (_query, values) => {
          stored = {
            user_id: values[0],
            first_name: values[1],
            last_name: values[2],
            email: values[3],
            sensitive_ciphertext: values[4],
            cipher_version: 1,
          };
          return [stored];
        },
      },
      {
        match: (query) => query.includes('SELECT') && query.includes('FROM payer_profiles'),
        rows: (_query, values) => {
          const profile = stored;
          return profile && profile.user_id === values[0] ? [profile] : [];
        },
      },
      {
        match: (query) => query.includes('DELETE FROM payer_profiles'),
        rows: (_query, values) => {
          if (stored?.user_id !== values[0]) return [];
          stored = null;
          return [{ user_id: values[0] }];
        },
      },
    ]);
    sql.install();

    await upsertPayerProfile('discord-owner', PROFILE);

    expect(await findPayerProfile('discord-owner')).toEqual(PROFILE);
    expect(await findPayerProfile('another-user')).toBeNull();
    expect(await deletePayerProfile('another-user')).toBe(false);
    expect(await deletePayerProfile('discord-owner')).toBe(true);
    expect(await findPayerProfile('discord-owner')).toBeNull();
  });

  it('binds only ciphertext for CPF, phone, and address data', async () => {
    process.env.PAYMENTS_PAYER_ENCRYPTION_KEY = Buffer.alloc(32, 10).toString('base64');
    const sql = new FakeSql([
      {
        match: (query) => query.includes('INSERT INTO payer_profiles'),
        rows: (_query, values) => [
          {
            user_id: values[0],
            first_name: values[1],
            last_name: values[2],
            email: values[3],
            sensitive_ciphertext: values[4],
            cipher_version: 1,
          },
        ],
      },
    ]);
    sql.install();

    await upsertPayerProfile('discord-owner', PROFILE);

    const boundValues = JSON.stringify(sql.queriesMatching('INSERT INTO payer_profiles')[0].values);
    for (const pii of [
      SENSITIVE_PROFILE.identification.number,
      SENSITIVE_PROFILE.phone,
      ...Object.values(SENSITIVE_PROFILE.address),
    ]) {
      expect(boundValues).not.toContain(pii);
    }
  });
});
