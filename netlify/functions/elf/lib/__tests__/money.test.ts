import { describe, it, expect } from 'vitest';
import { parseDatabaseCents, toCents, MAX_SAFE_CENTS } from '../money';

describe('parseDatabaseCents', () => {
  it('converte string de BIGINT', () => {
    expect(parseDatabaseCents('2590')).toBe(2590);
  });
  it('converte string negativa', () => {
    expect(parseDatabaseCents('-2590')).toBe(-2590);
  });
  it('aceita number inteiro seguro', () => {
    expect(parseDatabaseCents(2590)).toBe(2590);
  });
  it('rejeita number fracionário', () => {
    expect(() => parseDatabaseCents(2590.5)).toThrow();
  });
  it('rejeita string com decimal', () => {
    expect(() => parseDatabaseCents('25.90')).toThrow();
  });
  it('rejeita texto', () => {
    expect(() => parseDatabaseCents('abc')).toThrow();
  });
  it('rejeita string vazia', () => {
    expect(() => parseDatabaseCents('')).toThrow();
  });
  it('rejeita null', () => {
    expect(() => parseDatabaseCents(null)).toThrow();
  });
  it('rejeita undefined', () => {
    expect(() => parseDatabaseCents(undefined)).toThrow();
  });
  it('rejeita valor acima da faixa segura', () => {
    expect(() => parseDatabaseCents('9007199254740993')).toThrow();
  });
  it('aceita exatamente o limite', () => {
    expect(parseDatabaseCents(String(MAX_SAFE_CENTS))).toBe(MAX_SAFE_CENTS);
  });
});

describe('toCents', () => {
  it('aceita inteiro', () => {
    expect(toCents(100)).toBe(100);
  });
  it('rejeita fracionário', () => {
    expect(() => toCents(10.5)).toThrow();
  });
  it('rejeita acima do limite', () => {
    expect(() => toCents(MAX_SAFE_CENTS + 2)).toThrow();
  });
});
