export type Cents = number & { readonly __brand: 'Cents' };

export const MAX_SAFE_CENTS = Number.MAX_SAFE_INTEGER;

const INTEGER_STRING = /^-?\d+$/;

/**
 * Converte um valor vindo do banco em centavos, validando a faixa segura.
 * O postgres.js entrega BIGINT como string justamente para não perder precisão.
 */
export function parseDatabaseCents(value: unknown): Cents {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new Error('Valor monetário fora da faixa segura');
    }
    return value as Cents;
  }
  if (typeof value !== 'string' || !INTEGER_STRING.test(value)) {
    throw new Error('Valor monetário inválido vindo do banco');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error('Valor monetário fora da faixa segura');
  }
  return parsed as Cents;
}

/** Marca um inteiro já validado como centavos. */
export function toCents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new Error('Centavos precisam ser inteiros dentro da faixa segura');
  }
  return value as Cents;
}
