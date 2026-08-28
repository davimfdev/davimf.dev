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
  BaseChargeInput,
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

/**
 * Nome exibido na fatura do cartão. Na Orders API ele vive em
 * `transactions.payments[].payment_method.statement_descriptor` — NÃO no topo
 * da Order, que é onde uma tentativa anterior o colocou e por isso foi
 * rejeitada. Documentado apenas no contrato de cartão.
 *
 * DESLIGADO por padrão. Enviá-lo com valor fixo coincidiu com pagamentos de
 * cartão falhando em `processing_error`, e um campo de fatura não vale
 * bloquear cobrança: só entra no payload quando
 * `MERCADOPAGO_STATEMENT_DESCRIPTOR` estiver definida. Sem ela, o requisito
 * "Fatura do cartão" é atendido pelo "Nome para extratos" da conta, que é a
 * alternativa oficial e cobre também Pix e boleto.
 */
function statementDescriptor(): Record<string, string> {
  const value = process.env.MERCADOPAGO_STATEMENT_DESCRIPTOR?.trim();
  return value ? { statement_descriptor: value } : {};
}

/**
 * Metadados de risco do pagador (`registration_date`, `last_purchase`,
 * `authentication_type`), que o relatório de qualidade pede em
 * `additional_info.payer`.
 *
 * EXPERIMENTO, desligado por padrão. Enviado no TOPO da Order o objeto foi
 * rejeitado pelo schema; a única hipótese com fundamento é o nível do
 * pagamento, que foi onde o `statement_descriptor` acabou se revelando —
 * mas nenhuma referência publicada confirma isso para a Orders API. Só entra
 * com `MERCADOPAGO_PAYER_ADDITIONAL_INFO=1`, para ser ligado durante UMA
 * medição e desligado em seguida.
 *
 * Os valores continuam vindo só de fonte autenticada real; nada é fabricado.
 */
function payerAdditionalInfo(input: BaseChargeInput): Record<string, unknown> {
  if (process.env.MERCADOPAGO_PAYER_ADDITIONAL_INFO?.trim() !== '1') return {};
  const metadata = input.payerMetadata;
  if (!metadata) return {};
  const payer: Record<string, unknown> = {};
  if (metadata.registrationDate) payer.registration_date = metadata.registrationDate;
  if (metadata.lastPurchase) payer.last_purchase = metadata.lastPurchase;
  if (metadata.authenticationType) payer.authentication_type = metadata.authenticationType;
  return Object.keys(payer).length > 0 ? { additional_info: { payer } } : {};
}

type MercadoPagoEnvironment = 'sandbox' | 'production';

type OrderPhone = { area_code: string; number: string };

type OrderPayer = {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: OrderPhone;
  identification?: { type: string; number: string };
  address?: Record<string, string>;
};

/**
 * Telefone brasileiro em (DDD, número), formato que o Mercado Pago espera.
 *
 * Só devolve algo quando o DDD é DERIVÁVEL do que o cliente digitou: 10/11
 * dígitos, ou 12/13 com o código do país 55. Qualquer outro formato vira
 * `null` — é melhor omitir o telefone do que enviar um DDD inventado.
 */
function buildPhone(phone: string | undefined): OrderPhone | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  const national = (digits.length === 12 || digits.length === 13) && digits.startsWith('55')
    ? digits.slice(2)
    : digits;
  if (national.length !== 10 && national.length !== 11) return null;
  return { area_code: national.slice(0, 2), number: national.slice(2) };
}

/** Endereço só com os campos REALMENTE preenchidos — sem string vazia. */
function buildAddress(address: NonNullable<Payer['address']>): Record<string, string> {
  const out: Record<string, string> = {
    zip_code: address.zipCode,
    street_name: address.streetName,
    street_number: address.streetNumber,
  };
  if (address.neighborhood) out.neighborhood = address.neighborhood;
  if (address.city) out.city = address.city;
  if (address.state) out.state = address.state;
  // A Orders API limita complemento a 20 caracteres. Como o campo é
  // opcional, omitir um valor maior preserva o perfil original sem enviar
  // texto truncado ou inventado ao provider.
  if (address.complement && address.complement.length <= 20) out.complement = address.complement;
  return out;
}

/** Dados comerciais verdadeiros, originados exclusivamente do pedido/produto. */
function buildItems(input: BaseChargeInput): Array<Record<string, unknown>> {
  const requested = Number(input.quantity);
  const quantity = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  const units = input.amountCents % quantity === 0 ? quantity : 1;
  return [{
    title: input.description,
    description: input.description,
    quantity: units,
    unit_price: centsToDecimalString(input.amountCents / units),
    external_code: input.itemCode,
    category_id: input.itemCategoryId,
  }];
}

function buildPayer(payer: Payer, options: { requireIdentification?: boolean; requireAddress?: boolean } = {}): OrderPayer {
  if (!payer.email) throw new ValidationError('E-mail do pagador é obrigatório.', 'PAYER_EMAIL_REQUIRED');

  const out: OrderPayer = { email: payer.email };
  if (payer.firstName) out.first_name = payer.firstName;
  if (payer.lastName) out.last_name = payer.lastName;

  const phone = buildPhone(payer.phone);
  if (phone) out.phone = phone;

  if (payer.identification) {
    out.identification = { type: payer.identification.type, number: payer.identification.number };
  } else if (options.requireIdentification) {
    throw new ValidationError('CPF/CNPJ do pagador é obrigatório para este meio de pagamento.', 'PAYER_IDENTIFICATION_REQUIRED');
  }

  if (payer.address) {
    out.address = buildAddress(payer.address);
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

/**
 * Identidade da notificação, extraída do corpo APENAS para diagnóstico.
 * Nada aqui autentica nem libera coisa alguma: quem autentica é o HMAC.
 */
type WebhookIdentity = {
  applicationId: string | null;
  /** Conta do Mercado Pago dona do recurso — separa conta real de usuário de teste. */
  userId: string | null;
  liveMode: boolean | null;
  type: string | null;
  action: string | null;
  dataId: string | null;
};

/** `application_id` e `user_id` chegam ora como número, ora como string. */
function identifier(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function webhookIdentity(body: Record<string, unknown>): WebhookIdentity {
  return {
    applicationId: identifier(body.application_id),
    userId: identifier(body.user_id),
    liveMode: typeof body.live_mode === 'boolean' ? body.live_mode : null,
    type: pickString(body, 'type') ?? pickString(body, 'topic'),
    action: pickString(body, 'action'),
    dataId: pickString(body, 'data', 'id'),
  };
}

/**
 * Classifica a aplicação de origem quando `MERCADOPAGO_APPLICATION_ID` está
 * configurada. É rótulo de LOG apenas — nunca aceita nem recusa nada por si:
 * uma notificação de aplicação conhecida com assinatura inválida continua
 * sendo recusada, e uma de aplicação desconhecida com assinatura válida
 * continua sendo processada.
 */
/**
 * Última linha de diagnóstico, DESLIGADA por padrão: só sai com
 * `MERCADOPAGO_WEBHOOK_DEBUG=1`. Publica as entradas exatas do manifesto para
 * o operador recalcular o HMAC fora do servidor e descobrir QUAL entrada
 * diverge, quando segredo, aplicação, proxy e relógio já foram descartados.
 * Continua sem segredo e sem assinatura completa. Desligue depois de usar.
 */
function logManifestInputs(inputs: {
  dataId: string | null;
  requestId: string | null;
  ts: string | null;
  v1Prefix: string | null;
}): void {
  if (process.env.MERCADOPAGO_WEBHOOK_DEBUG?.trim() !== '1') return;
  console.warn(
    `[payments] webhook Mercado Pago manifesto: data.id=${inputs.dataId ?? 'missing'} ` +
      `x-request-id=${inputs.requestId ?? 'missing'} ts=${inputs.ts ?? 'missing'} ` +
      `v1[0..8]=${inputs.v1Prefix ?? 'missing'}`,
  );
}

function describeApplication(applicationId: string | null): string {
  const expected = process.env.MERCADOPAGO_APPLICATION_ID?.trim();
  if (!expected) return 'unknown';
  // Registra o esperado junto do recebido: `application_id` é o identificador
  // público da aplicação (o mesmo que aparece em Suas integrações), então o
  // log mostra os DOIS lados da divergência sem precisar consultar o ambiente.
  if (!applicationId) return `unknown(expected=${expected})`;
  return expected === applicationId ? 'match' : `foreign(expected=${expected})`;
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
    meliSessionId?: string,
  ): Promise<ProviderPaymentResult> {
    const order = await this.client.request({
      method: 'POST',
      path: '/v1/orders',
      body,
      idempotencyKey,
      // O Device ID vai SEPARADO do corpo: o cliente HTTP o transforma em
      // `X-meli-session-id` e ele nunca é serializado no JSON da Order.
      meliSessionId,
    });
    return mapOrderToPayment(order);
  }

  /**
   * Campos COMUNS a toda Order avulsa.
   *
   * Nada específico de método entra aqui — em especial `capture_mode`, que é
   * contrato de cartão e não pode vazar para Pix/boleto.
   */
  private baseOrder(input: BaseChargeInput, method: 'pix' | 'card' | 'boleto'): Record<string, unknown> {
    return {
      type: 'online',
      processing_mode: 'automatic',
      total_amount: centsToDecimalString(input.amountCents),
      external_reference: input.reference,
      description: input.description,
      items: buildItems(input),
      payer: this.payer(input.payer, method),
    };
  }

  /**
   * `baseOrder` + o contrato EXCLUSIVO de cartão.
   *
   * Toda Order de cartão passa por aqui — cartão novo e cartão salvo — para que
   * nenhuma delas fique sem `capture_mode` nem sem o 3DS completo.
   */
  private cardOrder(input: BaseChargeInput): Record<string, unknown> {
    return {
      ...this.baseOrder(input, 'card'),
      // `capture_mode` SÓ existe no contrato de cartão da Orders API. Não
      // subir isto para `baseOrder`: Pix e boleto não aceitam o campo.
      capture_mode: 'automatic',
      config: {
        online: {
          // 3DS completo: o provider decide desafiar em risco de fraude e a
          // responsabilidade migra para o emissor quando autenticado.
          transaction_security: {
            validation: 'on_fraud_risk',
            liability_shift: 'required',
          },
        },
      },
    };
  }

  async createPixPayment(input: CreatePixInput): Promise<ProviderPaymentResult> {
    const amount = centsToDecimalString(input.amountCents);
    const minutes = input.expiresInMinutes ?? DEFAULT_PIX_EXPIRY_MINUTES;

    return this.createOrder(
      {
        ...this.baseOrder(input, 'pix'),
        transactions: {
          payments: [
            {
              amount,
              expiration_time: isoDuration(minutes),
              payment_method: { id: 'pix', type: 'bank_transfer' },
              ...payerAdditionalInfo(input),
            },
          ],
        },
      },
      input.idempotencyKey,
      input.deviceId,
    );
  }

  async createCardPayment(input: CreateCardInput): Promise<ProviderPaymentResult> {
    if (!input.cardToken) {
      throw new ValidationError('Token do cartão ausente.', 'CARD_TOKEN_REQUIRED');
    }
    const amount = centsToDecimalString(input.amountCents);

    return this.createOrder(
      {
        ...this.cardOrder(input),
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
                ...statementDescriptor(),
              },
              ...payerAdditionalInfo(input),
            },
          ],
        },
      },
      input.idempotencyKey,
      input.deviceId,
    );
  }

  async createBoletoPayment(input: CreateBoletoInput): Promise<ProviderPaymentResult> {
    const amount = centsToDecimalString(input.amountCents);
    const days = input.expiresInDays ?? DEFAULT_BOLETO_EXPIRY_DAYS;

    return this.createOrder(
      {
        ...this.baseOrder(input, 'boleto'),
        transactions: {
          payments: [
            {
              amount,
              expiration_time: isoDuration(days * 24 * 60),
              payment_method: { id: 'bolbradesco', type: 'ticket' },
              ...payerAdditionalInfo(input),
            },
          ],
        },
      },
      input.idempotencyKey,
      input.deviceId,
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
    // Cartão salvo é cartão: mesma Order enriquecida, mesmo 3DS completo. A
    // única diferença é o `customer_id` que amarra o meio salvo ao cliente.
    const base = this.cardOrder(input);

    return this.createOrder(
      {
        ...base,
        payer: { ...(base.payer as OrderPayer), customer_id: input.providerCustomerId },
        transactions: {
          payments: [
            {
              amount,
              payment_method: {
                id: input.providerMethodId,
                type: 'credit_card',
                token: input.cardToken,
                installments: input.installments ?? 1,
                ...statementDescriptor(),
              },
              ...payerAdditionalInfo(input),
            },
          ],
        },
      },
      input.idempotencyKey,
      input.deviceId,
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

    // O corpo é lido ANTES da decisão só para diagnóstico e, depois de uma
    // assinatura válida, para descobrir o tópico. Ele nunca é fonte de verdade
    // sobre dinheiro: o estado real vem sempre de uma consulta ao provider.
    let body: Record<string, unknown> = {};
    if (request.rawBody) {
      try {
        body = JSON.parse(request.rawBody) as Record<string, unknown>;
      } catch {
        body = {};
      }
    }
    const identity = webhookIdentity(body);

    if (!verification.ok) {
      // Diagnóstico operacional sem registrar assinatura, segredo, manifesto,
      // URL ou payload. Responde ao que separa as causas possíveis: aplicação
      // de origem, modo, canonicalização, origem do id, atraso de relógio,
      // proxy duplicando `x-request-id` e qual conjunto de segredos foi
      // tentado (por rótulo e fingerprint irreversível).
      let queryId: string | null = null;
      try {
        queryId = new URL(request.url, 'https://davimf.dev').searchParams.get('data.id');
      } catch { /* diagnóstico fica como ausente */ }
      const { secrets, tsAgeSeconds, idSource, variants, requestIdValues } = verification.diagnostics;
      const context =
        ` (application=${describeApplication(identity.applicationId)}, application_id=${identity.applicationId ?? 'missing'}, ` +
        `user_id=${identity.userId ?? 'missing'}, ` +
        `live_mode=${identity.liveMode === null ? 'missing' : String(identity.liveMode)}, ` +
        `type=${identity.type ?? 'missing'}, action=${identity.action ?? 'missing'}, ` +
        `data.id=${queryId ? 'present' : 'missing'}, id_source=${idSource}, ` +
        `body_id=${identity.dataId ? 'present' : 'missing'}, ` +
        `ids_match=${queryId && identity.dataId ? (queryId.toLowerCase() === identity.dataId.toLowerCase() ? 'yes' : 'no') : 'unknown'}, ` +
        `x-request-id=${requestIdValues > 0 ? `present(${requestIdValues})` : 'missing'}, ` +
        `ts_age_s=${tsAgeSeconds === null ? 'unknown' : String(tsAgeSeconds)}, ` +
        `variants=${variants.join('+')}, secrets=${secrets.join('/') || 'none'})`;
      console.warn(`[payments] webhook Mercado Pago rejeitado: ${verification.reason}${context}`);
      logManifestInputs(verification.diagnostics.manifestInputs);
      return null;
    }

    const topic = (pickString(body, 'type') ?? pickString(body, 'topic') ?? 'unknown').toLowerCase();
    const action = pickString(body, 'action') ?? topic;
    const resourceId =
      pickString(body, 'data', 'id') ?? verification.resourceId ?? pickString(body, 'id');

    // Contrapartida do log de rejeição: permite comparar, no MESMO formato, a
    // aplicação de uma notificação aceita com a de uma recusada.
    console.info(
      `[payments] webhook Mercado Pago aceito (application=${describeApplication(identity.applicationId)}, ` +
        `application_id=${identity.applicationId ?? 'missing'}, user_id=${identity.userId ?? 'missing'}, ` +
        `live_mode=${identity.liveMode === null ? 'missing' : String(identity.liveMode)}, ` +
        `type=${topic}, action=${action}, data.id=${resourceId ? 'present' : 'missing'})`,
    );

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
      if (resourceId) {
        try {
          normalized.payment = await this.getPayment(resourceId);
        } catch (error) {
          // O simulador oficial usa um Data ID fictício e espera HTTP 200.
          // Uma assinatura válida + recurso inexistente é uma notificação
          // reconhecida, porém sem estado financeiro para aplicar. Outros
          // erros (timeout, 429, 5xx) continuam subindo para provocar retry.
          const notFound = error instanceof ProviderError && error.providerDetail?.startsWith('HTTP 404 ');
          if (!notFound) throw error;
          console.warn('[payments] webhook Mercado Pago válido para recurso inexistente');
        }
      }
      return normalized;
    }

    return normalized;
  }
}

/** Reexportado para os testes de mapeamento cobrirem o tradutor isoladamente. */
export { mapPaymentStatus };
