import type { Cents } from '../domain/money';
import type { Payment, PaymentMethodKind, PaymentStatus } from '../domain/types';
import { isPaymentStatus } from '../domain/types';
import {
  isoDate,
  json,
  num,
  optionalStr,
  paymentsSql,
  requiredIsoDate,
  str,
} from '../infrastructure/db';
import type { SqlRow } from '../infrastructure/db';

export function rowToPayment(row: SqlRow): Payment {
  const status = str(row.status);
  return {
    id: str(row.id),
    orderId: str(row.order_id),
    userId: str(row.user_id),
    provider: str(row.provider),
    providerPaymentId: optionalStr(row.provider_payment_id),
    providerTxnId: optionalStr(row.provider_txn_id),
    method: (str(row.method) || 'pix') as PaymentMethodKind,
    amountCents: num(row.amount_cents),
    currency: str(row.currency) || 'BRL',
    status: isPaymentStatus(status) ? status : 'PENDING',
    statusDetail: optionalStr(row.status_detail),
    installments: num(row.installments, 1),
    refundedCents: num(row.refunded_cents),
    idempotencyKey: str(row.idempotency_key),
    details: json(row.details),
    expiresAt: isoDate(row.expires_at),
    createdAt: requiredIsoDate(row.created_at),
    updatedAt: requiredIsoDate(row.updated_at),
    paidAt: isoDate(row.paid_at),
  };
}

export type ReservePaymentInput = {
  orderId: string;
  userId: string;
  provider: string;
  method: PaymentMethodKind;
  amountCents: Cents;
  currency: string;
  installments: number;
  idempotencyKey: string;
};

/**
 * Reserva a tentativa ANTES de chamar o provider.
 *
 * A chave de idempotência é única: duplo clique, refresh ou retry caem no
 * `ON CONFLICT` e recuperam a MESMA linha — nunca uma segunda cobrança.
 */
export async function reservePayment(input: ReservePaymentInput): Promise<Payment> {
  const rows = await paymentsSql`
    INSERT INTO payments (
      order_id, user_id, provider, method, amount_cents, currency,
      status, installments, idempotency_key
    ) VALUES (
      ${input.orderId}, ${input.userId}, ${input.provider}, ${input.method},
      ${input.amountCents}, ${input.currency}, 'PENDING', ${input.installments},
      ${input.idempotencyKey}
    )
    ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = now()
    RETURNING id, order_id, user_id, provider, provider_payment_id, provider_txn_id,
              method, amount_cents, currency, status, status_detail, installments,
              refunded_cents, idempotency_key, details, expires_at,
              created_at, updated_at, paid_at`;
  return rowToPayment(rows[0]);
}

export type UpdatePaymentInput = {
  id: string;
  providerPaymentId?: string | null;
  providerTxnId?: string | null;
  status: PaymentStatus;
  statusDetail?: string | null;
  installments?: number;
  refundedCents?: Cents;
  details?: Record<string, unknown>;
  expiresAt?: string | null;
  paidAt?: string | null;
};

export async function updatePayment(input: UpdatePaymentInput): Promise<Payment> {
  const details = input.details === undefined ? null : JSON.stringify(input.details);
  const rows = await paymentsSql`
    UPDATE payments SET
      provider_payment_id = COALESCE(${input.providerPaymentId ?? null}, provider_payment_id),
      provider_txn_id     = COALESCE(${input.providerTxnId ?? null}, provider_txn_id),
      status              = ${input.status},
      status_detail       = COALESCE(${input.statusDetail ?? null}, status_detail),
      installments        = COALESCE(${input.installments ?? null}, installments),
      refunded_cents      = COALESCE(${input.refundedCents ?? null}, refunded_cents),
      details             = COALESCE(${details}::jsonb, details),
      expires_at          = COALESCE(${input.expiresAt ?? null}::timestamptz, expires_at),
      paid_at             = COALESCE(paid_at, ${input.paidAt ?? null}::timestamptz),
      updated_at          = now()
    WHERE id = ${input.id}
    RETURNING id, order_id, user_id, provider, provider_payment_id, provider_txn_id,
              method, amount_cents, currency, status, status_detail, installments,
              refunded_cents, idempotency_key, details, expires_at,
              created_at, updated_at, paid_at`;
  return rowToPayment(rows[0]);
}

export async function findPaymentById(id: string): Promise<Payment | null> {
  const rows = await paymentsSql`
    SELECT id, order_id, user_id, provider, provider_payment_id, provider_txn_id,
           method, amount_cents, currency, status, status_detail, installments,
           refunded_cents, idempotency_key, details, expires_at,
           created_at, updated_at, paid_at
      FROM payments WHERE id = ${id} LIMIT 1`;
  return rows[0] ? rowToPayment(rows[0]) : null;
}

export async function findPaymentByProviderId(
  provider: string,
  providerPaymentId: string,
): Promise<Payment | null> {
  const rows = await paymentsSql`
    SELECT id, order_id, user_id, provider, provider_payment_id, provider_txn_id,
           method, amount_cents, currency, status, status_detail, installments,
           refunded_cents, idempotency_key, details, expires_at,
           created_at, updated_at, paid_at
      FROM payments
     WHERE provider = ${provider} AND provider_payment_id = ${providerPaymentId}
     LIMIT 1`;
  return rows[0] ? rowToPayment(rows[0]) : null;
}

export async function listPaymentsByOrder(orderId: string): Promise<Payment[]> {
  const rows = await paymentsSql`
    SELECT id, order_id, user_id, provider, provider_payment_id, provider_txn_id,
           method, amount_cents, currency, status, status_detail, installments,
           refunded_cents, idempotency_key, details, expires_at,
           created_at, updated_at, paid_at
      FROM payments WHERE order_id = ${orderId} ORDER BY created_at DESC`;
  return rows.map(rowToPayment);
}

/**
 * Existe alguma tentativa ATIVA (não terminal) além desta para o mesmo pedido?
 * Serve para bloquear "duplo pagamento": dois métodos abertos no mesmo pedido.
 */
export async function hasOpenPaymentForOrder(orderId: string, exceptId?: string): Promise<boolean> {
  const rows = await paymentsSql`
    SELECT 1 FROM payments
     WHERE order_id = ${orderId}
       AND status IN ('PENDING','PROCESSING','PAID')
       AND (${exceptId ?? null}::uuid IS NULL OR id <> ${exceptId ?? null}::uuid)
     LIMIT 1`;
  return rows.length > 0;
}
