/**
 * Trilha dos pedidos de reembolso feitos pelo CLIENTE.
 *
 * Uma linha só é escrita depois de a posse do pedido ser confirmada — antes
 * disso, qualquer um encheria a tabela iterando ids de pedido.
 */

import { optionalStr, paymentsSql, requiredIsoDate, str } from '../infrastructure/db';

export type RefundRequestOutcome =
  | 'refunded'
  | 'manual'
  | 'reconciliation_required'
  /** Passou pela posse e foi recusado. Registrado para ver tentativa repetida. */
  | 'rejected';

export type RefundRequest = {
  id: string;
  orderId: string;
  userId: string;
  requestedAt: string;
  outcome: RefundRequestOutcome;
  reasonCode: string | null;
  description: string | null;
  providerError: string | null;
};

export type CreateRefundRequestInput = {
  orderId: string;
  userId: string;
  outcome: RefundRequestOutcome;
  reasonCode?: string | null;
  description?: string | null;
  providerError?: string | null;
};

export async function createRefundRequest(input: CreateRefundRequestInput): Promise<RefundRequest> {
  const rows = await paymentsSql`
    INSERT INTO refund_requests (order_id, user_id, outcome, reason_code, description, provider_error)
    VALUES (${input.orderId}::uuid, ${input.userId}, ${input.outcome},
            ${input.reasonCode ?? null}, ${input.description ?? null}, ${input.providerError ?? null})
    RETURNING id, order_id, user_id, requested_at, outcome, reason_code, description, provider_error`;

  const row = rows[0];
  return {
    id: str(row.id),
    orderId: str(row.order_id),
    userId: str(row.user_id),
    requestedAt: requiredIsoDate(row.requested_at),
    outcome: str(row.outcome) as RefundRequestOutcome,
    reasonCode: optionalStr(row.reason_code),
    description: optionalStr(row.description),
    providerError: optionalStr(row.provider_error),
  };
}
