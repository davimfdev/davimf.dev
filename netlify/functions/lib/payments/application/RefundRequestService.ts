/**
 * Decide o que fazer com um pedido de reembolso feito pelo cliente.
 *
 * A decisão é PURA: recebe o pedido e o instante, devolve o desfecho. Quem
 * move dinheiro é `PaymentService.refund`, chamado depois por quem executa.
 */

import type { Order } from '../domain/types';

/** Art. 49 do CDC. */
export const REFUND_WINDOW_DAYS = 7;

export type RefundRejectionCode =
  | 'ORDER_NOT_REFUNDABLE'
  | 'REFUND_ALREADY_PROCESSED'
  | 'REFUND_UNDER_DISPUTE';

export type RefundDecision =
  | { kind: 'automatic' }
  | { kind: 'manual'; reason: 'outside_window' }
  | { kind: 'rejected'; code: RefundRejectionCode };

export function decideRefund(order: Order, now: Date): RefundDecision {
  if (order.status === 'REFUNDED' || order.status === 'PARTIALLY_REFUNDED') {
    return { kind: 'rejected', code: 'REFUND_ALREADY_PROCESSED' };
  }
  if (order.status === 'CHARGEBACK') {
    return { kind: 'rejected', code: 'REFUND_UNDER_DISPUTE' };
  }
  if (order.status !== 'PAID') {
    return { kind: 'rejected', code: 'ORDER_NOT_REFUNDABLE' };
  }

  // Art. 49 conta da contratação OU do recebimento. `fulfilledAt` é a entrega
  // da licença (PaymentService.fulfill), e a entrega pode ser posterior ao
  // pagamento quando a emissão é retentada. O mais tardio favorece o cliente.
  const instants = [order.paidAt, order.fulfilledAt]
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value));

  // Sem nenhum dos dois não há janela demonstrável. Análise humana, não chute.
  if (instants.length === 0) return { kind: 'manual', reason: 'outside_window' };

  const elapsedDays = (now.getTime() - Math.max(...instants)) / 86_400_000;
  // Instante no futuro é anomalia (desincronização de relógio). Não chuta.
  if (elapsedDays < 0 || elapsedDays > REFUND_WINDOW_DAYS) {
    return { kind: 'manual', reason: 'outside_window' };
  }

  return { kind: 'automatic' };
}
