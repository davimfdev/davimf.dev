/**
 * Cliente do módulo de pagamentos.
 *
 * Nenhuma função daqui envia valor: o backend calcula o preço a partir do
 * catálogo. O frontend só manda produto, quantidade e a referência segura do
 * cartão (token gerado pelo Mercado Pago).
 */

export type PaymentMethodKind = 'pix' | 'card' | 'boleto' | 'subscription';

export type PaymentStatus =
  | 'PENDING' | 'PROCESSING' | 'PAID' | 'DECLINED' | 'FAILED'
  | 'CANCELLED' | 'EXPIRED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'CHARGEBACK';

export interface CatalogProduct {
  code: string;
  family: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  isLifetime: boolean;
  recurringEligible: boolean;
  recurringInterval: string | null;
  recurringFrequency: number | null;
  durationDays: number | null;
}

export interface PaymentsConfig {
  provider: string;
  environment: 'sandbox' | 'production';
  publicKey: string | null;
  downloadUrl: string;
  methods: PaymentMethodKind[];
}

export interface CheckoutOrder {
  id: string;
  reference: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  autoRenew: boolean;
  productCode: string;
  productName: string;
}

export interface LicenseView {
  key: string | null;
  keyPrefix: string;
  expiresAt: string | null;
  status: string;
}

export interface PaymentView {
  id: string;
  orderId: string;
  orderReference: string;
  productName: string;
  method: PaymentMethodKind;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  installments: number;
  expiresAt: string | null;
  pix?: { qrCode: string | null; qrCodeBase64: string | null; ticketUrl: string | null };
  boleto?: { digitableLine: string | null; barcode: string | null; ticketUrl: string | null };
  card?: { brand: string | null; lastFour: string | null };
  threeDsUrl: string | null;
  license?: LicenseView;
  downloadUrl?: string;
}

export interface PayerInput {
  email: string;
  firstName?: string;
  lastName?: string;
  identification?: { type: string; number: string };
  address?: {
    zipCode: string;
    streetName: string;
    streetNumber: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  };
}

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      // A sessão do site é um cookie assinado: sem credentials, nada autentica.
      credentials: 'include',
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Erro de conexão. Verifique sua internet e tente novamente.', 0);
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    const error = (data.error ?? {}) as { code?: string; message?: string };
    throw new ApiError(
      error.code ?? 'UNKNOWN',
      error.message ?? 'Não foi possível concluir a operação.',
      response.status,
    );
  }
  return data as T;
}

export const paymentsApi = {
  config: () => call<PaymentsConfig>('/api/payments/config'),

  products: (family?: string) =>
    call<{ products: CatalogProduct[] }>(`/api/payments/products${family ? `?family=${encodeURIComponent(family)}` : ''}`),

  /** Só produto + intenção. O valor final é decidido pelo backend. */
  checkout: (input: { productCode: string; email: string; quantity?: number; autoRenew?: boolean; idempotencyKey: string }) =>
    call<{ order: CheckoutOrder; product: CatalogProduct; reused: boolean }>('/api/payments/checkout', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  pix: (input: { orderId: string; payer: PayerInput; idempotencyKey: string }) =>
    call<{ payment: PaymentView }>('/api/payments/pix', { method: 'POST', body: JSON.stringify(input) }),

  boleto: (input: { orderId: string; payer: PayerInput; idempotencyKey: string }) =>
    call<{ payment: PaymentView }>('/api/payments/boleto', { method: 'POST', body: JSON.stringify(input) }),

  /** `cardToken` vem do MercadoPago.js — PAN e CVV nunca saem do iframe dele. */
  card: (input: {
    orderId: string;
    payer: PayerInput;
    cardToken: string;
    paymentMethodId: string;
    installments: number;
    idempotencyKey: string;
  }) =>
    call<{ payment: PaymentView | null; subscription?: { id: string; status: string; nextBillingDate: string | null } }>(
      '/api/payments/card',
      { method: 'POST', body: JSON.stringify(input) },
    ),

  status: (paymentId: string) =>
    call<{ payment: PaymentView }>(`/api/payments/status?paymentId=${encodeURIComponent(paymentId)}`),

  order: (orderId: string) =>
    call<{ order: CheckoutOrder & { createdAt: string; paidAt: string | null }; payment: PaymentView | null }>(
      `/api/payments/orders/${encodeURIComponent(orderId)}`,
    ),

  licenses: () =>
    call<{
      downloadUrl: string;
      licenses: Array<{
        id: number;
        key: string | null;
        keyPrefix: string;
        level: string;
        status: string;
        durationDays: number;
        expiresAt: string | null;
        activatedAt: string | null;
        createdAt: string;
        orderId: string | null;
      }>;
    }>('/api/payments/licenses'),

  subscriptions: () =>
    call<{ subscriptions: Array<{ id: string; status: string; autoRenew: boolean; nextBillingDate: string | null; amountCents: number; currency: string }> }>(
      '/api/payments/subscriptions',
    ),

  cancelSubscription: (subscriptionId: string) =>
    call<{ subscription: { id: string; status: string } }>('/api/payments/subscription/cancel', {
      method: 'POST',
      body: JSON.stringify({ subscriptionId }),
    }),
};

export function formatMoney(cents: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100);
}
