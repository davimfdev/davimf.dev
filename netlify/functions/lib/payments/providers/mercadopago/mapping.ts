/**
 * Tradução Mercado Pago -> domínio.
 *
 * Este é o ÚNICO lugar onde status do Mercado Pago existem. Fora daqui o
 * projeto só conhece os status normalizados de domain/types.ts.
 */

import { decimalToCents } from '../../domain/money';
import type { PaymentMethodKind, PaymentStatus, SubscriptionStatus } from '../../domain/types';
import type { PaymentDisplay, ProviderPaymentResult, ProviderSubscriptionResult } from '../PaymentProvider';
import { pick, pickNumber, pickString } from './client';

/** Status da Orders API + status clássicos de /v1/payments (webhook antigo). */
const ORDER_STATUS: Record<string, PaymentStatus> = {
  created: 'PENDING',
  processing: 'PROCESSING',
  action_required: 'PENDING',
  at_terminal: 'PENDING',
  processed: 'PAID',
  canceled: 'CANCELLED',
  cancelled: 'CANCELLED',
  expired: 'EXPIRED',
  failed: 'FAILED',
  refunded: 'REFUNDED',
  partially_refunded: 'PARTIALLY_REFUNDED',
  charged_back: 'CHARGEBACK',
};

const PAYMENT_STATUS: Record<string, PaymentStatus> = {
  pending: 'PENDING',
  in_process: 'PROCESSING',
  in_mediation: 'PROCESSING',
  authorized: 'PROCESSING',
  approved: 'PAID',
  processed: 'PAID',
  rejected: 'DECLINED',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
  refunded: 'REFUNDED',
  charged_back: 'CHARGEBACK',
  expired: 'EXPIRED',
  failed: 'FAILED',
};

/**
 * `status_detail` desambigua "processed": o Mercado Pago marca a Order como
 * `processed` tanto para aprovado quanto para reembolsado/estornado.
 */
const STATUS_DETAIL_OVERRIDE: Record<string, PaymentStatus> = {
  accredited: 'PAID',
  partially_refunded: 'PARTIALLY_REFUNDED',
  refunded: 'REFUNDED',
  by_collector: 'CANCELLED',
  expired: 'EXPIRED',
  pending_waiting_transfer: 'PENDING',
  pending_waiting_payment: 'PENDING',
  pending_challenge: 'PROCESSING',
  pending_review_manual: 'PROCESSING',
};

export function mapPaymentStatus(status: string | null, statusDetail: string | null): PaymentStatus {
  const normalized = (status ?? '').toLowerCase();
  const detail = (statusDetail ?? '').toLowerCase();

  // Recusa declarada no DETALHE é recusa, qualquer que seja o status externo:
  // `cc_rejected_3ds_challenge` chega com `action_required` em alguns fluxos.
  if (detail.startsWith('cc_rejected')) return 'DECLINED';
  if (detail && STATUS_DETAIL_OVERRIDE[detail] && normalized !== 'rejected') {
    // Recusa é sempre recusa, mesmo com detail conhecido.
    return STATUS_DETAIL_OVERRIDE[detail];
  }
  if (normalized.startsWith('cc_rejected') || normalized === 'rejected') return 'DECLINED';
  return ORDER_STATUS[normalized] ?? PAYMENT_STATUS[normalized] ?? 'PENDING';
}

const SUBSCRIPTION_STATUS: Record<string, SubscriptionStatus> = {
  pending: 'PENDING',
  authorized: 'ACTIVE',
  active: 'ACTIVE',
  paused: 'PAUSED',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
  finished: 'EXPIRED',
  expired: 'EXPIRED',
};

export function mapSubscriptionStatus(status: string | null): SubscriptionStatus {
  return SUBSCRIPTION_STATUS[(status ?? '').toLowerCase()] ?? 'PENDING';
}

const METHOD_BY_TYPE: Record<string, PaymentMethodKind> = {
  bank_transfer: 'pix',
  credit_card: 'card',
  debit_card: 'card',
  ticket: 'boleto',
  atm: 'boleto',
};

export function mapMethod(methodId: string | null, methodType: string | null): PaymentMethodKind {
  const id = (methodId ?? '').toLowerCase();
  if (id === 'pix') return 'pix';
  if (id.includes('boleto') || id.startsWith('bol')) return 'boleto';
  return METHOD_BY_TYPE[(methodType ?? '').toLowerCase()] ?? 'card';
}

/** Primeiro pagamento de uma Order — é o modelo de compra única do projeto. */
function firstPayment(order: unknown): unknown {
  const list = pick(order, 'transactions', 'payments');
  if (Array.isArray(list) && list.length > 0) return list[0];
  // Notificação legada de /v1/payments vem achatada.
  return order;
}

function sumRefunds(order: unknown): number {
  const refunds = pick(order, 'transactions', 'refunds');
  if (!Array.isArray(refunds)) return 0;
  return refunds.reduce((total: number, entry) => {
    const amount = pickNumber(entry, 'amount');
    return total + (amount === null ? 0 : decimalToCents(amount));
  }, 0);
}

function buildDisplay(payment: unknown): PaymentDisplay {
  const method = pick(payment, 'payment_method');
  const display: PaymentDisplay = {};

  const qrCode = pickString(method, 'qr_code') ?? pickString(payment, 'point_of_interaction', 'transaction_data', 'qr_code');
  const qrBase64 =
    pickString(method, 'qr_code_base64') ??
    pickString(payment, 'point_of_interaction', 'transaction_data', 'qr_code_base64');
  const ticketUrl =
    pickString(method, 'ticket_url') ??
    pickString(payment, 'point_of_interaction', 'transaction_data', 'ticket_url') ??
    pickString(payment, 'transaction_details', 'external_resource_url');

  if (qrCode) display.pixQrCode = qrCode;
  if (qrBase64) display.pixQrCodeBase64 = qrBase64;
  if (ticketUrl) display.ticketUrl = ticketUrl;

  const digitable = pickString(method, 'digitable_line') ?? pickString(payment, 'transaction_details', 'digitable_line');
  const barcode =
    pickString(method, 'barcode_content') ?? pickString(payment, 'barcode', 'content');
  if (digitable) display.boletoDigitableLine = digitable;
  if (barcode) display.boletoBarcode = barcode;

  // Só metadados NÃO sensíveis do cartão. PAN/CVV nunca aparecem aqui.
  const brand = pickString(method, 'id') ?? pickString(payment, 'payment_method_id');
  const lastFour = pickString(method, 'card', 'last_four_digits') ?? pickString(payment, 'card', 'last_four_digits');
  if (lastFour) {
    display.cardLastFour = lastFour;
    if (brand) display.cardBrand = brand;
  }

  // Caminho documentado da Orders API primeiro; os dois seguintes são o
  // formato legado de /v1/payments, mantidos para notificações antigas.
  const threeDs =
    pickString(method, 'transaction_security', 'url') ??
    pickString(payment, 'three_ds_info', 'external_resource_url') ??
    pickString(method, 'three_ds_info', 'external_resource_url');
  if (threeDs) display.threeDsUrl = threeDs;

  return display;
}

export function mapOrderToPayment(order: unknown): ProviderPaymentResult {
  const payment = firstPayment(order);
  const methodId = pickString(payment, 'payment_method', 'id') ?? pickString(payment, 'payment_method_id');
  const methodType = pickString(payment, 'payment_method', 'type') ?? pickString(payment, 'payment_type_id');

  const rawStatus = pickString(payment, 'status') ?? pickString(order, 'status');
  const rawDetail = pickString(payment, 'status_detail') ?? pickString(order, 'status_detail');

  const amountSource =
    pickNumber(payment, 'amount') ??
    pickNumber(order, 'total_amount') ??
    pickNumber(payment, 'transaction_amount') ??
    0;

  const providerPaymentId =
    pickString(order, 'id') ?? pickString(payment, 'id') ?? '';

  const expiration =
    pickString(payment, 'expiration_time') ??
    pickString(payment, 'date_of_expiration') ??
    pickString(order, 'expiration_time');

  return {
    providerPaymentId,
    providerTxnId: pickString(payment, 'id'),
    status: mapPaymentStatus(rawStatus, rawDetail),
    statusDetail: rawDetail,
    method: mapMethod(methodId, methodType),
    amountCents: decimalToCents(amountSource),
    currency: pickString(order, 'currency_id') ?? pickString(payment, 'currency_id') ?? 'BRL',
    installments: pickNumber(payment, 'payment_method', 'installments') ?? pickNumber(payment, 'installments') ?? 1,
    refundedCents: sumRefunds(order),
    // Datas ISO absolutas só quando o MP devolve uma; durações ISO-8601 (P…) não.
    expiresAt: expiration && !expiration.startsWith('P') ? expiration : null,
    display: buildDisplay(payment),
    raw: (order ?? {}) as Record<string, unknown>,
  };
}

export function mapPreapproval(preapproval: unknown): ProviderSubscriptionResult {
  return {
    providerSubscriptionId: pickString(preapproval, 'id') ?? '',
    status: mapSubscriptionStatus(pickString(preapproval, 'status')),
    nextBillingDate: pickString(preapproval, 'next_payment_date'),
    raw: (preapproval ?? {}) as Record<string, unknown>,
  };
}
