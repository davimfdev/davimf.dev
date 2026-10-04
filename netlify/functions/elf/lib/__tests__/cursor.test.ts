import { describe, it, expect } from 'vitest';
import { ApiError } from '../http';
import { encodeCursor, decodeCursor, parseLimit } from '../cursor';

const valido = { date: '2026-07-30', id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' };
const cru = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString('base64url');

describe('decodeCursor', () => {
  it('roundtrip devolve os mesmos valores', () => {
    expect(decodeCursor(encodeCursor(valido))).toEqual(valido);
  });
  it('devolve null quando não há cursor', () => {
    expect(decodeCursor(null)).toBeNull();
  });
  it('recusa base64 que não decodifica em JSON', () => {
    expect(() => decodeCursor('!!!nao-e-base64!!!')).toThrow(ApiError);
  });
  it('recusa JSON inválido', () => {
    expect(() => decodeCursor(Buffer.from('nao-e-json').toString('base64url'))).toThrow(ApiError);
  });
  it('recusa versão desconhecida', () => {
    expect(() => decodeCursor(cru({ v: 2, d: valido.date, i: valido.id }))).toThrow(ApiError);
  });
  it('recusa data em outro formato', () => {
    expect(() => decodeCursor(cru({ v: 1, d: '30/07/2026', i: valido.id }))).toThrow(ApiError);
  });
  it('recusa data impossível', () => {
    expect(() => decodeCursor(cru({ v: 1, d: '2026-02-31', i: valido.id }))).toThrow(ApiError);
  });
  it('recusa UUID inválido', () => {
    expect(() => decodeCursor(cru({ v: 1, d: valido.date, i: 'nao-e-uuid' }))).toThrow(ApiError);
  });
  it('recusa campo faltando', () => {
    expect(() => decodeCursor(cru({ v: 1, d: valido.date }))).toThrow(ApiError);
  });
  it('recusa campo extra', () => {
    expect(() => decodeCursor(cru({ v: 1, d: valido.date, i: valido.id, extra: 1 }))).toThrow(
      ApiError,
    );
  });
  it('recusa cursor acima de 512 caracteres', () => {
    expect(() => decodeCursor('a'.repeat(513))).toThrow(ApiError);
  });
  it('usa o código CURSOR_INVALID com status 400', () => {
    expect(() => decodeCursor('invalido')).toThrow(
      expect.objectContaining({ code: 'CURSOR_INVALID', status: 400 }),
    );
  });
});

describe('parseLimit', () => {
  it('usa 50 por padrão', () => {
    expect(parseLimit(null)).toBe(50);
  });
  it('aceita valor dentro da faixa', () => {
    expect(parseLimit('100')).toBe(100);
  });
  it('aceita exatamente 200', () => {
    expect(parseLimit('200')).toBe(200);
  });
  it('recusa acima do máximo em vez de cortar em silêncio', () => {
    expect(() => parseLimit('201')).toThrow(ApiError);
  });
  it('recusa zero', () => {
    expect(() => parseLimit('0')).toThrow(ApiError);
  });
  it('recusa fracionário', () => {
    expect(() => parseLimit('10.5')).toThrow(ApiError);
  });
  it('recusa texto', () => {
    expect(() => parseLimit('muitos')).toThrow(ApiError);
  });
});
