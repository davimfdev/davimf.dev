import { describe, expect, it } from 'vitest';
import {
  assertCents,
  centsToDecimalString,
  decimalToCents,
  formatMoney,
  multiplyCents,
} from '../domain/money';

describe('dinheiro em centavos', () => {
  it('recusa valor fracionário — nenhum float entra no domínio', () => {
    expect(() => assertCents(15.5)).toThrow(RangeError);
    expect(() => assertCents(-1)).toThrow(RangeError);
    expect(() => assertCents('1500' as unknown as number)).toThrow(RangeError);
  });

  it('converte centavos para o decimal que o provider espera', () => {
    expect(centsToDecimalString(3500)).toBe('35.00');
    expect(centsToDecimalString(1)).toBe('0.01');
    expect(centsToDecimalString(100005)).toBe('1000.05');
  });

  it('volta do decimal do provider sem perder centavo', () => {
    expect(decimalToCents('35.00')).toBe(3500);
    expect(decimalToCents(0.1 + 0.2)).toBe(30);
    expect(decimalToCents('1000.05')).toBe(100005);
  });

  it('mantém a ida e volta estável', () => {
    for (const cents of [0, 1, 99, 100, 3500, 123456789]) {
      expect(decimalToCents(centsToDecimalString(cents))).toBe(cents);
    }
  });

  it('formata em BRL para e-mail e UI', () => {
    expect(formatMoney(3500)).toBe('R$ 35,00');
    expect(formatMoney(100005)).toBe('R$ 1.000,05');
  });

  it('multiplica só por quantidade inteira positiva', () => {
    expect(multiplyCents(3500, 3)).toBe(10500);
    expect(() => multiplyCents(3500, 0)).toThrow(RangeError);
    expect(() => multiplyCents(3500, 1.5)).toThrow(RangeError);
  });
});
