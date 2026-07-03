import { describe, it, expect } from 'vitest';
import { allowedOrigin } from '../cors';

const ev = (method: string, headers: Record<string, string> = {}) =>
  ({ httpMethod: method, headers } as any);

describe('allowedOrigin', () => {
  it('permite GET sem checar origin', () => {
    expect(allowedOrigin(ev('GET'))).toBe(true);
  });
  it('permite POST do domínio oficial', () => {
    expect(allowedOrigin(ev('POST', { origin: 'https://davimf.dev' }))).toBe(true);
  });
  it('bloqueia POST de origin estranho', () => {
    expect(allowedOrigin(ev('POST', { origin: 'https://evil.example' }))).toBe(false);
  });
  it('bloqueia POST sem origin nem referer', () => {
    expect(allowedOrigin(ev('POST'))).toBe(false);
  });
  it('aceita referer quando origin ausente', () => {
    expect(allowedOrigin(ev('PUT', { referer: 'https://davimf.dev/dashboard' }))).toBe(true);
  });
});
