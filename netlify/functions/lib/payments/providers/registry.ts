/**
 * Seleção do provider por configuração.
 *
 * Para adicionar Pagar.me/Stripe: implemente PaymentProvider em
 * providers/<nome>/, registre a fábrica aqui e mude PAYMENTS_PROVIDER. Nenhuma
 * regra de negócio muda.
 */

import { PaymentError } from '../domain/errors';
import type { PaymentProvider } from './PaymentProvider';
import { MercadoPagoPaymentProvider } from './mercadopago/MercadoPagoPaymentProvider';

export type PaymentsEnv = 'sandbox' | 'production';

const FACTORIES: Record<string, () => PaymentProvider> = {
  mercadopago: () => new MercadoPagoPaymentProvider(),
};

let cached: { name: string; provider: PaymentProvider } | null = null;

export function paymentsEnv(): PaymentsEnv {
  return process.env.PAYMENTS_ENV === 'production' ? 'production' : 'sandbox';
}

export function providerName(): string {
  return process.env.PAYMENTS_PROVIDER ?? 'mercadopago';
}

export function getPaymentProvider(): PaymentProvider {
  const name = providerName();
  if (cached?.name === name) return cached.provider;

  const factory = FACTORIES[name];
  if (!factory) {
    throw new PaymentError(
      'PROVIDER_NOT_SUPPORTED',
      `Provedor de pagamento "${name}" não está registrado.`,
      503,
    );
  }
  const provider = factory();
  cached = { name, provider };
  return provider;
}

/** Usado pelos testes para injetar um provider falso. */
export function setPaymentProviderForTesting(provider: PaymentProvider | null): void {
  cached = provider ? { name: provider.name, provider } : null;
}
