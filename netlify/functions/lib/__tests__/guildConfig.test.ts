import { describe, it, expect } from 'vitest';
import { sanitizePatch } from '../guildConfig';

describe('sanitizePatch', () => {
  it('mantém só chaves permitidas de channels', () => {
    const out = sanitizePatch('channels', { 'log-mensagens': '1', 'chave-invalida': '2' });
    expect(out).toEqual({ 'log-mensagens': '1' });
  });
  it('mantém só toggles conhecidos', () => {
    const out = sanitizePatch('toggles', { 'sec:automod': true, 'nope': false });
    expect(out).toEqual({ 'sec:automod': true });
  });
  it('rejeita coluna desconhecida', () => {
    expect(() => sanitizePatch('dashboard_access' as any, { users: [] })).toThrow();
  });
});
