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
import { safeString } from '../infrastructure/safeString';
import { ForbiddenError, NotFoundError } from '../domain/errors';
import { EMAIL_REPLY_TO } from '../email/EmailProvider';
import { refundAlertEmail, refundRequestedEmail } from '../email/templates';
import { getOrderService } from './OrderService';
import { getPaymentService } from './PaymentService';
import { NotificationService } from './NotificationService';

export type RefundRequestResult =
  | { status: 200; outcome: 'refunded' }
  | { status: 202; outcome: 'manual' | 'reconciliation_required' }
  | { status: 404 }
  | { status: 409; code: RefundRejectionCode };

/** Limite espelha `markEventFailed` (PaymentEventRepository): o provider não controla o tamanho do que gravamos. */
const MAX_PROVIDER_ERROR_LENGTH = 2000;

/** Desfechos que o comprador é avisado — `rejected` nunca confirma recebimento. */
type RefundAcknowledgeOutcome = 'refunded' | 'manual' | 'reconciliation_required';

type Deps = {
  findOwnedOrder: (orderId: string, userId: string) => Promise<Order | null>;
  listPayments: (orderId: string) => Promise<Array<{ id: string; status: string }>>;
  refund: (paymentId: string) => Promise<unknown>;
  record: (input: {
    orderId: string; userId: string; outcome: RefundRequestOutcome;
    reasonCode?: string | null; description?: string | null; providerError?: string | null;
  }) => Promise<unknown>;
  /**
   * Confirmação ao COMPRADOR. O tipo exclui `rejected` de propósito: recusa
   * não gera confirmação de recebimento, e cada desfecho aqui tem um corpo
   * próprio em `refundRequestedEmail` — nenhum herda o texto de outro.
   */
  acknowledge: (order: Order, outcome: RefundAcknowledgeOutcome) => Promise<unknown>;
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
      //
      // Mesma regra do caminho sem pagamento PAID: nenhum dinheiro se moveu
      // aqui, então uma falha ao gravar não pode transformar um 409
      // determinístico em 500 — melhor esforço (try/catch, não `.catch()`,
      // para cobrir também uma falha síncrona do dep), mas nunca em silêncio.
      try {
        await this.deps.record({
          orderId: order.id, userId: input.userId,
          outcome: 'rejected', reasonCode: decision.code,
        });
      } catch {
        console.error(`[payments] REFUND_REQUEST_AUDIT_WRITE_FAILED order=${order.id}`);
      }
      return { status: 409, code: decision.code };
    }

    if (decision.kind === 'manual') {
      // Fora da janela é o único caminho que pede análise humana — só aqui o
      // relato do cliente importa. Dentro da janela o direito é incondicional
      // (Art. 49 do CDC) e nada é perguntado.
      const description = input.description ?? null;

      // Gravar e confirmar são melhor esforço: uma intermitência do provedor
      // de e-mail depois da linha gravada devolveria 500, o cliente repetiria
      // e uma SEGUNDA linha entraria sem nenhuma confirmação ter saído — e
      // confirmar o recebimento de imediato é o que a lei exige aqui
      // (Decreto 7.962/2013). A falha não derruba a resposta, mas é logada.
      try {
        // Auditoria antes da confirmação por e-mail: nunca o contrário.
        await this.deps.record({
          orderId: order.id, userId: input.userId,
          outcome: 'manual', description,
        });
        await this.deps.acknowledge(order, 'manual');
      } catch {
        console.error(`[payments] REFUND_REQUEST_MANUAL_NOTIFY_FAILED order=${order.id}`);
      }

      // O caso de ROTINA também precisa de gente: sem este aviso a análise
      // manual vira uma linha numa tabela que ninguém consulta. Vai FORA do
      // try acima de propósito — é justamente quando gravar ou confirmar
      // falha que alguém mais precisa olhar este pedido. O relato do cliente
      // é todo o conteúdo que o analista tem, então segue no alerta.
      try {
        await this.deps.alertOperator(order, 'manual', description);
      } catch {
        console.error(`[payments] REFUND_REQUEST_MANUAL_ALERT_FAILED order=${order.id}`);
      }

      return { status: 202, outcome: 'manual' };
    }

    const payments = await this.deps.listPayments(order.id);
    const paid = payments.find((payment) => payment.status === 'PAID');
    if (!paid) {
      // Também passou pela posse: mesma regra de "toda recusa é registrada",
      // mesmo sem pagamento PAID para estornar. Nenhum dinheiro se moveu
      // aqui, então uma falha ao gravar não pode transformar um 409
      // determinístico em 500 — melhor esforço (try/catch, não `.catch()`,
      // para cobrir também uma falha síncrona do dep).
      try {
        await this.deps.record({
          orderId: order.id, userId: input.userId,
          outcome: 'rejected', reasonCode: 'ORDER_NOT_REFUNDABLE',
        });
      } catch {
        // A resposta 409 é determinística e não depende deste registro, mas
        // uma falha sistemática aqui não pode ficar invisível.
        console.error(`[payments] REFUND_REQUEST_AUDIT_WRITE_FAILED order=${order.id}`);
      }
      return { status: 409, code: 'ORDER_NOT_REFUNDABLE' };
    }

    try {
      await this.deps.refund(paid.id);
    } catch (error) {
      // Ler propriedades do erro pode em si lançar (Proxy hostil, acessor
      // que lança) — depois de chamar `refund`, isso também NÃO pode
      // escapar. Sem conseguir sequer ler o erro, não há como afirmar que o
      // dinheiro não se moveu: o default é reconciliação.
      let outcome: 'manual' | 'reconciliation_required';
      let providerError: string;
      try {
        outcome = this.classifyRefundFailure(error);
        providerError = this.extractProviderError(error);
      } catch {
        outcome = 'reconciliation_required';
        providerError = 'erro não representável';
      }
      return this.settleAfterRefundAttempt(order, input.userId, outcome, providerError);
    }

    return this.settleAfterRefundAttempt(order, input.userId, 'refunded', null);
  }

  /**
   * Lê UMA propriedade de um valor lançado sem nunca lançar. Ler propriedade
   * não é operação inócua: um `Proxy` com armadilha `get` hostil, ou um
   * acessor próprio que lança, estoura na leitura — antes de qualquer
   * coerção. Como todo leitor de erro aqui roda DEPOIS de `refund` já ter
   * sido chamado, a ausência do dado é sempre preferível à exceção.
   */
  private readErrorProperty(error: unknown, key: string): unknown {
    try {
      if (typeof error !== 'object' || error === null) return undefined;
      return (error as Record<string, unknown>)[key];
    } catch {
      return undefined;
    }
  }

  /**
   * Classifica a falha do `refund`. SÓ a recusa CONFIRMADA (`retryable`
   * presente e explicitamente `false`) vira `manual` — ela é a única que
   * AFIRMA que o dinheiro não se moveu. Qualquer outra forma — aceito pelo
   * provider (`refundAccepted`), ambígua (`retryable` true: timeout, 5xx,
   * 429), ou de formato desconhecido (string, objeto sem contrato, erro do
   * nosso próprio código) — vai para reconciliação: não sabemos se o
   * estorno ocorreu, e assumir que não é como um reembolso vira dois.
   *
   * TOTAL: nenhuma entrada faz esta função lançar. Erro ilegível cai no
   * default (`reconciliation_required`), que é justamente o desfecho seguro.
   */
  private classifyRefundFailure(error: unknown): 'manual' | 'reconciliation_required' {
    if (this.readErrorProperty(error, 'refundAccepted') === true) return 'reconciliation_required';
    if (this.readErrorProperty(error, 'retryable') === false) return 'manual';
    return 'reconciliation_required';
  }

  /**
   * Nunca deixa `.slice` estourar: um erro pode ser string, objeto sem
   * contrato ou nem `Error`. Prioriza `providerDetail` (erro do provider),
   * depois `.message` de um `Error` de verdade, e só então uma versão segura
   * de `String(error)` para o que sobrar (string crua, objeto sem contrato).
   *
   * TOTAL: nenhuma entrada faz esta função lançar — nem a LEITURA das
   * propriedades (via `readErrorProperty`), nem a coerção (via
   * `safeString`). A garantia mora AQUI, no helper, e não em cada chamador:
   * todo call site — presente e futuro — roda depois de `refund` ter sido
   * chamado, e um `throw` ali faria o cliente repetir o pedido de estorno.
   */
  private extractProviderError(error: unknown): string {
    try {
      const providerDetail = this.readErrorProperty(error, 'providerDetail');
      const rawCandidate: unknown = typeof providerDetail === 'string'
        ? providerDetail
        : error instanceof Error ? this.readErrorProperty(error, 'message') : undefined;
      // `providerDetail` e `error.message` não são garantidamente strings —
      // bibliotecas (e código nosso) já setaram `message` para outra coisa.
      // Coage antes de `.slice`, nunca assuma.
      const raw = typeof rawCandidate === 'string' ? rawCandidate : safeString(rawCandidate ?? error);
      // O provider não controla quanto gravamos: mesmo limite de
      // `markEventFailed` (PaymentEventRepository) para provider_error.
      return raw.slice(0, MAX_PROVIDER_ERROR_LENGTH);
    } catch {
      // Rede de segurança final para o que nem `readErrorProperty` cobre
      // (ex.: `instanceof` sobre um Proxy com armadilha `getPrototypeOf`
      // hostil). Sem conseguir inspecionar nada, resta o literal.
      return 'erro não representável';
    }
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
      // A PARTIR DAQUI o provider já foi chamado: NADA pode escapar, nem uma
      // falha SÍNCRONA de um dep mal ligado (ex.: "record is not a
      // function"). `try/catch` — não `.catch()` — porque `.catch` só
      // protege uma promise rejeitada; uma falha síncrona nunca chega a
      // devolver uma. Melhor esforço absoluto: a resposta ao cliente segue
      // estruturada mesmo que esta segunda tentativa também falhe.
      try {
        await this.deps.record({
          orderId: order.id, userId, outcome: finalOutcome, providerError: finalProviderError,
        });
        await this.deps.acknowledge(order, finalOutcome);
      } catch {
        // Nada além de seguir — o resultado ao cliente é estruturado de
        // qualquer forma.
      }
    }

    if (finalOutcome !== 'refunded') {
      try {
        await this.deps.alertOperator(order, finalOutcome, finalProviderError);
      } catch {
        // Falha ao avisar o financeiro não pode derrubar a resposta ao cliente.
      }
    }

    return finalOutcome === 'refunded'
      ? { status: 200, outcome: 'refunded' }
      : { status: 202, outcome: finalOutcome };
  }
}

/**
 * Liga o serviço puro às implementações reais. Cada chamada busca as
 * instâncias CORRENTES de `OrderService`/`PaymentService` (singletons já
 * cacheados por seus próprios `get*Service()`) e cria uma `RefundRequestService`
 * nova — a própria função não cacheia nada, para que um teste que troque
 * esses singletons (`setOrderServiceForTesting` etc.) nunca herde um
 * fechamento antigo apontando para o fake anterior.
 */
export function getRefundRequestService(): RefundRequestService {
  const payments = getPaymentService();
  const orders = getOrderService();
  const notifications = new NotificationService();

  return new RefundRequestService({
    findOwnedOrder: async (orderId, userId) => {
      try {
        return await orders.requireOwnedOrder(orderId, userId);
      } catch (error) {
        // SÓ o esperado vira null (→ 404 idêntico ao de "pedido inexistente").
        // Um banco fora do ar respondendo "pedido não encontrado" mentiria
        // para quem pagou — precisa propagar e virar 500, nunca um 404 quieto.
        if (error instanceof NotFoundError || error instanceof ForbiddenError) return null;
        throw error;
      }
    },
    listPayments: (orderId) => payments.listForOrder(orderId),
    refund: (paymentId) => payments.refund(paymentId),
    record: createRefundRequest,
    acknowledge: (order, outcome) =>
      notifications.notify({
        // Um envio por desfecho: reenviar o mesmo desfecho não manda dois e-mails.
        dedupeKey: `order:${order.id}:refund-request:${outcome}`,
        template: 'refund-requested',
        recipient: order.userEmail,
        orderId: order.id,
        // O DESFECHO decide o corpo. Um booleano `automatic` mandava a
        // `reconciliation_required` o texto do `manual`, que nega ao cliente
        // um estorno que pode ter acontecido.
        email: refundRequestedEmail({ reference: order.reference, outcome }),
      }),
    alertOperator: (order, outcome, detail) => {
      // O tipo aceita qualquer RefundRequestOutcome, mas quem chama (o caminho
      // fora da janela em `request` e `settleAfterRefundAttempt`) só usa
      // 'manual' e 'reconciliation_required' — 'refunded'/'rejected' nunca alertam.
      const alertOutcome = outcome === 'reconciliation_required' ? 'reconciliation_required' : 'manual';
      return notifications.notify({
        dedupeKey: `order:${order.id}:refund-alert:${outcome}`,
        template: 'refund-alert',
        // financeiro, não o comprador: log de container não é canal que alguém observa.
        recipient: EMAIL_REPLY_TO,
        orderId: order.id,
        email: refundAlertEmail({ reference: order.reference, orderId: order.id, outcome: alertOutcome, detail }),
      });
    },
    logAccessDenied: logOrderAccessDenied,
  });
}
