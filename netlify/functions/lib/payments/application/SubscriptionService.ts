/**
 * SubscriptionService — recorrência.
 *
 * Só produtos elegíveis (catálogo) e pagos com CARTÃO oferecem renovação
 * automática. Vitalício nunca. Nenhum dado bruto de cartão é armazenado: o
 * provider recebe apenas o token gerado no frontend.
 */

import { ConflictError, NotFoundError, ValidationError } from '../domain/errors';
import type { Order, Product, Subscription } from '../domain/types';
import { renewalApprovedEmail, renewalFailedEmail, subscriptionCancelledEmail, subscriptionCreatedEmail } from '../email/templates';
import { orderUrl } from '../config';
import {
  cancelSubscription as cancelSubscriptionRow,
  createSubscription,
  findSubscriptionById,
  findSubscriptionByProviderId,
  listSubscriptionsByUser,
  updateSubscriptionStatus,
} from '../repositories/SubscriptionRepository';
import { findLicenseByOrder } from '../repositories/LicenseRepository';
import { findProductByCode } from '../repositories/ProductRepository';
import type { Payer, PaymentProvider } from '../providers/PaymentProvider';
import { getPaymentProvider } from '../providers/registry';
import { FmmLicenseService, getFmmLicenseService } from './FmmLicenseService';
import { getNotificationService, NotificationService } from './NotificationService';
import { getOrderService, OrderService } from './OrderService';
import { getPaymentService, PaymentService } from './PaymentService';

function intervalLabel(unit: string, count: number): string {
  if (unit === 'months') return count === 1 ? 'mensal' : `a cada ${count} meses`;
  if (unit === 'days') return count === 1 ? 'diária' : `a cada ${count} dias`;
  return `${count} ${unit}`;
}

export type CreateSubscriptionRequest = {
  order: Order;
  product: Product;
  payer: Payer;
  cardToken: string;
  idempotencyKey?: string;
};

export class SubscriptionService {
  constructor(
    private readonly provider: PaymentProvider = getPaymentProvider(),
    private readonly orders: OrderService = getOrderService(),
    private readonly payments: PaymentService = getPaymentService(),
    private readonly licenses: FmmLicenseService = getFmmLicenseService(),
    private readonly notifications: NotificationService = getNotificationService(),
  ) {}

  async create(request: CreateSubscriptionRequest): Promise<Subscription> {
    const { order, product } = request;

    // A regra vem do CATÁLOGO, não de lógica específica do FMM.
    if (product.isLifetime) {
      throw new ValidationError('Produtos vitalícios não têm renovação automática.', 'LIFETIME_NOT_RECURRING');
    }
    if (!product.recurringEligible) {
      throw new ValidationError('Este produto não permite renovação automática.', 'RECURRING_NOT_ELIGIBLE');
    }
    if (!request.cardToken) {
      throw new ValidationError('Token do cartão ausente.', 'CARD_TOKEN_REQUIRED');
    }
    if (order.status === 'PAID') {
      throw new ConflictError('Este pedido já foi pago.', 'ORDER_ALREADY_PAID');
    }

    const intervalUnit = (product.recurringInterval ?? 'months') as 'days' | 'months';
    const intervalCount = product.recurringFrequency ?? 1;

    const result = await this.provider.createSubscription({
      reference: order.reference,
      amountCents: order.amountCents,
      currency: order.currency,
      reason: product.name,
      payer: request.payer,
      cardToken: request.cardToken,
      intervalUnit,
      intervalCount,
      backUrl: orderUrl(order.id),
      idempotencyKey: request.idempotencyKey?.trim() || `sub:${order.id}`,
    });

    const subscription = await createSubscription({
      userId: order.userId,
      productId: product.id,
      orderId: order.id,
      provider: this.provider.name,
      providerSubscriptionId: result.providerSubscriptionId,
      paymentMethodId: null,
      amountCents: order.amountCents,
      currency: order.currency,
      intervalUnit,
      intervalCount,
      status: result.status,
      autoRenew: true,
      nextBillingDate: result.nextBillingDate,
      licenseId: null,
    });

    // Assinatura autorizada = primeira cobrança feita: entrega a licença.
    await this.payments.fulfillSubscriptionOrder(order, product, subscription);

    if (subscription.status === 'ACTIVE') {
      await this.notifications.notify({
        dedupeKey: `sub:${subscription.id}:created`,
        template: 'subscription-created',
        recipient: order.userEmail,
        orderId: order.id,
        email: subscriptionCreatedEmail({
          reference: order.reference,
          productName: product.name,
          amountCents: order.amountCents,
          currency: order.currency,
          method: 'subscription',
          intervalLabel: intervalLabel(intervalUnit, intervalCount),
          nextBillingDate: subscription.nextBillingDate,
        }),
      });
    }

    return subscription;
  }

  async listForUser(userId: string): Promise<Subscription[]> {
    return listSubscriptionsByUser(userId);
  }

  /**
   * Cancelar renovação NÃO apaga histórico e NÃO revoga a licença: ela
   * continua válida até a expiração atual.
   */
  async cancel(subscriptionId: string, userId: string): Promise<Subscription> {
    const subscription = await findSubscriptionById(subscriptionId);
    if (!subscription || subscription.userId !== userId) {
      throw new NotFoundError('Assinatura não encontrada.', 'SUBSCRIPTION_NOT_FOUND');
    }
    if (subscription.status === 'CANCELLED') return subscription;

    if (subscription.providerSubscriptionId) {
      await this.provider.cancelSubscription(subscription.providerSubscriptionId);
    }

    const cancelled = (await cancelSubscriptionRow(subscription.id)) ?? subscription;

    if (subscription.orderId) {
      const order = await this.orders.requireOrder(subscription.orderId);
      const product = await findProductByCode(order.productCode);
      await this.notifications.notify({
        dedupeKey: `sub:${subscription.id}:cancelled`,
        template: 'subscription-cancelled',
        recipient: order.userEmail,
        orderId: order.id,
        email: subscriptionCancelledEmail({
          reference: order.reference,
          productName: product?.name ?? (order.metadata.productName as string) ?? order.productCode,
          amountCents: subscription.amountCents,
          currency: subscription.currency,
          method: 'subscription',
          intervalLabel: intervalLabel(subscription.intervalUnit, subscription.intervalCount),
          nextBillingDate: null,
        }),
      });
    }

    return cancelled;
  }

  /**
   * Renovação vinda do webhook.
   *
   * Idempotente: quem chama já passou pela dedup por `event_key`, e a extensão
   * de validade acontece uma vez por evento. Uma renovação repetida não pode
   * estender a licença duas vezes.
   */
  async applyRenewal(
    providerSubscriptionId: string,
    outcome: 'approved' | 'failed',
    nextBillingDate: string | null,
  ): Promise<{ subscription: Subscription; extended: boolean } | null> {
    const subscription = await findSubscriptionByProviderId(this.provider.name, providerSubscriptionId);
    if (!subscription) return null;

    if (outcome === 'failed') {
      await updateSubscriptionStatus(subscription.id, 'PAST_DUE', nextBillingDate);
      await this.notifyRenewal(subscription, 'failed', null);
      return { subscription, extended: false };
    }

    await updateSubscriptionStatus(subscription.id, 'ACTIVE', nextBillingDate);

    if (!subscription.orderId) return { subscription, extended: false };

    const order = await this.orders.requireOrder(subscription.orderId);
    const product = await this.payments.requireProduct(order.productCode);
    const license = await findLicenseByOrder(order.id);
    if (!license) return { subscription, extended: false };

    const extended = await this.licenses.extendForRenewal(license.id, product);
    await this.notifyRenewal(subscription, 'approved', extended?.expiresAt ?? null);
    return { subscription, extended: Boolean(extended) };
  }

  private async notifyRenewal(
    subscription: Subscription,
    outcome: 'approved' | 'failed',
    newExpiresAt: string | null,
  ): Promise<void> {
    if (!subscription.orderId) return;
    const order = await this.orders.requireOrder(subscription.orderId);
    // Nome de exibição vem do catálogo; o código do produto é o último recurso.
    const product = await findProductByCode(order.productCode);
    const productName = product?.name ?? (order.metadata.productName as string) ?? order.productCode;

    const payload = {
      reference: order.reference,
      productName,
      amountCents: subscription.amountCents,
      currency: subscription.currency,
      method: 'subscription',
      intervalLabel: intervalLabel(subscription.intervalUnit, subscription.intervalCount),
      nextBillingDate: subscription.nextBillingDate,
    };

    await this.notifications.notify({
      // O timestamp da cobrança entra na chave: renovações distintas notificam,
      // reentregas do MESMO evento não.
      dedupeKey: `sub:${subscription.id}:renewal:${outcome}:${newExpiresAt ?? subscription.nextBillingDate ?? 'na'}`,
      template: outcome === 'approved' ? 'renewal-approved' : 'renewal-failed',
      recipient: order.userEmail,
      orderId: order.id,
      email:
        outcome === 'approved'
          ? renewalApprovedEmail({ ...payload, newExpiresAt })
          : renewalFailedEmail(payload),
    });
  }
}

let cached: SubscriptionService | null = null;

export function getSubscriptionService(): SubscriptionService {
  return (cached ??= new SubscriptionService());
}

export function setSubscriptionServiceForTesting(service: SubscriptionService | null): void {
  cached = service;
}
