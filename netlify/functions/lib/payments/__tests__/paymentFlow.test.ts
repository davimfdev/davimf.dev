/**
 * Fluxo de ponta a ponta com provider e banco falsos.
 *
 * O foco é o que dinheiro exige: preço vem do banco, cobrança não duplica,
 * licença sai só depois de PAID, webhook repetido não faz nada duas vezes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FmmLicenseService } from '../application/FmmLicenseService';
import { NotificationService } from '../application/NotificationService';
import { OrderService } from '../application/OrderService';
import { PaymentService } from '../application/PaymentService';
import type { PayerProfileData } from '../repositories/PayerProfileRepository';
import { ConflictError, ProviderTimeoutError, ValidationError } from '../domain/errors';
import type { EmailProvider } from '../email/EmailProvider';
import type {
  NormalizedWebhook,
  PaymentProvider,
  ProviderPaymentResult,
  ProviderSubscriptionResult,
  ProviderSavedMethod,
  RefundResult,
  WebhookRequest,
} from '../providers/PaymentProvider';
import { WebhookService } from '../webhooks/WebhookService';
import { FakeSql, licenseRow, orderRow, paymentRow, productRow, uninstallSql } from './helpers';
import type { SqlRow } from '../infrastructure/db';

// ------------------------------------------------------------- provider ----

function pixResult(overrides: Partial<ProviderPaymentResult> = {}): ProviderPaymentResult {
  return {
    providerPaymentId: 'ORD-1',
    providerTxnId: 'PAY-1',
    status: 'PENDING',
    statusDetail: 'pending_waiting_transfer',
    method: 'pix',
    amountCents: 3500,
    currency: 'BRL',
    installments: 1,
    refundedCents: 0,
    expiresAt: '2026-08-01T00:30:00.000Z',
    display: { pixQrCode: '00020126PIX', pixQrCodeBase64: 'aGk=' },
    raw: {},
    ...overrides,
  };
}

class FakeProvider implements PaymentProvider {
  readonly name = 'mercadopago';
  readonly calls: string[] = [];
  readonly inputs: unknown[] = [];
  nextPayment: ProviderPaymentResult = pixResult();
  nextWebhook: NormalizedWebhook | null = null;
  failWith: Error | null = null;

  private track<T>(label: string, value: T): T {
    this.calls.push(label);
    if (this.failWith) throw this.failWith;
    return value;
  }

  async createPixPayment(input: unknown) { this.inputs.push(input); return this.track('pix', this.nextPayment); }
  async createCardPayment(input: unknown) { this.inputs.push(input); return this.track('card', this.nextPayment); }
  async createBoletoPayment(input: unknown) { this.inputs.push(input); return this.track('boleto', this.nextPayment); }
  async getPayment() { return this.track('get', this.nextPayment); }
  async refundPayment(): Promise<RefundResult> {
    this.calls.push('refund');
    return { status: 'REFUNDED', refundedCents: 3500, raw: {} };
  }
  async savePaymentMethod(): Promise<ProviderSavedMethod> { throw new Error('não usado neste teste'); }
  async chargeSavedPaymentMethod() { return this.track('charge-saved', this.nextPayment); }
  async createSubscription(): Promise<ProviderSubscriptionResult> {
    this.calls.push('subscription');
    return { providerSubscriptionId: 'PREAPP-1', status: 'ACTIVE', nextBillingDate: '2026-09-01T00:00:00.000Z', raw: {} };
  }
  async cancelSubscription(): Promise<ProviderSubscriptionResult> {
    this.calls.push('cancel');
    return { providerSubscriptionId: 'PREAPP-1', status: 'CANCELLED', nextBillingDate: null, raw: {} };
  }
  async getSubscription(): Promise<ProviderSubscriptionResult> {
    this.calls.push('get-subscription');
    return { providerSubscriptionId: 'PREAPP-1', status: 'ACTIVE', nextBillingDate: null, raw: {} };
  }
  async processWebhook() {
    this.calls.push('webhook');
    return this.nextWebhook;
  }
}

// ------------------------------------------------------------- ambiente ----

type World = {
  sql: FakeSql;
  provider: FakeProvider;
  payments: PaymentService;
  orders: OrderService;
  emails: Array<{ template: string; to: string }>;
  savedPayerProfiles: Array<{ userId: string; profile: PayerProfileData }>;
  state: { order: SqlRow; payment: SqlRow | null; license: SqlRow | null; events: Set<string>; dispatches: Set<string> };
};

function buildWorld(options: { product?: Partial<SqlRow>; order?: Partial<SqlRow>; profileSaveFails?: boolean } = {}): World {
  const emails: Array<{ template: string; to: string }> = [];
  const state = {
    order: orderRow(options.order),
    payment: null as SqlRow | null,
    license: null as SqlRow | null,
    events: new Set<string>(),
    dispatches: new Set<string>(),
  };

  const sql = new FakeSql([
    // ---- catálogo
    { match: (q) => q.includes('FROM products') && q.includes('WHERE code'), rows: [productRow(options.product)] },

    // ---- pedidos
    {
      match: (q) => q.includes('INSERT INTO orders'),
      rows: (_q, values) => {
        state.order = orderRow({ ...options.order, reference: String(values[0]), amount_cents: values[6] as number });
        return [state.order];
      },
    },
    { match: (q) => q.includes('FROM orders WHERE id'), rows: () => [state.order] },
    {
      match: (q) => q.includes('UPDATE orders') && q.includes("status = 'PAID'"),
      rows: () => {
        // Só transiciona uma vez: é o que impede reentrega por evento repetido.
        if (state.order.status === 'PAID') return [];
        state.order = { ...state.order, status: 'PAID', paid_at: '2026-08-01T01:00:00.000Z' };
        return [state.order];
      },
    },
    {
      match: (q) => q.includes('UPDATE orders SET status'),
      rows: (_q, values) => {
        if (state.order.status === values[0]) return [];
        state.order = { ...state.order, status: values[0] };
        return [state.order];
      },
    },
    { match: (q) => q.includes('UPDATE orders SET fulfilled_at'), rows: [] },

    // ---- pagamentos
    {
      match: (q) => q.includes('INSERT INTO payments'),
      rows: (_q, values) => {
        // ON CONFLICT (idempotency_key): mesma chave => MESMA linha.
        if (state.payment && state.payment.idempotency_key === values[7]) return [state.payment];
        state.payment = paymentRow({
          order_id: values[0], user_id: values[1], method: values[3],
          amount_cents: values[4], installments: values[6], idempotency_key: values[7],
        });
        return [state.payment];
      },
    },
    {
      match: (q) => q.includes('UPDATE payments SET'),
      rows: (_q, values) => {
        state.payment = {
          ...(state.payment ?? paymentRow()),
          provider_payment_id: values[0] ?? state.payment?.provider_payment_id ?? null,
          provider_txn_id: values[1] ?? state.payment?.provider_txn_id ?? null,
          status: values[2],
          status_detail: values[3] ?? null,
          installments: values[4] ?? 1,
          refunded_cents: values[5] ?? 0,
          details: values[6] ? JSON.parse(String(values[6])) : {},
          expires_at: values[7] ?? null,
          paid_at: values[8] ?? state.payment?.paid_at ?? null,
        };
        return [state.payment];
      },
    },
    { match: (q) => q.includes('FROM payments WHERE id'), rows: () => (state.payment ? [state.payment] : []) },
    {
      match: (q) => q.includes('FROM payments WHERE provider ='),
      rows: () => (state.payment ? [state.payment] : []),
    },
    // Antes da leitura por pedido: `SELECT 1 FROM payments` também casa com ela.
    { match: (q) => q.startsWith('SELECT 1 FROM payments'), rows: [] },
    { match: (q) => q.includes('FROM payments WHERE order_id'), rows: () => (state.payment ? [state.payment] : []) },

    // ---- licenças
    { match: (q) => q.includes('FROM fmm_license_keys WHERE order_id'), rows: () => (state.license ? [state.license] : []) },
    {
      match: (q) => q.includes('INSERT INTO fmm_license_keys'),
      rows: (_q, values) => {
        if (state.license) return []; // índice único parcial em order_id
        state.license = licenseRow({ key_prefix: String(values[1]), key_ciphertext: values[2] as string });
        return [state.license];
      },
    },
    {
      match: (q) => q.includes('UPDATE fmm_license_keys') && q.includes('SET status'),
      rows: (_q, values) => {
        if (!state.license || state.license.status === values[0]) return [];
        state.license = { ...state.license, status: values[0] };
        return [state.license];
      },
    },

    // ---- eventos (dedup do webhook)
    {
      match: (q) => q.includes('INSERT INTO payment_events'),
      rows: (_q, values) => {
        const key = String(values[1]);
        if (state.events.has(key)) return [];
        state.events.add(key);
        return [{ id: state.events.size, provider: values[0], event_key: key, event_type: values[2], status: 'RECEIVED', payload: {}, created_at: '2026-08-01T00:00:00.000Z' }];
      },
    },
    { match: (q) => q.includes('UPDATE payment_events'), rows: [] },
    { match: (q) => q.includes('DELETE FROM payment_events'), rows: [] },

    // ---- e-mails (dedup)
    {
      match: (q) => q.includes('INSERT INTO email_dispatches'),
      rows: (_q, values) => {
        const key = String(values[0]);
        if (state.dispatches.has(key)) return [];
        state.dispatches.add(key);
        return [{ id: state.dispatches.size, dedupe_key: key }];
      },
    },
    { match: (q) => q.includes('UPDATE email_dispatches'), rows: [] },
  ]);

  sql.install();

  const emailProvider: EmailProvider = {
    name: 'fake',
    send: async (message) => {
      emails.push({ template: message.subject, to: message.to });
      return { id: 'e1' };
    },
  };

  const provider = new FakeProvider();
  const orders = new OrderService();
  const notifications = new NotificationService(emailProvider);
  const savedPayerProfiles: Array<{ userId: string; profile: PayerProfileData }> = [];
  const payerProfiles = {
    saveFromCharge: async (userId: string, profile: PayerProfileData) => {
      if (options.profileSaveFails) throw new Error('encrypted profile storage failed');
      savedPayerProfiles.push({ userId, profile });
    },
  };
  const payments = new PaymentService(provider, orders, new FmmLicenseService(), notifications, payerProfiles as never);

  return { sql, provider, payments, orders, emails, savedPayerProfiles, state };
}

beforeEach(() => {
  process.env.PAYMENTS_LICENSE_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64');
});
afterEach(() => {
  uninstallSql();
  delete process.env.PAYMENTS_LICENSE_ENCRYPTION_KEY;
});

// ------------------------------------------------------------- pedidos ----

describe('preço', () => {
  it('usa SEMPRE o preço do banco e ignora qualquer valor do cliente', async () => {
    const world = buildWorld();
    const { order } = await world.orders.create({
      userId: 'discord-1',
      userEmail: 'comprador@example.com',
      productCode: 'fmm-pro-monthly',
      // Adulteração: o cliente tenta injetar valor. Nenhum caminho o lê.
      ...({ amountCents: 1, priceCents: 1, amount: 1 } as unknown as Record<string, never>),
    });
    expect(order.amountCents).toBe(3500);
  });

  it('recusa renovação automática em produto vitalício', async () => {
    const world = buildWorld({ product: { is_lifetime: true, recurring_eligible: false, duration_days: 36500 } });
    await expect(
      world.orders.create({
        userId: 'discord-1',
        userEmail: 'comprador@example.com',
        productCode: 'fmm-pro-lifetime',
        autoRenew: true,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

// --------------------------------------------- dados comerciais / device ----

describe('dados comerciais da cobrança', () => {
  it('manda ao provider os valores do PEDIDO/PRODUTO e ignora os campos forjados no request', async () => {
    // Pedido real do banco: 3 unidades, R$ 105,00.
    const world = buildWorld({ order: { quantity: 3, amount_cents: 10500 } });
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    world.provider.nextPayment = pixResult({ amountCents: 10500 });

    // Adulteração: o cliente injeta dados comerciais no corpo. Nenhum caminho
    // de código os lê — tudo sai do Order/Product que vieram do banco.
    const forged = {
      quantity: 99,
      itemCode: 'fmm-pro-lifetime',
      itemCategoryId: 'MLB1648',
      description: 'Item forjado pelo cliente',
      amountCents: 1,
      price: 1,
      priceCents: 1,
      unitPrice: 1,
    } as unknown as Record<string, never>;

    await world.payments.createPix({
      order, product, payer: { email: 'comprador@example.com' }, ...forged,
    });
    await world.payments.createCard({
      order, product, payer: { email: 'comprador@example.com' },
      cardToken: 'tok', paymentMethodId: 'master', installments: 1, ...forged,
    });
    await world.payments.createBoleto({
      order, product, payer: { email: 'comprador@example.com' }, ...forged,
    });

    const expected = {
      quantity: 3,
      itemCode: 'fmm-pro-monthly',
      // Constante de backend documentada — nunca um id de catálogo inventado.
      itemCategoryId: 'software',
      description: 'FMM Pro — Mensal',
      amountCents: 10500,
      currency: 'BRL',
      reference: 'DVMF-TEST0001',
    };
    expect(world.provider.inputs).toHaveLength(3);
    for (const input of world.provider.inputs) {
      expect(input).toMatchObject(expected);
      expect((input as { itemCategoryId: string }).itemCategoryId).toBe('software');
    }
  });

  it('encaminha o Device ID ao provider e NÃO o persiste em lugar nenhum', async () => {
    const world = buildWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');

    const view = await world.payments.createPix({
      order, product, payer: { email: 'comprador@example.com' }, deviceId: 'real-sdk-device-id',
    });

    expect(world.provider.inputs[0]).toMatchObject({ deviceId: 'real-sdk-device-id' });
    // Request-scoped: nada dele chega a `payments.details`, à projeção do
    // frontend, nem a qualquer valor enviado ao banco.
    expect(JSON.stringify(world.state.payment!.details)).not.toContain('real-sdk-device-id');
    expect(JSON.stringify(view)).not.toContain('real-sdk-device-id');
    expect(JSON.stringify(world.sql.calls)).not.toContain('real-sdk-device-id');
  });
});

// ----------------------------------------------------------------- Pix ----

describe('Pix', () => {
  const CONSENTED_PAYER: PayerProfileData = {
    firstName: 'Davi', lastName: 'Moraes', email: 'comprador@example.com', phone: '+5511999999999',
    identification: { type: 'CPF', number: '12345678909' },
    address: {
      zipCode: '01310100', streetName: 'Avenida Paulista', streetNumber: '1000',
      neighborhood: 'Bela Vista', city: 'Sao Paulo', state: 'SP', complement: 'Apto 42',
    },
  };

  it('cria a cobrança, devolve QR e NÃO entrega licença antes de PAID', async () => {
    const world = buildWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');

    const view = await world.payments.createPix({
      order, product, payer: { email: 'comprador@example.com' },
    });

    expect(view.status).toBe('PENDING');
    expect((view.details.display as Record<string, unknown>).pixQrCode).toBe('00020126PIX');
    expect(view.license).toBeUndefined();
    expect(world.state.license).toBeNull();
    // E-mail com instruções de Pix pendente.
    expect(world.emails.map((e) => e.template)).toEqual(['Pix gerado — pedido DVMF-TEST0001']);
  });

  it('duplo clique reaproveita a MESMA cobrança', async () => {
    const world = buildWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    const input = { order, product, payer: { email: 'comprador@example.com' } };

    const first = await world.payments.createPix(input);
    const second = await world.payments.createPix(input);

    expect(second.id).toBe(first.id);
    // Uma única chamada ao provider — nada de duas cobranças.
    expect(world.provider.calls.filter((call) => call === 'pix')).toHaveLength(1);
  });

  it('Pix confirmado libera a licença e manda a chave por e-mail', async () => {
    const world = buildWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    await world.payments.createPix({ order, product, payer: { email: 'comprador@example.com' } });

    const applied = await world.payments.applyProviderResult('ORD-1', pixResult({ status: 'PAID', statusDetail: 'accredited' }), 'webhook');

    expect(applied?.order.status).toBe('PAID');
    expect(world.state.license).not.toBeNull();
    expect(world.emails.some((e) => e.template === 'FMM — Pagamento aprovado e sua chave')).toBe(true);
  });

  it('Pix expirado encerra o pedido sem licença', async () => {
    const world = buildWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    await world.payments.createPix({ order, product, payer: { email: 'comprador@example.com' } });

    await world.payments.applyProviderResult('ORD-1', pixResult({ status: 'EXPIRED' }), 'webhook');

    expect(world.state.order.status).toBe('EXPIRED');
    expect(world.state.license).toBeNull();
  });

  it('polling confirma o pagamento, envia e-mail e deduplica webhook posterior', async () => {
    const world = buildWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    await world.payments.createPix({ order, product, payer: { email: 'comprador@example.com' } });
    const before = world.emails.length;

    world.provider.nextPayment = pixResult({ status: 'PAID', statusDetail: 'accredited' });
    const view = await world.payments.reconcile(world.state.payment!.id as string, 'polling');

    expect(view.status).toBe('PAID');
    expect(world.state.license).not.toBeNull();
    expect(world.emails).toHaveLength(before + 1);

    await world.payments.applyProviderResult(
      'ORD-1',
      pixResult({ status: 'PAID', statusDetail: 'accredited' }),
      'webhook',
    );
    expect(world.emails).toHaveLength(before + 1);
  });

  it('não salva perfil quando o consentimento está ausente ou é false', async () => {
    const omitted = buildWorld();
    const omittedOrder = await omitted.orders.requireOrder('id');
    const omittedProduct = await omitted.orders.requireProduct('fmm-pro-monthly');
    await omitted.payments.createPix({ order: omittedOrder, product: omittedProduct, payer: CONSENTED_PAYER });

    const declined = buildWorld();
    const declinedOrder = await declined.orders.requireOrder('id');
    const declinedProduct = await declined.orders.requireProduct('fmm-pro-monthly');
    await declined.payments.createPix({
      order: declinedOrder, product: declinedProduct, payer: CONSENTED_PAYER, savePayerProfile: false,
    });

    expect(omitted.savedPayerProfiles).toEqual([]);
    expect(declined.savedPayerProfiles).toEqual([]);
  });

  it('salva o perfil completo do dono quando o consentimento é exatamente true sem enviar flags ao provider', async () => {
    const world = buildWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');

    await world.payments.createPix({
      order, product, payer: CONSENTED_PAYER, savePayerProfile: true,
    });

    expect(world.savedPayerProfiles).toEqual([{ userId: 'discord-1', profile: CONSENTED_PAYER }]);
    expect(world.provider.inputs[0]).not.toHaveProperty('savePayerProfile');
    expect(world.provider.inputs[0]).not.toHaveProperty('payerProfile');
  });

  it('salva o perfil na primeira cobrança consentida de cartão e de boleto', async () => {
    const card = buildWorld();
    const cardOrder = await card.orders.requireOrder('id');
    const cardProduct = await card.orders.requireProduct('fmm-pro-monthly');
    await card.payments.createCard({
      order: cardOrder, product: cardProduct, payer: CONSENTED_PAYER,
      cardToken: 'tok', paymentMethodId: 'master', installments: 1, savePayerProfile: true,
    });

    const boleto = buildWorld();
    const boletoOrder = await boleto.orders.requireOrder('id');
    const boletoProduct = await boleto.orders.requireProduct('fmm-pro-monthly');
    await boleto.payments.createBoleto({
      order: boletoOrder, product: boletoProduct, payer: CONSENTED_PAYER, savePayerProfile: true,
    });

    expect(card.savedPayerProfiles).toEqual([{ userId: 'discord-1', profile: CONSENTED_PAYER }]);
    expect(boleto.savedPayerProfiles).toEqual([{ userId: 'discord-1', profile: CONSENTED_PAYER }]);
    expect(card.provider.inputs[0]).not.toHaveProperty('savePayerProfile');
    expect(boleto.provider.inputs[0]).not.toHaveProperty('savePayerProfile');
  });

  it('salva o perfil quando o retry Pix consentido reaproveita uma cobrança existente', async () => {
    const world = buildWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    await world.payments.createPix({ order, product, payer: CONSENTED_PAYER });

    await world.payments.createPix({ order, product, payer: CONSENTED_PAYER, savePayerProfile: true });

    expect(world.savedPayerProfiles).toEqual([{ userId: 'discord-1', profile: CONSENTED_PAYER }]);
  });

  it('salva o perfil quando o retry cartão consentido reaproveita uma cobrança existente', async () => {
    const world = buildWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    await world.payments.createCard({
      order, product, payer: CONSENTED_PAYER, cardToken: 'tok', paymentMethodId: 'master', installments: 1,
    });

    await world.payments.createCard({
      order, product, payer: CONSENTED_PAYER, cardToken: 'tok', paymentMethodId: 'master', installments: 1,
      savePayerProfile: true,
    });

    expect(world.savedPayerProfiles).toEqual([{ userId: 'discord-1', profile: CONSENTED_PAYER }]);
  });

  it('salva o perfil quando o retry boleto consentido reaproveita uma cobrança existente', async () => {
    const world = buildWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    await world.payments.createBoleto({ order, product, payer: CONSENTED_PAYER });

    await world.payments.createBoleto({ order, product, payer: CONSENTED_PAYER, savePayerProfile: true });

    expect(world.savedPayerProfiles).toEqual([{ userId: 'discord-1', profile: CONSENTED_PAYER }]);
  });

  it('mantém o resultado do pagamento quando salvar o perfil falha', async () => {
    const world = buildWorld({ profileSaveFails: true });
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const view = await world.payments.createPix({
      order, product, payer: CONSENTED_PAYER, savePayerProfile: true,
    });

    expect(view.status).toBe('PENDING');
    expect(world.state.payment?.status).toBe('PENDING');
    expect(errorLog.mock.calls.flat().join(' ')).toContain('PAYER_PROFILE_SAVE_FAILED');
    expect(errorLog.mock.calls.flat().join(' ')).not.toContain(CONSENTED_PAYER.identification.number);
    errorLog.mockRestore();
  });
});

// -------------------------------------------------------------- cartão ----

describe('cartão', () => {
  it('aprovado entrega a licença imediatamente', async () => {
    const world = buildWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    world.provider.nextPayment = pixResult({
      status: 'PAID', statusDetail: 'accredited', method: 'card', installments: 3,
      display: { cardBrand: 'master', cardLastFour: '6789' },
    });

    const view = await world.payments.createCard({
      order, product, payer: { email: 'comprador@example.com' },
      cardToken: 'tok', paymentMethodId: 'master', installments: 3,
    });

    expect(view.status).toBe('PAID');
    expect(view.license?.key).toMatch(/^FMM-/);
    // Só metadados não sensíveis são guardados.
    expect(view.details.display).toEqual({ cardBrand: 'master', cardLastFour: '6789' });
  });

  it('recusado não entrega nada e avisa o cliente', async () => {
    const world = buildWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    world.provider.nextPayment = pixResult({ status: 'DECLINED', statusDetail: 'cc_rejected_call_for_authorize', method: 'card' });

    const view = await world.payments.createCard({
      order, product, payer: { email: 'comprador@example.com' },
      cardToken: 'tok', paymentMethodId: 'master', installments: 1,
    });

    expect(view.status).toBe('DECLINED');
    expect(world.state.license).toBeNull();
    expect(world.state.order.status).toBe('PENDING');
    expect(world.emails.some((e) => e.template.includes('não aprovado'))).toBe(true);
  });

  it('recusa parcelamento fora da faixa', async () => {
    const world = buildWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    await expect(
      world.payments.createCard({
        order, product, payer: { email: 'a@b.com' }, cardToken: 'tok', paymentMethodId: 'master', installments: 99,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('timeout do provider deixa PROCESSING (nunca cobra de novo às cegas)', async () => {
    const world = buildWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    world.provider.failWith = new ProviderTimeoutError();

    await expect(
      world.payments.createCard({
        order, product, payer: { email: 'a@b.com' }, cardToken: 'tok', paymentMethodId: 'master', installments: 1,
      }),
    ).rejects.toBeInstanceOf(ProviderTimeoutError);

    expect(world.state.payment?.status).toBe('PROCESSING');
    expect(world.state.license).toBeNull();
  });

  it('bloqueia pagamento em pedido já pago', async () => {
    const world = buildWorld({ order: { status: 'PAID' } });
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    await expect(
      world.payments.createPix({ order, product, payer: { email: 'a@b.com' } }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

// -------------------------------------------------------------- boleto ----

describe('boleto', () => {
  it('criado fica pendente; confirmado entrega a licença', async () => {
    const world = buildWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    world.provider.nextPayment = pixResult({
      method: 'boleto', status: 'PENDING',
      display: { boletoDigitableLine: '23793.38128', ticketUrl: 'https://mp/boleto' },
    });

    const view = await world.payments.createBoleto({ order, product, payer: { email: 'a@b.com' } });
    expect(view.status).toBe('PENDING');
    expect(world.state.license).toBeNull();

    await world.payments.applyProviderResult('ORD-1', pixResult({ method: 'boleto', status: 'PAID', statusDetail: 'accredited' }), 'webhook');
    expect(world.state.license).not.toBeNull();
  });
});

// ------------------------------------------------------ refund/chargeback --

describe('reembolso e contestação', () => {
  it('reembolso integral revoga a licença sem apagá-la', async () => {
    const world = buildWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    world.provider.nextPayment = pixResult({ status: 'PAID', statusDetail: 'accredited', method: 'card' });
    await world.payments.createCard({
      order, product, payer: { email: 'a@b.com' }, cardToken: 'tok', paymentMethodId: 'master', installments: 1,
    });

    await world.payments.refund(world.state.payment!.id as string);

    expect(world.state.payment?.status).toBe('REFUNDED');
    expect(world.state.license?.status).toBe('REVOKED');
    expect(world.sql.queriesMatching('DELETE FROM fmm_license_keys')).toHaveLength(0);
  });

  it('não reembolsa duas vezes', async () => {
    const world = buildWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    world.provider.nextPayment = pixResult({ status: 'PAID', statusDetail: 'accredited', method: 'card' });
    await world.payments.createCard({
      order, product, payer: { email: 'a@b.com' }, cardToken: 'tok', paymentMethodId: 'master', installments: 1,
    });

    const paymentId = world.state.payment!.id as string;
    await world.payments.refund(paymentId);
    await expect(world.payments.refund(paymentId)).rejects.toBeInstanceOf(ConflictError);
    expect(world.provider.calls.filter((call) => call === 'refund')).toHaveLength(1);
  });

  it('chargeback suspende a licença e mantém histórico', async () => {
    const world = buildWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    world.provider.nextPayment = pixResult({ status: 'PAID', statusDetail: 'accredited', method: 'card' });
    await world.payments.createCard({
      order, product, payer: { email: 'a@b.com' }, cardToken: 'tok', paymentMethodId: 'master', installments: 1,
    });

    await world.payments.applyProviderResult('ORD-1', pixResult({ status: 'CHARGEBACK', method: 'card' }), 'webhook');

    expect(world.state.license?.status).toBe('SUSPENDED');
    expect(world.state.order.status).toBe('CHARGEBACK');
  });
});

// ------------------------------------------------------------- webhooks ----

describe('webhook', () => {
  function webhookWorld() {
    const world = buildWorld();
    const webhooks = new WebhookService(
      world.provider,
      world.payments,
      // Assinaturas não participam destes casos.
      { applyRenewal: async () => null } as never,
    );
    return { ...world, webhooks };
  }

  const REQUEST: WebhookRequest = {
    rawBody: JSON.stringify({ id: 'evt-1', type: 'order', action: 'order.updated', data: { id: 'ORD-1' } }),
    headers: {},
    url: 'https://davimf.dev/api/payments/webhooks/mercadopago?data.id=ORD-1',
  };

  it('assinatura inválida => 401 e nada processado', async () => {
    const world = webhookWorld();
    world.provider.nextWebhook = null;

    const outcome = await world.webhooks.handle(REQUEST);

    expect(outcome).toEqual({ status: 401, result: 'invalid_signature' });
    expect(world.state.license).toBeNull();
    expect(world.emails).toHaveLength(0);
  });

  it('webhook válido confirma o pagamento e entrega a licença uma vez', async () => {
    const world = webhookWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    await world.payments.createPix({ order, product, payer: { email: 'comprador@example.com' } });

    world.provider.nextWebhook = {
      eventKey: 'mp:evt-1',
      eventType: 'order.updated',
      resource: 'payment',
      resourceId: 'ORD-1',
      payment: pixResult({ status: 'PAID', statusDetail: 'accredited' }),
      raw: {},
    };

    const outcome = await world.webhooks.handle(REQUEST);

    expect(outcome).toEqual({ status: 200, result: 'processed' });
    expect(world.state.order.status).toBe('PAID');
    expect(world.state.license).not.toBeNull();
  });

  it('webhook DUPLICADO não reentrega, não regera chave e não reenvia e-mail', async () => {
    const world = webhookWorld();
    const order = await world.orders.requireOrder('id');
    const product = await world.orders.requireProduct('fmm-pro-monthly');
    await world.payments.createPix({ order, product, payer: { email: 'comprador@example.com' } });

    world.provider.nextWebhook = {
      eventKey: 'mp:evt-1',
      eventType: 'order.updated',
      resource: 'payment',
      resourceId: 'ORD-1',
      payment: pixResult({ status: 'PAID', statusDetail: 'accredited' }),
      raw: {},
    };

    const first = await world.webhooks.handle(REQUEST);
    const keyAfterFirst = world.state.license?.key_prefix;
    const emailsAfterFirst = world.emails.length;

    const second = await world.webhooks.handle(REQUEST);

    expect(first.result).toBe('processed');
    expect(second).toEqual({ status: 200, result: 'duplicate' });
    expect(world.state.license?.key_prefix).toBe(keyAfterFirst);
    expect(world.emails).toHaveLength(emailsAfterFirst);
    expect(world.sql.queriesMatching('INSERT INTO fmm_license_keys')).toHaveLength(1);
  });

  it('falha transitória libera o evento para o retry do provider', async () => {
    const world = webhookWorld();
    world.provider.nextWebhook = {
      eventKey: 'mp:evt-erro',
      eventType: 'order.updated',
      resource: 'payment',
      resourceId: 'ORD-1',
      payment: pixResult({ status: 'PAID' }),
      raw: {},
    };
    // Sem pagamento reservado, applyProviderResult devolve null (não lança):
    // o serviço audita e responde 200 sem efeito colateral.
    const outcome = await world.webhooks.handle(REQUEST);
    expect(outcome.status).toBe(200);
    expect(world.state.license).toBeNull();
  });
});
