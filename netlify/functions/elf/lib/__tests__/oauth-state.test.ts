import { describe, it, expect } from 'vitest';
import { signToken } from '../crypto';
import { isSafeReturnTo, createOAuthState, readOAuthState } from '../oauth-state';

describe('isSafeReturnTo', () => {
  it('aceita caminho relativo', () => {
    expect(isSafeReturnTo('/contas')).toBe(true);
  });
  it('aceita caminho com query', () => {
    expect(isSafeReturnTo('/contas?filtro=ativas')).toBe(true);
  });
  it('recusa URL absoluta', () => {
    expect(isSafeReturnTo('https://evil.example')).toBe(false);
  });
  it('recusa protocol-relative', () => {
    expect(isSafeReturnTo('//evil.example')).toBe(false);
  });
  it('recusa barra invertida', () => {
    expect(isSafeReturnTo('/\\evil.example')).toBe(false);
  });
  it('recusa string vazia', () => {
    expect(isSafeReturnTo('')).toBe(false);
  });
  it('recusa caminho que não começa com barra', () => {
    expect(isSafeReturnTo('contas')).toBe(false);
  });
});

describe('readOAuthState', () => {
  it('aceita state que casa com o cookie', () => {
    const state = createOAuthState('/contas');
    expect(readOAuthState(state, state)).toEqual({ returnTo: '/contas' });
  });
  it('troca returnTo perigoso pela raiz', () => {
    const state = createOAuthState('https://evil.example');
    expect(readOAuthState(state, state)).toEqual({ returnTo: '/' });
  });
  it('recusa quando o cookie diverge', () => {
    expect(readOAuthState(createOAuthState('/a'), createOAuthState('/b'))).toBeNull();
  });
  it('recusa sem cookie', () => {
    expect(readOAuthState(createOAuthState('/a'), null)).toBeNull();
  });
  it('recusa sem state na query', () => {
    expect(readOAuthState(null, createOAuthState('/a'))).toBeNull();
  });
  it('recusa state adulterado', () => {
    const state = createOAuthState('/a');
    expect(readOAuthState(`${state}x`, `${state}x`)).toBeNull();
  });
  it('recusa payload assinado que não é JSON', () => {
    const state = signToken(Buffer.from('não é json').toString('base64url'));
    expect(readOAuthState(state, state)).toBeNull();
  });
});
