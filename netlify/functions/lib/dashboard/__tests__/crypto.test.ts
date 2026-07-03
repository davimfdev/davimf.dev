import { beforeEach, describe, expect, it } from 'vitest';
import {
  decryptToken,
  encryptToken,
  hashSessionId,
  signSessionId,
  verifySessionCookie,
} from '../crypto';

describe('dashboard session crypto', () => {
  beforeEach(() => {
    process.env.DASHBOARD_SESSION_SECRET = '0123456789abcdef0123456789abcdef';
    process.env.DASHBOARD_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  });

  it('signs and verifies an opaque session id', () => {
    const signed = signSessionId('opaque-id');
    expect(signed).not.toBe('opaque-id');
    expect(verifySessionCookie(signed)).toBe('opaque-id');
  });

  it('rejects a tampered session cookie', () => {
    const signed = signSessionId('opaque-id');
    expect(verifySessionCookie(`${signed}x`)).toBeNull();
  });

  it('encrypts Discord tokens with authenticated encryption', () => {
    const encrypted = encryptToken('discord-access-token');
    expect(encrypted).not.toContain('discord-access-token');
    expect(decryptToken(encrypted)).toBe('discord-access-token');
  });

  it('hashes the lookup id without storing it in plaintext', () => {
    expect(hashSessionId('opaque-id')).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionId('opaque-id')).not.toContain('opaque-id');
  });
});
