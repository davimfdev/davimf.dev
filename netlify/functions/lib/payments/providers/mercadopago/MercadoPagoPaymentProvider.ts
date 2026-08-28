/**
 * MercadoPagoPaymentProvider — a ÚNICA classe do projeto que conhece o
 * Mercado Pago.
 *
 * Nunca gera licença FMM, nunca manda e-mail, nunca decide preço. Só traduz
 * chamadas do domínio para a API do provider e devolve resultado normalizado.
 */

import { ProviderError, ValidationError } from '../../domain/errors';
import { centsToDecimalString, decimalToCents } from '../../domain/money';
import type {
  ChargeSavedMethodInput,
  CreateBoletoInput,
  CreateCardInput,
  CreatePixInput,
  CreateSubscriptionInput,
  NormalizedWebhook,
  Payer,
  PaymentProvider,
  ProviderPaymentResult,
  ProviderSavedMethod,
  ProviderSubscriptionResult,
  RefundInput,
  RefundResult,
  SavePaymentMethodInput,
  WebhookRequest,
} from '../PaymentProvider';
import { MercadoPagoClient, type MpClientOptions, pick, pickNumber, pickString } from './client';
import { mapOrderToPayment, mapPaymentStatus, mapPreapproval } from './mapping';
import { verifyWebhookSignature } from './signature';

const DEFAULT_PIX_EXPIRY_MINUTES = 30;
const DEFAULT_BOLETO_EXPIRY_DAYS = 3;
type MercadoPagoEnvironment = 'sandbox' | 'production';

type OrderPayer = {
  email: string;
  first_name?: string;
  last_name?: string;
  identification?: { type: string; number: string };
  address?: Record<string, string>;
};

function buildPayer(payer: Payer, options: { requireIdentification?: boolean; requireAddress?: boolean } = {}): OrderPayer {
  if (!payer.email) throw new ValidationError('E-mail do pagador é obrigatório.', 'PAYER_EMAIL_REQUIRED');

  const out: OrderPayer = { email: payer.email };
  if (payer.firstName) out.first_name = payer.firstName;
  if (payer.lastName) out.last_name = payer.lastName;

  if (payer.identification) {
    out.identification = { type: payer.identification.type, number: payer.identification.number };
  } else if (options.requireIdentification) {
    throw new ValidationError('CPF/CNPJ do pagador é obrigatório para este meio de pagamento.', 'PAYER_IDENTIFICATION_REQUIRED');
  }

  if (payer.address) {
    out.address = {
      zip_code: payer.address.zipCode,
      street_name: payer.address.streetName,
      street_number: payer.address.streetNumber,
      neighborhood: payer.address.neighborhood ?? '',
      city: payer.address.city ?? '',
      state: payer.address.state ?? '',
    };
  } else if (options.requireAddress) {
    throw new ValidationError('Endereço do pagador é obrigatório para boleto.', 'PAYER_ADDRESS_REQUIRED');
  }

  return out;
}

/**
 * A Orders API usa compradores sintéticos em teste. O e-mail real continua no
 * pedido local (entrega/licença); somente o payload enviado ao MP é trocado.
 */
function sandboxPayer(payer: Payer, method: 'pix' | 'card' | 'boleto'): OrderPayer {
  const built = buildPayer(payer, {
    requireIdentification: method !== 'pix',
    requireAddress: method === 'boleto',
  });
  return {
    ...built,
    email: method === 'card' ? 'test@testuser.com' : 'test_user_br@testuser.com',
    ...(method === 'pix' ? { first_name: 'APRO' } : {}),
  };
}

/** Duração ISO-8601, formato aceito por `expiration_time` na Orders API. */
function isoDuration(minutes: number): string {
  if (minutes % (24 * 60) === 0) return `P${minutes / (24 * 60)}D`;
  if (minutes % 60 === 0) return `PT${minutes / 60}H`;
  return `PT${minutes}M`;
}

export class MercadoPagoPaymentProvider implements PaymentProvider {
  readonly name = 'mercadopago';

  private readonly client: MercadoPagoClient;
  private readonly environment: MercadoPagoEnvironment;

  constructor(options: (MpClientOptions | { client: MercadoPagoClient }) & { environment?: MercadoPagoEnvironment } = {}) {
    this.client = 'client' in options && options.client
      ? options.client
      : new MercadoPagoClient(options as MpClientOptions);
    this.environment = options.environment ?? 'production';
  }

  private payer(payer: Payer, method: 'pix' | 'card' | 'boleto'): OrderPayer {
    if (this.environment === 'sandbox') return sandboxPayer(payer, method);
    return buildPayer(payer, {
      requireIdentification: method !== 'pix',
      requireAddress: method === 'boleto',
    });
  }

  // ------------------------------------------------------------ cobranças --

  private async createOrder(
    body: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<ProviderPaymentResult> {
    const order = await this.client.request({
      method: 'POST',
      path: '/v1/orders',
      body,
      idempotencyKey,
    });
    return mapOrderToPayment(order);
  }

  async createPixPayment(input: CreatePixInput): Promise<ProviderPaymentResult> {
    const amount = centsToDecimalString(input.amountCents);
    const minutes = input.expiresInMinutes ?? DEFAULT_PIX_EXPIRY_MINUTES;

    return this.createOrder(
      {
        type: 'online',
        processing_mode: 'automatic',
        total_amount: amount,
        external_reference: input.reference,
        description: input.description,
        payer: this.payer(input.payer, 'pix'),
        transactions: {
          payments: [
            {
              amount,
              expiration_time: isoDuration(minutes),
              payment_method: { id: 'pix', type: 'bank_transfer' },
            },
          ],
        },
      },
      input.idempotencyKey,
    );
  }

  async createCardPayment(input: CreateCardInput): Promise<ProviderPaymentResult> {
    if (!input.cardToken) {
      throw new ValidationError('Token do cartão ausente.', 'CARD_TOKEN_REQUIRED');
    }
    const amount = centsToDecimalString(input.amountCents);

    return this.createOrder(
      {
        type: 'online',
        processing_mode: 'automatic',
        total_amount: amount,
        external_reference: input.reference,
        description: input.description,
        payer: this.payer(input.payer, 'card'),
        transactions: {
          payments: [
            {
              amount,
              payment_method: {
                // Só a referência segura: id da bandeira + token de uso único.
                id: input.paymentMethodId,
                type: 'credit_card',
                token: input.cardToken,
                installments: input.installments,
              },
            },
          ],
        },
      },
      input.idempotencyKey,
    );
  }

  async createBoletoPayment(input: CreateBoletoInput): Promise<ProviderPaymentResult> {
    const amount = centsToDecimalString(input.amountCents);
    const days = input.expiresInDays ?? DEFAULT_BOLETO_EXPIRY_DAYS;

    return this.createOrder(
      {
        type: 'online',
        processing_mode: 'automatic',
        total_amount: amount,
        external_reference: input.reference,
        description: input.description,
        payer: this.payer(input.payer, 'boleto'),
        transactions: {
          payments: [
            {
              amount,
              expiration_time: isoDuration(days * 24 * 60),
              payment_method: { id: 'bolbradesco', type: 'ticket' },
            },
          ],
        },
      },
      input.idempotencyKey,
    );
  }

  async getPayment(providerPaymentId: string): Promise<ProviderPaymentResult> {
    if (!providerPaymentId) throw new ValidationError('providerPaymentId ausente.');
    // IDs de Order começam com "ORD"; notificações legadas trazem id numérico
    // de /v1/payments. Consultamos o endpoint correspondente.
    const isLegacyPayment = /^\d+$/.test(providerPaymentId);
    const order = await this.client.request({
      method: 'GET',
      path: isLegacyPayment ? `/v1/payments/${providerPaymentId}` : `/v1/orders/${providerPaymentId}`,
    });
    return mapOrderToPayment(order);
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    const body: Record<string, unknown> =
      input.amountCents === undefined
        ? {}
        : {
            transactions: [
              {
                id: input.providerTxnId ?? undefined,
                amount: centsToDecimalString(input.amountCents),
              },
            ],
          };

    const result = await this.client.request({
      method: 'POST',
      path: `/v1/orders/${input.providerPaymentId}/refund`,
      body,
      idempotencyKey: input.idempotencyKey,
    });

    // A resposta do refund traz a Order atualizada; reaproveitamos o mapper.
    const mapped = mapOrderToPayment(result);
    const refundedFromResponse = pickNumber(result, 'amount');
    const refundedCents =
      mapped.refundedCents > 0
        ? mapped.refundedCents
        : refundedFromResponse !== null
          ? decimalToCents(refundedFromResponse)
          : (input.amountCents ?? mapped.amountCents);

    const status = mapped.status === 'PAID'
      ? (refundedCents >= mapped.amountCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED')
      : mapped.status;

    return { status, refundedCents, raw: result };
  }

  // -------------------------------------------------- meios salvos (token) --

  async savePaymentMethod(input: SavePaymentMethodInput): Promise<ProviderSavedMethod> {
    if (!input.cardToken) throw new ValidationError('Token do cartão ausente.', 'CARD_TOKEN_REQUIRED');

    let customerId = input.providerCustomerId ?? null;
    if (!customerId) {
      const search = await this.client.request({
        method: 'GET',
        path: `/v1/customers/search?email=${encodeURIComponent(input.payer.email)}`,
      });
      const results = pick(search, 'results');
      customerId = Array.isArray(results) && results.length > 0 ? pickString(results[0], 'id') : null;
    }
    if (!customerId) {
      const created = await this.client.request({
        method: 'POST',
        path: '/v1/customers',
        body: {
          email: input.payer.email,
          first_name: input.payer.firstName,
          last_name: input.payer.lastName,
          identification: input.payer.identification,
        },
      });
      customerId = pickString(created, 'id');
    }
    if (!customerId) {
      throw new ProviderError('Não foi possível registrar o meio de pagamento.', { code: 'CUSTOMER_CREATE_FAILED' });
    }

    // Só o token trafega. PAN/CVV nunca chegam ao nosso backend.
    const card = await this.client.request({
      method: 'POST',
      path: `/v1/customers/${customerId}/cards`,
      body: { token: input.cardToken },
    });

    return {
      providerCustomerId: customerId,
      providerMethodId: pickString(card, 'id'),
      brand: pickString(card, 'payment_method', 'id'),
      lastFour: pickString(card, 'last_four_digits'),
      expMonth: pickNumber(card, 'expiration_month'),
      expYear: pickNumber(card, 'expiration_year'),
      holderName: pickString(card, 'cardholder', 'name'),
    };
  }

  async chargeSavedPaymentMethod(input: ChargeSavedMethodInput): Promise<ProviderPaymentResult> {
    if (!input.cardToken) {
      // O Mercado Pago exige um token novo (gerado a partir do cartão salvo +
      // CVV digitado no frontend). Não há como cobrar só com o id do cartão.
      throw new ValidationError(
        'É necessário reautorizar o cartão salvo antes de cobrar.',
        'SAVED_CARD_TOKEN_REQUIRED',
      );
    }
    const amount = centsToDecimalString(input.amountCents);

    return this.createOrder(
      {
        type: 'online',
        processing_mode: 'automatic',
        total_amount: amount,
        external_reference: input.reference,
        description: input.description,
        payer: { ...buildPayer(input.payer), customer_id: input.providerCustomerId },
        transactions: {
          payments: [
            {
              amount,
              payment_method: {
                id: input.providerMethodId,
                type: 'credit_card',
                token: input.cardToken,
                installments: input.installments ?? 1,
              },
            },
          ],
        },
      },
      input.idempotencyKey,
    );
  }

  // ----------------------------------------------------------- assinaturas --

  async createSubscription(input: CreateSubscriptionInput): Promise<ProviderSubscriptionResult> {
    if (!input.cardToken) throw new ValidationError('Token do cartão ausente.', 'CARD_TOKEN_REQUIRED');

    const preapproval = await this.client.request({
      method: 'POST',
      path: '/preapproval',
      body: {
        reason: input.reason,
        external_reference: input.reference,
        back_url: input.backUrl,
        payer_email: this.environment === 'sandbox' ? 'test@testuser.com' : input.payer.email,
        card_token_id: input.cardToken,
        // "authorized" = já autorizada com o cartão tokenizado, sem redirect.
        status: 'authorized',
        auto_recurring: {
          frequency: input.intervalCount,
          frequency_type: input.intervalUnit,
          transaction_amount: Number(centsToDecimalString(input.amountCents)),
          currency_id: input.currency,
          ...(input.startDate ? { start_date: input.startDate } : {}),
          ...(input.endDate ? { end_date: input.endDate } : {}),
        },
      },
      idempotencyKey: input.idempotencyKey,
    });

    return mapPreapproval(preapproval);
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<ProviderSubscriptionResult> {
    const result = await this.client.request({
      method: 'PUT',
      path: `/preapproval/${providerSubscriptionId}`,
      body: { status: 'cancelled' },
    });
    return mapPreapproval(result);
  }

  async getSubscription(providerSubscriptionId: string): Promise<ProviderSubscriptionResult> {
    const result = await this.client.request({
      method: 'GET',
      path: `/preapproval/${providerSubscriptionId}`,
    });
    return mapPreapproval(result);
  }

  // -------------------------------------------------------------- webhooks --

  async processWebhook(request: WebhookRequest): Promise<NormalizedWebhook | null> {
    const verification = verifyWebhookSignature({ headers: request.headers, url: request.url });
    if (!verification.ok) return null;

    let body: Record<string, unknown> = {};
    if (request.rawBody) {
      try {
        body = JSON.parse(request.rawBody) as Record<string, unknown>;
      } catch {
        body = {};
      }
    }

    const topic = (pickString(body, 'type') ?? pickString(body, 'topic') ?? 'unknown').toLowerCase();
    const action = pickString(body, 'action') ?? topic;
    const resourceId =
      pickString(body, 'data', 'id') ?? verification.dataId ?? pickString(body, 'id');

    // O `id` do evento é a identidade da NOTIFICAÇÃO; sem ele, derivamos uma
    // chave estável de (tipo, recurso, ação) para ainda deduplicar retries.
    const notificationId = pickString(body, 'id');
    const eventKey = notificationId
      ? `mp:${notificationId}`
      : `mp:${topic}:${resourceId ?? 'unknown'}:${action}`;

    const normalized: NormalizedWebhook = {
      eventKey,
      eventType: action,
      resource: 'unknown',
      resourceId,
      raw: body,
    };

    if (topic.includes('subscription') || topic === 'preapproval' || topic.includes('preapproval')) {
      normalized.resource = 'subscription';
      // Nunca confiamos no payload: consultamos o estado real.
      if (resourceId) normalized.subscription = await this.getSubscription(resourceId);
      return normalized;
    }

    if (topic.includes('chargeback')) {
      normalized.resource = 'chargeback';
      return normalized;
    }
    if (topic.includes('fraud') || topic.includes('alert')) {
      normalized.resource = 'fraud';
      return normalized;
    }
    if (topic.includes('claim') || topic.includes('dispute')) {
      normalized.resource = 'claim';
      return normalized;
    }

    if (topic === 'order' || topic === 'payment' || topic.includes('order') || topic.includes('payment')) {
      normalized.resource = 'payment';
      if (resourceId) normalized.payment = await this.getPayment(resourceId);
      return normalized;
    }

    return normalized;
  }
}

/** Reexportado para os testes de mapeamento cobrirem o tradutor isoladamente. */
export { mapPaymentStatus };
