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

import { createRefundRequest, type RefundRequestOutcome } from '../repositories/RefundRequestRepository';
import { logOrderAccessDenied } from '../infrastructure/securityLog';
import { getOrderService } from './OrderService';
import { getPaymentService } from './PaymentService';

export type RefundRequestResult =
  | { status: 200; outcome: 'refunded' }
  | { status: 202; outcome: 'manual' | 'reconciliation_required' }
  | { status: 404 }
  | { status: 409; code: RefundRejectionCode };

/** Limite espelha `markEventFailed` (PaymentEventRepository): o provider não controla o tamanho do que gravamos. */
const MAX_PROVIDER_ERROR_LENGTH = 2000;

type Deps = {
  findOwnedOrder: (orderId: string, userId: string) => Promise<Order | null>;
  listPayments: (orderId: string) => Promise<Array<{ id: string; status: string }>>;
  refund: (paymentId: string) => Promise<unknown>;
  record: (input: {
    orderId: string; userId: string; outcome: RefundRequestOutcome;
    reasonCode?: string | null; description?: string | null; providerError?: string | null;
  }) => Promise<unknown>;
  acknowledge: (order: Order, outcome: RefundRequestOutcome) => Promise<unknown>;
  /** Avisa o financeiro. Log de container não é canal que alguém observa. */
  alertOperator: (order: Order, outcome: RefundRequestOutcome, detail: string | null) => Promise<unknown>;
};

export class RefundRequestService {
  constructor(private readonly deps: Deps) {}

  async request(input: {
    orderId: string; userId: string; now?: Date;
    /** Relato do problema. Só existe fora da janela, onde há o que analisar. */
    description?: string | null;
  }): Promise<RefundRequestResult> {
    const order = await this.deps.findOwnedOrder(input.orderId, input.userId);
    if (!order) {
      // 404 idêntico para inexistente e alheio: a resposta não confirma que o
      // id pertence a outra pessoa. O registro fica no log de segurança.
      logOrderAccessDenied({ userId: input.userId, orderId: input.orderId });
      return { status: 404 };
    }

    const decision = decideRefund(order, input.now ?? new Date());

    if (decision.kind === 'rejected') {
      // Passou pela posse, então É registrável. Recusa repetida durante uma
      // contestação é justamente o que se quer enxergar depois.
      await this.deps.record({
        orderId: order.id, userId: input.userId,
        outcome: 'rejected', reasonCode: decision.code,
      });
      return { status: 409, code: decision.code };
    }

    if (decision.kind === 'manual') {
      // Fora da janela é o único caminho que pede análise humana — só aqui o
      // relato do cliente importa. Dentro da janela o direito é incondicional
      // (Art. 49 do CDC) e nada é perguntado.
      await this.deps.record({
        orderId: order.id, userId: input.userId,
        outcome: 'manual', description: input.description ?? null,
      });
      await this.deps.acknowledge(order, 'manual');
      return { status: 202, outcome: 'manual' };
    }

    const payments = await this.deps.listPayments(order.id);
    const paid = payments.find((payment) => payment.status === 'PAID');
    if (!paid) return { status: 409, code: 'ORDER_NOT_REFUNDABLE' };

    try {
      await this.deps.refund(paid.id);
    } catch (error) {
      // Dois casos vão para reconciliação, não para `manual`:
      //  - o provider ACEITOU e a gravação local falhou (`refundAccepted`);
      //  - o resultado é AMBÍGUO (timeout, 5xx, 429): `retryable` é true e não
      //    sabemos se o estorno ocorreu. Assumir que não é como se estorna duas
      //    vezes.
      // Só a recusa CONFIRMADA (4xx, `retryable` false) vira `manual`. Em
      // nenhum dos três casos o estorno é pedido de novo ao provider.
      const accepted = (error as { refundAccepted?: boolean }).refundAccepted === true;
      const ambiguous = (error as { retryable?: boolean }).retryable === true;
      const outcome: RefundRequestOutcome =
        accepted || ambiguous ? 'reconciliation_required' : 'manual';
      const rawProviderError = (error as { providerDetail?: string }).providerDetail
        ?? (error as Error).message;
      // O provider não controla quanto gravamos: mesmo limite de
      // `markEventFailed` (PaymentEventRepository) para provider_error.
      const providerError = rawProviderError.slice(0, MAX_PROVIDER_ERROR_LENGTH);

      await this.deps.record({ orderId: order.id, userId: input.userId, outcome, providerError });
      await this.deps.acknowledge(order, outcome);
      await this.deps.alertOperator(order, outcome, providerError);
      return { status: 202, outcome };
    }

    await this.deps.record({ orderId: order.id, userId: input.userId, outcome: 'refunded' });
    await this.deps.acknowledge(order, 'refunded');
    return { status: 200, outcome: 'refunded' };
  }
}
