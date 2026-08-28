/**
 * Tipos do domínio de pagamentos.
 *
 * Nada aqui conhece Mercado Pago. Os status são os NORMALIZADOS do projeto; a
 * tradução dos status do provider vive em providers/<provider>/mapping.ts.
 */

import type { Cents } from './money';

export const PAYMENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'PAID',
  'DECLINED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'CHARGEBACK',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Estados terminais: nenhum webhook posterior deve reabrir a entrega. */
export const TERMINAL_STATUSES: ReadonlySet<PaymentStatus> = new Set<PaymentStatus>([
  'CANCELLED',
  'EXPIRED',
  'REFUNDED',
  'CHARGEBACK',
]);

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

export type PaymentMethodKind = 'pix' | 'card' | 'boleto' | 'subscription';

export const SUBSCRIPTION_STATUSES = [
  'PENDING',
  'ACTIVE',
  'PAUSED',
  'PAST_DUE',
  'CANCELLED',
  'EXPIRED',
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const LICENSE_STATUSES = ['ACTIVE', 'EXPIRED', 'SUSPENDED', 'REVOKED'] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

/** Catálogo: a única fonte de verdade de preço é o banco. */
export type Product = {
  id: number;
  code: string;
  family: string;
  name: string;
  description: string | null;
  priceCents: Cents;
  currency: string;
  isLifetime: boolean;
  recurringEligible: boolean;
  recurringInterval: string | null;
  recurringFrequency: number | null;
  durationDays: number | null;
  fulfillmentKind: string;
  fulfillmentRef: string | null;
  active: boolean;
};

export type Order = {
  id: string;
  reference: string;
  userId: string;
  userEmail: string;
  productId: number;
  productCode: string;
  quantity: number;
  amountCents: Cents;
  currency: string;
  status: PaymentStatus;
  autoRenew: boolean;
  idempotencyKey: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
};

export type Payment = {
  id: string;
  orderId: string;
  userId: string;
  provider: string;
  providerPaymentId: string | null;
  providerTxnId: string | null;
  method: PaymentMethodKind;
  amountCents: Cents;
  currency: string;
  status: PaymentStatus;
  statusDetail: string | null;
  installments: number;
  refundedCents: Cents;
  idempotencyKey: string;
  /** Dados NÃO sensíveis: QR do Pix, linha digitável, bandeira, últimos 4. */
  details: Record<string, unknown>;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
};

export type StoredPaymentMethod = {
  id: string;
  userId: string;
  provider: string;
  providerCustomerId: string | null;
  providerMethodId: string | null;
  kind: string;
  brand: string | null;
  lastFour: string | null;
  expMonth: number | null;
  expYear: number | null;
  holderName: string | null;
};

export type Subscription = {
  id: string;
  userId: string;
  productId: number;
  orderId: string | null;
  provider: string;
  providerSubscriptionId: string | null;
  paymentMethodId: string | null;
  amountCents: Cents;
  currency: string;
  intervalUnit: string;
  intervalCount: number;
  status: SubscriptionStatus;
  autoRenew: boolean;
  nextBillingDate: string | null;
  licenseId: number | null;
  createdAt: string;
  cancelledAt: string | null;
};

export type License = {
  id: number;
  orderId: string | null;
  productId: number | null;
  userId: string | null;
  keyPrefix: string;
  level: string;
  status: LicenseStatus;
  durationDays: number;
  expiresAt: string | null;
  activatedAt: string | null;
  createdAt: string;
};
