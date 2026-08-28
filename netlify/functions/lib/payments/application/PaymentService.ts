/**
 * PaymentService — dono do PAGAMENTO.
 *
 * Orquestra: reserva a tentativa, chama o PaymentProvider (nunca o Mercado
 * Pago diretamente), persiste o resultado normalizado e, quando o pagamento
 * fica PAID, dispara a entrega via OrderService + FmmLicenseService.
 *
 * Ordem de garantias: SEGURANÇA > CORREÇÃO FINANCEIRA > IDEMPOTÊNCIA >
 * ENTREGA DA LICENÇA > MODULARIDADE > UX.
 */

import { randomUUID } from 'node:crypto';
import { FMM_DOWNLOAD_URL, myKeysUrl } from '../config';
import { ConflictError, ValidationError } from '../domain/errors';
import type { Cents } from '../domain/money';
import type {
  Order,
  Payment,
  PaymentMethodKind,
  PaymentStatus,
  Product,
  Subscription,
} from '../domain/types';
import {
  boletoCreatedEmail,
  chargebackEmail,
  fmmLicenseEmail,
  paymentApprovedEmail,
  paymentCancelledEmail,
  paymentDeclinedEmail,
  paymentExpiredEmail,
  pixCreatedEmail,
  refundEmail,
  type OrderSummary,
} from '../email/templates';
import {
  findPaymentById,
  findPaymentByProviderId,
  hasOpenPaymentForOrder,
  listPaymentsByOrder,
  reservePayment,
  updatePayment,
} from '../repositories/PaymentRepository';
import { findProductByCode } from '../repositories/ProductRepository';
import type {
  Payer,
  PaymentProvider,
  ProviderPaymentResult,
} from '../providers/PaymentProvider';
import { getPaymentProvider } from '../providers/registry';
import { FmmLicenseService, getFmmLicenseService } from './FmmLicenseService';
import { getNotificationService, NotificationService } from './NotificationService';
import { getOrderService, OrderService } from './OrderService';
import { getPayerProfileService, PayerProfileService } from './PayerProfileService';

/** Origem da atualização — decide se pode notificar. */
export type UpdateSource = 'checkout' | 'webhook' | 'polling' | 'admin';

export type PaymentView = Payment & {
  productName: string;
  orderReference: string;
  /** Só presente quando o pedido está PAID e entregou licença. */
  license?: { key: string | null; keyPrefix: string; expiresAt: string | null; status: string };
  downloadUrl?: string;
};

export type CreateChargeRequest = {
  order: Order;
  product: Product;
  payer: Payer;
  /** Chave da TENTATIVA (não do pedido). Duplo clique reaproveita a cobrança. */
  idempotencyKey?: string;
  /** Explicit consent; this value is consumed here and never reaches the provider. */
  savePayerProfile?: boolean;
  /**
   * Perfil REVISADO pelo usuário, quando ele difere do pagador da transação —
   * é o caso do cartão, cujo `payer` carrega o documento do PORTADOR. Também
   * é consumido aqui e nunca chega ao provider.
   */
  payerProfile?: Payer;
  /**
   * Device ID real gerado pelo SDK do provider no navegador. Opcional,
   * request-scoped: só é repassado ao provider e nunca persistido nem logado.
   */
  deviceId?: string;
  /** Metadados reais derivados da conta autenticada no site. */
  payerMetadata?: { registrationDate?: string };
};

export type CreateCardChargeRequest = CreateChargeRequest & {
  cardToken: string;
  paymentMethodId: string;
  installments: number;
};

const MAX_INSTALLMENTS = 12;

/**
 * Categoria do item no catálogo do provider. O produto é software licenciado;
 * `software` é a categoria genérica e verdadeira. NÃO trocar por um id de
 * catálogo MLB inventado só para pontuar em qualidade.
 */
const PRODUCT_CATEGORY_ID = 'software';

export class PaymentService {
  constructor(
    private readonly provider: PaymentProvider = getPaymentProvider(),
    private readonly orders: OrderService = getOrderService(),
    private readonly licenses: FmmLicenseService = getFmmLicenseService(),
    private readonly notifications: NotificationService = getNotificationService(),
    private readonly payerProfiles: Pick<PayerProfileService, 'saveFromCharge'> = getPayerProfileService(),
  ) {}

  private async savePayerProfileIfConsented(request: CreateChargeRequest): Promise<void> {
    if (request.savePayerProfile !== true) return;
    try {
      // O consentimento guarda o que o usuário REVISOU. Só na ausência dele o
      // pagador da transação serve de fonte.
      await this.payerProfiles.saveFromCharge(request.order.userId, request.payerProfile ?? request.payer);
    } catch {
      // Best effort only: profile storage never changes a payment outcome.
      console.error('[payments] PAYER_PROFILE_SAVE_FAILED');
    }
  }

  // ---------------------------------------------------------- criação -----

  private async reserve(
    request: CreateChargeRequest,
    method: PaymentMethodKind,
    installments = 1,
  ): Promise<Payment> {
    const { order } = request;
    if (order.status === 'PAID') {
      throw new ConflictError('Este pedido já foi pago.', 'ORDER_ALREADY_PAID');
    }
    if (order.status !== 'PENDING' && order.status !== 'PROCESSING') {
      throw new ConflictError('Este pedido não aceita mais pagamento.', 'ORDER_NOT_PAYABLE');
    }

    // A chave de idempotência é derivada do PEDIDO + método quando o cliente
    // não manda uma: refresh e retry caem sempre na mesma tentativa.
    const idempotencyKey = request.idempotencyKey?.trim() || `${order.id}:${method}`;

    const reserved = await reservePayment({
      orderId: order.id,
      userId: order.userId,
      provider: this.provider.name,
      method,
      // O valor vem do PEDIDO, que veio do banco. Nunca do request.
      amountCents: order.amountCents,
      currency: order.currency,
      installments,
      idempotencyKey,
    });

    // Já cobrado antes com esta chave: devolve a tentativa existente.
    if (reserved.providerPaymentId) return reserved;

    // Bloqueia duplo pagamento: outra tentativa viva no mesmo pedido.
    if (await hasOpenPaymentForOrder(order.id, reserved.id)) {
      throw new ConflictError(
        'Já existe um pagamento em andamento para este pedido.',
        'PAYMENT_ALREADY_IN_PROGRESS',
      );
    }

    return reserved;
  }

  /**
   * Entrada neutra da cobrança.
   *
   * Todo valor COMERCIAL (quantidade, código e categoria do item) sai do
   * `Order`/`Product` que vieram do banco — o corpo HTTP nunca é fonte disso.
   * O Device ID é a única exceção request-scoped: atravessa em memória, não
   * entra em `payments.details` nem em log.
   *
   * `payerMetadata` só atravessa quando veio de uma fonte autenticada. Hoje a
   * data de cadastro é o primeiro login registrado em dashboard_sessions;
   * compra anterior continua ausente enquanto não houver fonte confiável.
   */
  private baseInput(request: CreateChargeRequest, payment: Payment) {
    return {
      reference: request.order.reference,
      amountCents: request.order.amountCents,
      currency: request.order.currency,
      description: request.product.name,
      payer: request.payer,
      idempotencyKey: payment.idempotencyKey,
      quantity: request.order.quantity,
      itemCode: request.product.code,
      itemCategoryId: PRODUCT_CATEGORY_ID,
      // Único campo request-scoped: só viaja quando o SDK gerou um Device ID
      // de verdade, e morre no header do provider — nunca é persistido.
      ...(request.deviceId ? { deviceId: request.deviceId } : {}),
      ...(request.payerMetadata ? { payerMetadata: request.payerMetadata } : {}),
      metadata: { orderId: request.order.id, productCode: request.product.code },
    };
  }

  async createPix(request: CreateChargeRequest): Promise<PaymentView> {
    const payment = await this.reserve(request, 'pix');
    // Retry/refresh: a tentativa já foi cobrada. Relê o pedido para devolver o
    // estado atual (inclusive a licença, se o pagamento já foi confirmado).
    if (payment.providerPaymentId) {
      await this.savePayerProfileIfConsented(request);
      return this.view(payment, await this.orders.requireOrder(request.order.id), request.product);
    }

    const result = await this.callProvider(payment, () =>
      this.provider.createPixPayment({ ...this.baseInput(request, payment), expiresInMinutes: 30 }),
    );

    const saved = await this.persist(payment, result);
    await this.savePayerProfileIfConsented(request);
    await this.afterUpdate(saved, request.order, request.product, 'checkout');
    // Relê o pedido: um pagamento aprovado na hora (cartão) já virou PAID e
    // ganhou licença — a resposta reflete o estado final, não o pré-cobrança.
    return this.view(saved, await this.orders.requireOrder(request.order.id), request.product);
  }

  async createBoleto(request: CreateChargeRequest): Promise<PaymentView> {
    const payment = await this.reserve(request, 'boleto');
    // Retry/refresh: a tentativa já foi cobrada. Relê o pedido para devolver o
    // estado atual (inclusive a licença, se o pagamento já foi confirmado).
    if (payment.providerPaymentId) {
      await this.savePayerProfileIfConsented(request);
      return this.view(payment, await this.orders.requireOrder(request.order.id), request.product);
    }

    const result = await this.callProvider(payment, () =>
      this.provider.createBoletoPayment({ ...this.baseInput(request, payment), expiresInDays: 3 }),
    );

    const saved = await this.persist(payment, result);
    await this.savePayerProfileIfConsented(request);
    await this.afterUpdate(saved, request.order, request.product, 'checkout');
    // Relê o pedido: um pagamento aprovado na hora (cartão) já virou PAID e
    // ganhou licença — a resposta reflete o estado final, não o pré-cobrança.
    return this.view(saved, await this.orders.requireOrder(request.order.id), request.product);
  }

  async createCard(request: CreateCardChargeRequest): Promise<PaymentView> {
    if (!request.cardToken) throw new ValidationError('Token do cartão ausente.', 'CARD_TOKEN_REQUIRED');
    const installments = Number(request.installments) || 1;
    if (!Number.isSafeInteger(installments) || installments < 1 || installments > MAX_INSTALLMENTS) {
      throw new ValidationError('Número de parcelas inválido.', 'INVALID_INSTALLMENTS');
    }

    const payment = await this.reserve(request, 'card', installments);
    // Retry/refresh: a tentativa já foi cobrada. Relê o pedido para devolver o
    // estado atual (inclusive a licença, se o pagamento já foi confirmado).
    if (payment.providerPaymentId) {
      await this.savePayerProfileIfConsented(request);
      return this.view(payment, await this.orders.requireOrder(request.order.id), request.product);
    }

    const result = await this.callProvider(payment, () =>
      this.provider.createCardPayment({
        ...this.baseInput(request, payment),
        // Só a referência segura: token de uso único + id da bandeira.
        cardToken: request.cardToken,
        paymentMethodId: request.paymentMethodId,
        installments,
      }),
    );

    const saved = await this.persist(payment, result);
    await this.savePayerProfileIfConsented(request);
    await this.afterUpdate(saved, request.order, request.product, 'checkout');
    // Relê o pedido: um pagamento aprovado na hora (cartão) já virou PAID e
    // ganhou licença — a resposta reflete o estado final, não o pré-cobrança.
    return this.view(saved, await this.orders.requireOrder(request.order.id), request.product);
  }

  /**
   * Timeout/queda do provider deixa a tentativa em PROCESSING — nunca em
   * FAILED: a cobrança pode ter sido criada do outro lado, e o webhook (ou a
   * reconciliação) resolve. Marcar FAILED aqui abriria caminho para cobrar
   * duas vezes.
   */
  private async callProvider(
    payment: Payment,
    run: () => Promise<ProviderPaymentResult>,
  ): Promise<ProviderPaymentResult> {
    try {
      return await run();
    } catch (error) {
      const retryable = (error as { retryable?: boolean })?.retryable === true;
      await updatePayment({
        id: payment.id,
        status: retryable ? 'PROCESSING' : 'FAILED',
        statusDetail: retryable ? 'provider_unreachable' : 'provider_rejected',
      }).catch(() => undefined);
      throw error;
    }
  }

  // ------------------------------------------------------- persistência ----

  private async persist(payment: Payment, result: ProviderPaymentResult): Promise<Payment> {
    // CORREÇÃO FINANCEIRA: se o provider devolver valor diferente do pedido,
    // não confirmamos nada — o pagamento fica retido para investigação.
    const amountMismatch = result.amountCents !== payment.amountCents;
    const status: PaymentStatus = amountMismatch && result.status === 'PAID' ? 'PROCESSING' : result.status;
    if (amountMismatch) {
      console.error(
        `[payments] divergência de valor no pagamento ${payment.id}: esperado ${payment.amountCents}, provider ${result.amountCents}`,
      );
    }

    return updatePayment({
      id: payment.id,
      providerPaymentId: result.providerPaymentId || null,
      providerTxnId: result.providerTxnId,
      status,
      statusDetail: result.statusDetail,
      installments: result.installments,
      refundedCents: result.refundedCents,
      // `display` só carrega dado NÃO sensível (QR, linha digitável, últimos 4).
      details: { ...payment.details, display: result.display, amountMismatch },
      expiresAt: result.expiresAt,
      paidAt: status === 'PAID' ? new Date().toISOString() : null,
    });
  }

  // -------------------------------------------------- transições/entrega ---

  /**
   * Aplica o efeito de negócio de um status. Chamado pelo checkout, pelo
   * webhook e pela reconciliação — sempre idempotente.
   */
  private async afterUpdate(
    payment: Payment,
    order: Order,
    product: Product,
    source: UpdateSource,
  ): Promise<void> {
    switch (payment.status) {
      case 'PAID':
        await this.fulfill(payment, order, product, source);
        return;
      case 'PENDING':
        // Pix/boleto recém-criados: instruções de pagamento.
        if (source === 'checkout') await this.notifyPending(payment, order, product);
        return;
      case 'DECLINED':
      case 'FAILED':
        if (source !== 'polling') {
          await this.notify(payment, order, product, 'declined', paymentDeclinedEmail(this.summary(payment, order, product)));
        }
        return;
      case 'EXPIRED':
        await this.orders.updateStatus(order.id, 'EXPIRED').catch(() => null);
        if (source !== 'polling') {
          await this.notify(payment, order, product, 'expired', paymentExpiredEmail(this.summary(payment, order, product)));
        }
        return;
      case 'CANCELLED':
        await this.orders.updateStatus(order.id, 'CANCELLED').catch(() => null);
        if (source !== 'polling') {
          await this.notify(payment, order, product, 'cancelled', paymentCancelledEmail(this.summary(payment, order, product)));
        }
        return;
      case 'REFUNDED':
      case 'PARTIALLY_REFUNDED':
        await this.applyRefundEffects(payment, order, product, source);
        return;
      case 'CHARGEBACK':
        await this.orders.updateStatus(order.id, 'CHARGEBACK').catch(() => null);
        // Contestação SUSPENDE (não revoga, não apaga) e mantém histórico.
        await this.licenses.changeStatus(order.id, 'SUSPENDED');
        if (source !== 'polling') {
          await this.notify(payment, order, product, 'chargeback', chargebackEmail(this.summary(payment, order, product)));
        }
        return;
      default:
        return;
    }
  }

  /**
   * Entrega. A chave NUNCA sai daqui antes de PAID, e a ordem é:
   * persistir a licença -> só então notificar.
   */
  private async fulfill(payment: Payment, order: Order, product: Product, source: UpdateSource): Promise<void> {
    const transitioned = await this.orders.markPaid(order.id, payment.paidAt ?? new Date().toISOString());
    const paidOrder = transitioned ?? (await this.orders.requireOrder(order.id));

    if (product.fulfillmentKind !== 'fmm_license') {
      await this.orders.markFulfilled(order.id);
      await this.notify(payment, paidOrder, product, 'paid', paymentApprovedEmail(this.summary(payment, paidOrder, product)));
      return;
    }

    // Idempotente: reaproveita a licença do pedido se ela já existir.
    const issued = await this.licenses.issueForOrder(paidOrder, product);
    await this.orders.markFulfilled(order.id);

    await this.notify(
      payment,
      paidOrder,
      product,
      'fmm-license',
      fmmLicenseEmail({
        ...this.summary(payment, paidOrder, product),
        planName: product.name,
        // A chave foi PERSISTIDA antes; o e-mail só transporta o que já existe.
        licenseKey: issued.key ?? '(consulte em Minhas Chaves)',
        expiresAt: issued.license.expiresAt,
        isLifetime: product.isLifetime,
        downloadUrl: FMM_DOWNLOAD_URL,
        keysUrl: myKeysUrl(),
      }),
    );
  }

  private async applyRefundEffects(
    payment: Payment,
    order: Order,
    product: Product,
    source: UpdateSource,
  ): Promise<void> {
    const partial = payment.status === 'PARTIALLY_REFUNDED';
    await this.orders.updateStatus(order.id, partial ? 'PARTIALLY_REFUNDED' : 'REFUNDED').catch(() => null);

    // Integral revoga; parcial só suspende. Em nenhum caso apaga.
    await this.licenses.changeStatus(order.id, partial ? 'SUSPENDED' : 'REVOKED');

    if (source === 'polling') return;
    await this.notify(
      payment,
      order,
      product,
      partial ? 'refund-partial' : 'refund',
      refundEmail({
        ...this.summary(payment, order, product),
        refundedCents: payment.refundedCents,
        partial,
      }),
    );
  }

  private async notifyPending(payment: Payment, order: Order, product: Product): Promise<void> {
    const display = (payment.details.display ?? {}) as Record<string, unknown>;
    const summary = this.summary(payment, order, product);

    if (payment.method === 'pix' && typeof display.pixQrCode === 'string') {
      await this.notify(payment, order, product, 'pix-created', pixCreatedEmail({
        ...summary,
        pixCode: display.pixQrCode,
        expiresAt: payment.expiresAt,
      }));
      return;
    }
    if (payment.method === 'boleto') {
      await this.notify(payment, order, product, 'boleto-created', boletoCreatedEmail({
        ...summary,
        digitableLine: typeof display.boletoDigitableLine === 'string' ? display.boletoDigitableLine : null,
        ticketUrl: typeof display.ticketUrl === 'string' ? display.ticketUrl : null,
        expiresAt: payment.expiresAt,
      }));
    }
  }

  private summary(payment: Payment, order: Order, product: Product): OrderSummary {
    return {
      reference: order.reference,
      productName: product.name,
      amountCents: order.amountCents,
      currency: order.currency,
      method: payment.method,
    };
  }

  private async notify(
    payment: Payment,
    order: Order,
    _product: Product,
    template: string,
    email: { subject: string; html: string; text: string },
  ): Promise<void> {
    await this.notifications.notify({
      // Chave estável por (pedido, template): reprocessar o mesmo evento não
      // manda o mesmo e-mail duas vezes.
      dedupeKey: `order:${order.id}:${template}`,
      template,
      recipient: order.userEmail,
      orderId: order.id,
      email,
    });
    void payment;
  }

  // ------------------------------------------------------- reconciliação ---

  /**
   * Consulta o provider e aplica o estado REAL. É o que o polling usa: a
   * confirmação nunca vem do frontend, sempre do provider.
   */
  async reconcile(paymentId: string, source: UpdateSource = 'polling'): Promise<PaymentView> {
    const payment = await this.requirePayment(paymentId);
    const order = await this.orders.requireOrder(payment.orderId);
    const product = await this.requireProduct(order.productCode);

    if (!payment.providerPaymentId) return this.view(payment, order, product);

    // Estado terminal não é reaberto por consulta.
    if (payment.status === 'PAID' || payment.status === 'REFUNDED' || payment.status === 'CHARGEBACK') {
      return this.view(payment, order, product);
    }

    let result: ProviderPaymentResult;
    try {
      result = await this.provider.getPayment(payment.providerPaymentId);
    } catch (error) {
      console.error('[payments] reconciliação falhou:', (error as Error).message);
      return this.view(payment, order, product);
    }

    if (result.status === payment.status) return this.view(payment, order, product);

    const saved = await this.persist(payment, result);
    await this.afterUpdate(saved, order, product, source);
    const finalOrder = await this.orders.requireOrder(order.id);
    return this.view(saved, finalOrder, product);
  }

  /** Caminho do webhook: o provider já trouxe o estado real e verificado. */
  async applyProviderResult(
    providerPaymentId: string,
    result: ProviderPaymentResult,
    source: UpdateSource = 'webhook',
  ): Promise<{ payment: Payment; order: Order } | null> {
    const payment = await findPaymentByProviderId(this.provider.name, providerPaymentId);
    if (!payment) return null;

    const order = await this.orders.requireOrder(payment.orderId);
    const product = await this.requireProduct(order.productCode);

    const saved = await this.persist(payment, result);
    await this.afterUpdate(saved, order, product, source);
    return { payment: saved, order: await this.orders.requireOrder(order.id) };
  }

  // -------------------------------------------------------------- refund ---

  /** Rota administrativa. A autorização é checada no handler, não aqui. */
  async refund(paymentId: string, amountCents?: Cents): Promise<PaymentView> {
    const payment = await this.requirePayment(paymentId);
    if (payment.status !== 'PAID' && payment.status !== 'PARTIALLY_REFUNDED') {
      throw new ConflictError('Só é possível reembolsar um pagamento aprovado.', 'PAYMENT_NOT_REFUNDABLE');
    }
    if (!payment.providerPaymentId) {
      throw new ConflictError('Pagamento sem referência no provedor.', 'PAYMENT_NOT_REFUNDABLE');
    }
    const remaining = payment.amountCents - payment.refundedCents;
    if (amountCents !== undefined && (amountCents <= 0 || amountCents > remaining)) {
      throw new ValidationError('Valor de reembolso inválido.', 'INVALID_REFUND_AMOUNT');
    }

    const order = await this.orders.requireOrder(payment.orderId);
    const product = await this.requireProduct(order.productCode);

    const result = await this.provider.refundPayment({
      providerPaymentId: payment.providerPaymentId,
      providerTxnId: payment.providerTxnId,
      amountCents,
      // Chave determinística: reenviar o mesmo refund não devolve em dobro.
      idempotencyKey: `refund:${payment.id}:${amountCents ?? 'full'}`,
    });

    const totalRefunded = Math.min(payment.amountCents, Math.max(result.refundedCents, payment.refundedCents));
    const status: PaymentStatus = totalRefunded >= payment.amountCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    try {
      const saved = await updatePayment({
        id: payment.id,
        status,
        statusDetail: 'refunded',
        refundedCents: totalRefunded,
      });

      await this.afterUpdate(saved, order, product, 'admin');
      return this.view(saved, await this.orders.requireOrder(order.id), product);
    } catch (error) {
      // A chamada ao provider já retornou sucesso. Marcar explicitamente a
      // ambiguidade impede o solicitante de repetir um estorno que já ocorreu.
      const wrapped = error instanceof Error ? error : new Error('Falha local após o estorno.');
      Object.assign(wrapped, { refundAccepted: true });
      throw wrapped;
    }
  }

  // ----------------------------------------------------------- consultas ---

  async requirePayment(paymentId: string): Promise<Payment> {
    const payment = await findPaymentById(paymentId);
    if (!payment) throw new ValidationError('Pagamento não encontrado.', 'PAYMENT_NOT_FOUND');
    return payment;
  }

  async requireProduct(code: string): Promise<Product> {
    const product = await findProductByCode(code);
    if (!product) throw new ValidationError('Produto do pedido não existe mais.', 'PRODUCT_NOT_FOUND');
    return product;
  }

  async listForOrder(orderId: string): Promise<Payment[]> {
    return listPaymentsByOrder(orderId);
  }

  /** Projeção segura para o frontend: nunca expõe payload cru do provider. */
  async view(payment: Payment, order: Order, product: Product): Promise<PaymentView> {
    const base: PaymentView = {
      ...payment,
      productName: product.name,
      orderReference: order.reference,
    };

    if (order.status !== 'PAID' || product.fulfillmentKind !== 'fmm_license') return base;

    const issued = await this.licenses.findByOrder(order.id);
    if (!issued) return base;

    return {
      ...base,
      license: {
        key: issued.key,
        keyPrefix: issued.license.keyPrefix,
        expiresAt: issued.license.expiresAt,
        status: issued.license.status,
      },
      downloadUrl: FMM_DOWNLOAD_URL,
    };
  }

  /** Assinatura recém-criada precisa do mesmo pós-processamento do checkout. */
  async fulfillSubscriptionOrder(order: Order, product: Product, subscription: Subscription): Promise<void> {
    const payment = await reservePayment({
      orderId: order.id,
      userId: order.userId,
      provider: this.provider.name,
      method: 'subscription',
      amountCents: order.amountCents,
      currency: order.currency,
      installments: 1,
      idempotencyKey: `sub:${subscription.id}:initial`,
    });

    const saved = await updatePayment({
      id: payment.id,
      providerPaymentId: subscription.providerSubscriptionId,
      status: subscription.status === 'ACTIVE' ? 'PAID' : 'PENDING',
      statusDetail: `subscription_${subscription.status.toLowerCase()}`,
      details: { subscriptionId: subscription.id },
      paidAt: subscription.status === 'ACTIVE' ? new Date().toISOString() : null,
    });

    await this.afterUpdate(saved, order, product, 'checkout');
  }

  get providerName(): string {
    return this.provider.name;
  }

  /** Escape hatch controlado para os serviços de assinatura. */
  get licenseService(): FmmLicenseService {
    return this.licenses;
  }

  get orderService(): OrderService {
    return this.orders;
  }

  get notificationService(): NotificationService {
    return this.notifications;
  }
}

let cached: PaymentService | null = null;

export function getPaymentService(): PaymentService {
  return (cached ??= new PaymentService());
}

export function setPaymentServiceForTesting(service: PaymentService | null): void {
  cached = service;
}

export { randomUUID };
