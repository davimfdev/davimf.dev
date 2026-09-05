/**
 * WebhookService - porta de entrada das notificações do provider.
 *
 * Garantias:
 *  - assinatura inválida => 401, nada é processado;
 *  - o payload NUNCA é fonte de verdade: o provider é reconsultado;
 *  - deduplicação por `payment_events(provider, event_key)` ANTES de qualquer
 *    efeito - um evento repetido não libera produto, não gera outra licença,
 *    não renova duas vezes, não reembolsa duas vezes e não manda e-mail
 *    financeiro duplicado;
 *  - falha transitória libera o evento para o retry do provider.
 */

import { claimEvent, markEventFailed, markEventProcessed, releaseEvent } from '../repositories/PaymentEventRepository';
import type { NormalizedWebhook, PaymentProvider, WebhookRequest } from '../providers/PaymentProvider';
import { getPaymentProvider } from '../providers/registry';
import { getPaymentService, PaymentService } from '../application/PaymentService';
import { getSubscriptionService, SubscriptionService } from '../application/SubscriptionService';
import { findOrderByReference } from '../repositories/OrderRepository';
import { findPaymentByProviderId } from '../repositories/PaymentRepository';

export type WebhookOutcome =
  | { status: 401; result: 'invalid_signature' }
  | { status: 200; result: 'duplicate' | 'processed' | 'ignored' | 'unknown_resource' }
  | { status: 500; result: 'error' };

export class WebhookService {
  constructor(
    private readonly provider: PaymentProvider = getPaymentProvider(),
    private readonly payments: PaymentService = getPaymentService(),
    private readonly subscriptions: SubscriptionService = getSubscriptionService(),
  ) {}

  async handle(request: WebhookRequest): Promise<WebhookOutcome> {
    let event: NormalizedWebhook | null;
    try {
      // Valida assinatura E consulta o estado real no provider.
      event = await this.provider.processWebhook(request);
    } catch (error) {
      console.error('[payments] webhook: falha ao consultar o provedor:', (error as Error).message);
      // 500 faz o provider reenviar - melhor que engolir um pagamento.
      return { status: 500, result: 'error' };
    }

    if (!event) return { status: 401, result: 'invalid_signature' };

    // Reivindica o evento: o segundo INSERT do mesmo event_key volta vazio.
    const claimed = await claimEvent({
      provider: this.provider.name,
      eventKey: event.eventKey,
      eventType: event.eventType,
      payload: event.raw,
    });

    if (!claimed) return { status: 200, result: 'duplicate' };

    try {
      const result = await this.dispatch(event);
      await markEventProcessed(claimed.id, result.orderId ?? null);
      return { status: 200, result: result.handled ? 'processed' : 'unknown_resource' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[payments] webhook: processamento falhou:', message);
      await markEventFailed(claimed.id, message).catch(() => undefined);
      // Sem a liberação, o retry do provider cairia na dedup e o pagamento
      // ficaria pago e não entregue.
      await releaseEvent(claimed.id).catch(() => undefined);
      return { status: 500, result: 'error' };
    }
  }

  private async dispatch(event: NormalizedWebhook): Promise<{ handled: boolean; orderId?: string | null }> {
    switch (event.resource) {
      case 'payment': {
        if (!event.payment || !event.resourceId) return { handled: false };
        const applied = await this.payments.applyProviderResult(
          event.payment.providerPaymentId || event.resourceId,
          event.payment,
          'webhook',
        );
        if (applied) return { handled: true, orderId: applied.order.id };

        // Notificação de um pagamento que não conhecemos: só audita.
        console.warn(`[payments] webhook para pagamento desconhecido: ${event.resourceId}`);
        return { handled: false };
      }

      case 'subscription': {
        if (!event.subscription || !event.resourceId) return { handled: false };
        const outcome = event.subscription.status === 'ACTIVE' ? 'approved' : 'failed';
        const applied = await this.subscriptions.applyRenewal(
          event.subscription.providerSubscriptionId || event.resourceId,
          outcome,
          event.subscription.nextBillingDate,
        );
        return { handled: Boolean(applied), orderId: applied?.subscription.orderId ?? null };
      }

      case 'chargeback':
      case 'claim': {
        // Contestação suspende via o pagamento associado, quando localizável.
        const orderId = await this.resolveOrderId(event);
        if (!orderId) return { handled: false };
        await this.payments.reconcile(await this.paymentIdForOrder(orderId), 'webhook').catch(() => undefined);
        return { handled: true, orderId };
      }

      case 'fraud':
        // Só auditoria: nenhum efeito automático sobre pedido ou licença.
        console.warn(`[payments] alerta de fraude recebido: ${event.eventType} ${event.resourceId ?? ''}`);
        return { handled: true };

      default:
        return { handled: false };
    }
  }

  private async resolveOrderId(event: NormalizedWebhook): Promise<string | null> {
    const raw = event.raw as Record<string, unknown>;
    const reference = typeof raw.external_reference === 'string' ? raw.external_reference : null;
    if (reference) {
      const order = await findOrderByReference(reference);
      if (order) return order.id;
    }
    if (event.resourceId) {
      const payment = await findPaymentByProviderId(this.provider.name, event.resourceId);
      if (payment) return payment.orderId;
    }
    return null;
  }

  private async paymentIdForOrder(orderId: string): Promise<string> {
    const payments = await this.payments.listForOrder(orderId);
    const target = payments.find((payment) => payment.status === 'PAID') ?? payments[0];
    return target?.id ?? '';
  }
}

let cached: WebhookService | null = null;

export function getWebhookService(): WebhookService {
  return (cached ??= new WebhookService());
}

export function setWebhookServiceForTesting(service: WebhookService | null): void {
  cached = service;
}
