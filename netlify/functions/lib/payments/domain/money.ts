/**
 * Dinheiro SEMPRE em centavos inteiros. Nenhum float atravessa o domínio.
 *
 * O Mercado Pago recebe/devolve valores decimais em string ("50.00"), então a
 * conversão fica confinada aqui e no provider - nunca em regra de negócio.
 */

export type Cents = number;

export function assertCents(value: unknown, field = 'amount'): Cents {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative integer amount in cents`);
  }
  return value;
}

/** 1500 -> "15.00". String, porque o provider espera decimal exato. */
export function centsToDecimalString(cents: Cents): string {
  assertCents(cents);
  const units = Math.floor(cents / 100);
  const rest = cents % 100;
  return `${units}.${String(rest).padStart(2, '0')}`;
}

/** "15.00" | 15 | 15.5 -> 1500. Arredonda ao centavo mais próximo. */
export function decimalToCents(value: string | number): Cents {
  const numeric = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new RangeError(`Invalid monetary value: ${String(value)}`);
  }
  return Math.round(numeric * 100);
}

/** 1500, 'BRL' -> "R$ 15,00" (usado só em e-mail/UI, nunca em cálculo). */
export function formatMoney(cents: Cents, currency = 'BRL'): string {
  assertCents(cents);
  const decimal = centsToDecimalString(cents);
  if (currency !== 'BRL') return `${currency} ${decimal}`;
  const [units, rest] = decimal.split('.');
  const grouped = units.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${grouped},${rest}`;
}

export function multiplyCents(unitCents: Cents, quantity: number): Cents {
  assertCents(unitCents, 'unitCents');
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new RangeError('quantity must be a positive integer');
  }
  return unitCents * quantity;
}
