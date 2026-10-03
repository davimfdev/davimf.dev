import { describe, it, expect, vi, afterEach } from 'vitest';
import { hashToken, signToken, verifySignedToken, randomToken } from '../crypto';

afterEach(() => vi.unstubAllEnvs());

describe('hashToken', () => {
  it('é determinístico', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });
  it('difere para entradas diferentes', () => {
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
  it('nunca devolve a entrada em claro', () => {
    expect(hashToken('valor-original')).not.toContain('valor-original');
  });
});

describe('signToken / verifySignedToken', () => {
  it('roundtrip devolve o id original', () => {
    const id = randomToken();
    expect(verifySignedToken(signToken(id))).toBe(id);
  });
  it('recusa assinatura adulterada', () => {
    expect(verifySignedToken(`${signToken('meu-id')}x`)).toBeNull();
  });
  it('recusa id adulterado', () => {
    const [, assinatura] = signToken('meu-id').split('.');
    expect(verifySignedToken(`outro-id.${assinatura}`)).toBeNull();
  });
  it('recusa valor sem separador', () => {
    expect(verifySignedToken('semponto')).toBeNull();
  });
  it('recusa string vazia', () => {
    expect(verifySignedToken('')).toBeNull();
  });
  it('recusa assinatura feita com outra chave', () => {
    const assinado = signToken('meu-id');
    vi.stubEnv('ELF_SESSION_SECRET', 'z'.repeat(48));
    expect(verifySignedToken(assinado)).toBeNull();
  });
});

describe('randomToken', () => {
  it('gera valores distintos', () => {
    expect(randomToken()).not.toBe(randomToken());
  });
  it('usa alfabeto base64url', () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('configuração', () => {
  it('recusa chave curta demais', () => {
    vi.stubEnv('ELF_SESSION_SECRET', 'curto');
    expect(() => signToken('x')).toThrow('ELF_SESSION_SECRET');
  });
});
