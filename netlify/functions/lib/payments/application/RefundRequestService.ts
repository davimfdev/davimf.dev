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
  /**
   * Tentativa de acesso a pedido inexistente ou de outro usuário. Injetado
   * (em vez de importado direto) para o teste poder verificar a chamada sem
   * depender do `console.warn` real do módulo de log.
   */
  logAccessDenied: (input: { userId: string; orderId: string }) => void;
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
      this.deps.logAccessDenied({ userId: input.userId, orderId: input.orderId });
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
    if (!paid) {
      // Também passou pela posse: mesma regra de "toda recusa é registrada",
      // mesmo sem pagamento PAID para estornar.
      await this.deps.record({
        orderId: order.id, userId: input.userId,
        outcome: 'rejected', reasonCode: 'ORDER_NOT_REFUNDABLE',
      });
      return { status: 409, code: 'ORDER_NOT_REFUNDABLE' };
    }

    try {
      await this.deps.refund(paid.id);
    } catch (error) {
      const outcome = this.classifyRefundFailure(error);
      const providerError = this.extractProviderError(error);
      return this.settleAfterRefundAttempt(order, input.userId, outcome, providerError);
    }

    return this.settleAfterRefundAttempt(order, input.userId, 'refunded', null);
  }

  /**
   * Classifica a falha do `refund`. SÓ a recusa CONFIRMADA (`retryable`
   * presente e explicitamente `false`) vira `manual` — ela é a única que
   * AFIRMA que o dinheiro não se moveu. Qualquer outra forma — aceito pelo
   * provider (`refundAccepted`), ambígua (`retryable` true: timeout, 5xx,
   * 429), ou de formato desconhecido (string, objeto sem contrato, erro do
   * nosso próprio código) — vai para reconciliação: não sabemos se o
   * estorno ocorreu, e assumir que não é como um reembolso vira dois.
   */
  private classifyRefundFailure(error: unknown): 'manual' | 'reconciliation_required' {
    const props = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {};
    if (props.refundAccepted === true) return 'reconciliation_required';
    if (props.retryable === false) return 'manual';
    return 'reconciliation_required';
  }

  /**
   * Nunca deixa `.slice` estourar: um erro pode ser string, objeto sem
   * contrato ou nem `Error`. Prioriza `providerDetail` (erro do provider),
   * depois `.message` de um `Error` de verdade, e só então `String(error)`
   * para o que sobrar (string crua, objeto sem contrato).
   */
  private extractProviderError(error: unknown): string {
    const providerDetail = typeof error === 'object' && error !== null
      ? (error as { providerDetail?: unknown }).providerDetail
      : undefined;
    const raw = typeof providerDetail === 'string'
      ? providerDetail
      : error instanceof Error ? error.message : String(error);
    // O provider não controla quanto gravamos: mesmo limite de
    // `markEventFailed` (PaymentEventRepository) para provider_error.
    return raw.slice(0, MAX_PROVIDER_ERROR_LENGTH);
  }

  /**
   * Bookkeeping depois de TENTAR o estorno (sucesso ou falha já
   * classificada). A partir daqui o provider já foi chamado — o dinheiro
   * pode ter se movido — então nenhuma falha NOSSA pode virar exceção: isso
   * devolveria um 500 ao cliente, que tenderia a repetir o pedido e pedir o
   * estorno de novo ao provider. Uma falha em gravar ou confirmar degrada
   * para `reconciliation_required` e avisa o financeiro, em vez de
   * propagar — o chamador sempre recebe um resultado estruturado.
   */
  private async settleAfterRefundAttempt(
    order: Order,
    userId: string,
    outcome: 'refunded' | 'manual' | 'reconciliation_required',
    providerError: string | null,
  ): Promise<RefundRequestResult> {
    let finalOutcome = outcome;
    let finalProviderError = providerError;
    try {
      // Auditoria antes da confirmação por e-mail: nunca o contrário.
      await this.deps.record({ orderId: order.id, userId, outcome, providerError });
      await this.deps.acknowledge(order, outcome);
    } catch (bookkeepingError) {
      // A falha é NOSSA (gravar ou confirmar), não mais do provider — o
      // detalhe relevante agora é essa falha, não a original (se houve).
      finalOutcome = 'reconciliation_required';
      finalProviderError = this.extractProviderError(bookkeepingError);
      // Melhor esforço: a resposta ao cliente segue estruturada mesmo que
      // esta segunda tentativa também falhe.
      await this.deps.record({
        orderId: order.id, userId, outcome: finalOutcome, providerError: finalProviderError,
      }).catch(() => undefined);
      await this.deps.acknowledge(order, finalOutcome).catch(() => undefined);
    }

    if (finalOutcome !== 'refunded') {
      await this.deps.alertOperator(order, finalOutcome, finalProviderError).catch(() => undefined);
    }

    return finalOutcome === 'refunded'
      ? { status: 200, outcome: 'refunded' }
      : { status: 202, outcome: finalOutcome };
  }
}
