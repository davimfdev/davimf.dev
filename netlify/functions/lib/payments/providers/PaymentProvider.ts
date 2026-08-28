/**
 * Contrato de provedor de pagamento.
 *
 * Orders, Products, licenças e e-mails falam SÓ com esta interface. Nenhum
 * detalhe de Mercado Pago (ou de qualquer outro) vaza para fora de
 * providers/<nome>/. Para adicionar Pagar.me/Stripe basta implementar isto e
 * registrar em providers/registry.ts.
 */

import type { Cents } from '../domain/money';
import type { PaymentMethodKind, PaymentStatus, SubscriptionStatus } from '../domain/types';

/** Identificação fiscal do pagador (CPF/CNPJ). Nunca dado de cartão. */
export type PayerIdentification = {
  type: string;
  number: string;
};

export type PayerAddress = {
  zipCode: string;
  streetName: string;
  streetNumber: string;
  neighborhood?: string;
  city?: string;
  state?: string;
};

export type Payer = {
  email: string;
  firstName?: string;
  lastName?: string;
  identification?: PayerIdentification;
  address?: PayerAddress;
};

export type BaseChargeInput = {
  /** Referência do PEDIDO no nosso banco. O provider só espelha. */
  reference: string;
  amountCents: Cents;
  currency: string;
  description: string;
  payer: Payer;
  /** Repassada ao provider quando ele suporta idempotência nativa. */
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

export type CreatePixInput = BaseChargeInput & {
  /** Minutos até o QR expirar. */
  expiresInMinutes?: number;
};

export type CreateCardInput = BaseChargeInput & {
  /**
   * Token gerado NO FRONTEND pelo mecanismo seguro do provider.
   * O backend nunca vê PAN nem CVV.
   */
  cardToken: string;
  /** ID da bandeira/meio conforme o provider ('master', 'visa', ...). */
  paymentMethodId: string;
  installments: number;
};

export type CreateBoletoInput = BaseChargeInput & {
  expiresInDays?: number;
};

export type SavePaymentMethodInput = {
  /** Token de uso único do frontend. */
  cardToken: string;
  payer: Payer;
  /** Referência de cliente já existente no provider, quando houver. */
  providerCustomerId?: string;
};

export type ChargeSavedMethodInput = BaseChargeInput & {
  providerCustomerId: string;
  providerMethodId: string;
  /** Alguns providers exigem um CVV token novo; nunca o CVV em si. */
  cardToken?: string;
  installments?: number;
};

export type CreateSubscriptionInput = {
  reference: string;
  amountCents: Cents;
  currency: string;
  reason: string;
  payer: Payer;
  cardToken: string;
  intervalUnit: 'days' | 'months';
  intervalCount: number;
  /** ISO date; o provider cobra a primeira parcela aqui. */
  startDate?: string;
  endDate?: string;
  backUrl: string;
  idempotencyKey: string;
};

/** Dados de exibição de um meio de pagamento assíncrono (Pix/boleto). */
export type PaymentDisplay = {
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  boletoDigitableLine?: string;
  boletoBarcode?: string;
  ticketUrl?: string;
  /** Só metadados não sensíveis do cartão. */
  cardBrand?: string;
  cardLastFour?: string;
  /** Redirecionamento imposto pelo banco (3DS). Exceção permitida. */
  threeDsUrl?: string;
};

export type ProviderPaymentResult = {
  /** ID do agregador (Order/preapproval). */
  providerPaymentId: string;
  /** ID da transação dentro do agregador, quando existir. */
  providerTxnId: string | null;
  status: PaymentStatus;
  statusDetail: string | null;
  method: PaymentMethodKind;
  amountCents: Cents;
  currency: string;
  installments: number;
  refundedCents: Cents;
  expiresAt: string | null;
  display: PaymentDisplay;
  /** Payload cru para auditoria. NUNCA contém PAN/CVV. */
  raw: Record<string, unknown>;
};

export type ProviderSubscriptionResult = {
  providerSubscriptionId: string;
  status: SubscriptionStatus;
  nextBillingDate: string | null;
  raw: Record<string, unknown>;
};

export type ProviderSavedMethod = {
  providerCustomerId: string | null;
  providerMethodId: string | null;
  brand: string | null;
  lastFour: string | null;
  expMonth: number | null;
  expYear: number | null;
  holderName: string | null;
};

export type RefundInput = {
  providerPaymentId: string;
  /** Ausente = reembolso integral. */
  amountCents?: Cents;
  providerTxnId?: string | null;
  idempotencyKey: string;
};

export type RefundResult = {
  status: PaymentStatus;
  refundedCents: Cents;
  raw: Record<string, unknown>;
};

/** O que o provider extrai de uma notificação, já normalizado. */
export type NormalizedWebhook = {
  /** Chave estável do evento — base da deduplicação. */
  eventKey: string;
  eventType: string;
  /** 'payment' | 'subscription' | 'chargeback' | 'fraud' | 'claim' | 'unknown' */
  resource: 'payment' | 'subscription' | 'chargeback' | 'fraud' | 'claim' | 'unknown';
  resourceId: string | null;
  /** Preenchido quando o provider foi consultado para confirmar o estado real. */
  payment?: ProviderPaymentResult;
  subscription?: ProviderSubscriptionResult;
  raw: Record<string, unknown>;
};

export type WebhookRequest = {
  /** Corpo CRU, byte a byte — assinaturas são calculadas sobre ele ou sobre headers. */
  rawBody: string;
  headers: Record<string, string | undefined>;
  url: string;
};

export interface PaymentProvider {
  readonly name: string;

  createPixPayment(input: CreatePixInput): Promise<ProviderPaymentResult>;
  createCardPayment(input: CreateCardInput): Promise<ProviderPaymentResult>;
  createBoletoPayment(input: CreateBoletoInput): Promise<ProviderPaymentResult>;
  getPayment(providerPaymentId: string): Promise<ProviderPaymentResult>;
  refundPayment(input: RefundInput): Promise<RefundResult>;
  savePaymentMethod(input: SavePaymentMethodInput): Promise<ProviderSavedMethod>;
  chargeSavedPaymentMethod(input: ChargeSavedMethodInput): Promise<ProviderPaymentResult>;
  createSubscription(input: CreateSubscriptionInput): Promise<ProviderSubscriptionResult>;
  cancelSubscription(providerSubscriptionId: string): Promise<ProviderSubscriptionResult>;
  getSubscription(providerSubscriptionId: string): Promise<ProviderSubscriptionResult>;
  /**
   * Valida a assinatura da notificação e devolve o evento normalizado.
   * Retorna `null` quando a assinatura é inválida — o caller responde 401.
   */
  processWebhook(request: WebhookRequest): Promise<NormalizedWebhook | null>;
}
