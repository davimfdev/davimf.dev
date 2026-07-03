import { beforeEach, describe, expect, it } from 'vitest';
import { createOAuthState, validateOAuthState } from '../oauthState';

describe('Discord OAuth state', () => {
  beforeEach(() => {
    process.env.DASHBOARD_SESSION_SECRET = '0123456789abcdef0123456789abcdef';
  });

  it('accepts the matching state before expiry', () => {
    const state = createOAuthState('/dashboard/g1', 1_000);
    expect(validateOAuthState(state, state, 1_000 + 9 * 60_000)).toEqual({ returnTo: '/dashboard/g1' });
  });

  it('rejects missing state', () => {
    expect(validateOAuthState(null, null, 1_000)).toBeNull();
  });

  it('rejects mismatched state', () => {
    expect(validateOAuthState('one', 'two', 1_000)).toBeNull();
  });

  it('rejects expired state', () => {
    const state = createOAuthState('/dashboard', 1_000);
    expect(validateOAuthState(state, state, 1_000 + 11 * 60_000)).toBeNull();
  });

  it('normalizes unsafe return paths', () => {
    const state = createOAuthState('https://evil.example', 1_000);
    expect(validateOAuthState(state, state, 1_001)).toEqual({ returnTo: '/dashboard' });
  });
});
