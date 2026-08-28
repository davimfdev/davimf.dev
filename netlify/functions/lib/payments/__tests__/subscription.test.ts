import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FmmLicenseService } from '../application/FmmLicenseService';
import { NotificationService } from '../application/NotificationService';
import { OrderService } from '../application/OrderService';
import { PaymentService } from '../application/PaymentService';
import { SubscriptionService } from '../application/SubscriptionService';
import { ValidationError } from '../domain/errors';
import type { EmailProvider } from '../email/EmailProvider';
import type {
  PaymentProvider,
  ProviderPaymentResult,
  ProviderSavedMethod,
  ProviderSubscriptionResult,
  RefundResult,
} from '../providers/PaymentProvider';
import { FakeSql, licenseRow, orderRow, productRow, uninstallSql } from './helpers';
import type { SqlRow } from '../infrastructure/db';

class SubscriptionProvider implements PaymentProvider {
  readonly name = 'mercadopago';
  readonly calls: string[] = [];
  next: ProviderSubscriptionResult = {
    providerSubscriptionId: 'PREAPP-1',
    status: 'ACTIVE',
    nextBillingDate: '2026-09-01T00:00:00.000Z',
    raw: {},
  };

  // Este fake só cobre recorrência; qualquer cobrança avulsa é erro de teste.
  private unsupported(): never { throw new Error('não usado neste teste'); }

  async createPixPayment(): Promise<ProviderPaymentResult> { return this.unsupported(); }
  async createCardPayment(): Promise<ProviderPaymentResult> { return this.unsupported(); }
  async createBoletoPayment(): Promise<ProviderPaymentResult> { return this.unsupported(); }
  async getPayment(): Promise<ProviderPaymentResult> { return this.unsupported(); }
  async refundPayment(): Promise<RefundResult> { return this.unsupported(); }
  async savePaymentMethod(): Promise<ProviderSavedMethod> { return this.unsupported(); }
  async chargeSavedPaymentMethod(): Promise<ProviderPaymentResult> { return this.unsupported(); }
  async createSubscription() { this.calls.push('create'); return this.next; }
  async cancelSubscription() {
    this.calls.push('cancel');
    return { ...this.next, status: 'CANCELLED' as const };
  }
  async getSubscription() { this.calls.push('get'); return this.next; }
  async processWebhook() { return null; }
}

type World = {
  sql: FakeSql;
  provider: SubscriptionProvider;
  subscriptions: SubscriptionService;
  emails: string[];
  state: { subscription: SqlRow | null; license: SqlRow; extendedDays: number[] };
};

function buildWorld(productOverrides: Partial<SqlRow> = {}): World {
  const emails: string[] = [];
  const state = {
    subscription: null as SqlRow | null,
    license: licenseRow(),
    extendedDays: [] as number[],
  };
  const dispatched = new Set<string>();

  const sql = new FakeSql([
    { match: (q) => q.includes('FROM products') && q.includes('WHERE code'), rows: [productRow(productOverrides)] },
    { match: (q) => q.includes('FROM orders WHERE id'), rows: [orderRow({ auto_renew: true })] },

    {
      match: (q) => q.includes('INSERT INTO subscriptions'),
      rows: (_q, values) => {
        state.subscription = {
          id: 'sub-1', user_id: values[0], product_id: values[1], order_id: values[2],
          provider: values[3], provider_subscription_id: values[4], payment_method_id: null,
          amount_cents: values[6], currency: values[7], interval_unit: values[8],
          interval_count: values[9], status: values[10], auto_renew: values[11],
          next_billing_date: values[12], license_id: null,
          created_at: '2026-08-01T00:00:00.000Z', cancelled_at: null,
        };
        return [state.subscription];
      },
    },
    { match: (q) => q.includes('FROM subscriptions') && q.includes('WHERE provider ='), rows: () => (state.subscription ? [state.subscription] : []) },
    { match: (q) => q.includes('FROM subscriptions WHERE id'), rows: () => (state.subscription ? [state.subscription] : []) },
    {
      match: (q) => q.includes('UPDATE subscriptions') && q.includes("status = 'CANCELLED'"),
      rows: () => {
        if (!state.subscription || state.subscription.status === 'CANCELLED') return [];
        state.subscription = { ...state.subscription, status: 'CANCELLED', auto_renew: false, cancelled_at: 'now' };
        return [state.subscription];
      },
    },
    {
      match: (q) => q.includes('UPDATE subscriptions') && q.includes('SET status'),
      rows: (_q, values) => {
        state.subscription = { ...(state.subscription ?? {}), status: values[0] };
        return [state.subscription];
      },
    },

    // Pagamento espelho da assinatura.
    { match: (q) => q.includes('INSERT INTO payments'), rows: [{ id: 'pay-sub', order_id: 'o', user_id: 'u', provider: 'mercadopago', method: 'subscription', amount_cents: 3500, currency: 'BRL', status: 'PENDING', installments: 1, refunded_cents: 0, idempotency_key: 'k', details: {}, created_at: 'x', updated_at: 'x' }] },
    { match: (q) => q.includes('UPDATE payments SET'), rows: (_q, values) => [{ id: 'pay-sub', order_id: orderRow().id, user_id: 'discord-1', provider: 'mercadopago', method: 'subscription', amount_cents: 3500, currency: 'BRL', status: values[2], installments: 1, refunded_cents: 0, idempotency_key: 'k', details: {}, created_at: 'x', updated_at: 'x', paid_at: values[8] }] },
    { match: (q) => q.includes('UPDATE orders'), rows: [orderRow({ status: 'PAID', auto_renew: true })] },

    { match: (q) => q.includes('FROM fmm_license_keys WHERE order_id'), rows: () => [state.license] },
    { match: (q) => q.includes('INSERT INTO fmm_license_keys'), rows: [] },
    {
      match: (q) => q.includes('UPDATE fmm_license_keys') && q.includes('expires_at'),
      rows: (_q, values) => {
        state.extendedDays.push(Number(values[0]));
        state.license = { ...state.license, expires_at: '2026-10-01T00:00:00.000Z' };
        return [state.license];
      },
    },

    {
      match: (q) => q.includes('INSERT INTO email_dispatches'),
      rows: (_q, values) => {
        const key = String(values[0]);
        if (dispatched.has(key)) return [];
        dispatched.add(key);
        return [{ id: dispatched.size, dedupe_key: key }];
      },
    },
    { match: (q) => q.includes('UPDATE email_dispatches'), rows: [] },
  ]);
  sql.install();

  const emailProvider: EmailProvider = {
    name: 'fake',
    send: async (message) => {
      emails.push(message.subject);
      return { id: 'e' };
    },
  };

  const provider = new SubscriptionProvider();
  const orders = new OrderService();
  const licenses = new FmmLicenseService();
  const notifications = new NotificationService(emailProvider);
  const payments = new PaymentService(provider, orders, licenses, notifications);
  const subscriptions = new SubscriptionService(provider, orders, payments, licenses, notifications);

  return { sql, provider, subscriptions, emails, state };
}

beforeEach(() => {
  process.env.PAYMENTS_LICENSE_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString('base64');
});
afterEach(() => {
  uninstallSql();
  delete process.env.PAYMENTS_LICENSE_ENCRYPTION_KEY;
});

describe('recorrência', () => {
  it('cria a assinatura para produto elegível e entrega a licença', async () => {
    const world = buildWorld();
    const order = await new OrderService().requireOrder('id');
    const product = await new OrderService().requireProduct('fmm-pro-monthly');

    const subscription = await world.subscriptions.create({
      order, product, payer: { email: 'a@b.com' }, cardToken: 'tok',
    });

    expect(subscription.status).toBe('ACTIVE');
    expect(subscription.autoRenew).toBe(true);
    expect(world.emails).toContain('Renovação automática ativada — FMM Pro — Mensal');
  });

  it('produto VITALÍCIO nunca vira assinatura', async () => {
    const world = buildWorld({ is_lifetime: true, recurring_eligible: false, duration_days: 36500 });
    const order = await new OrderService().requireOrder('id');
    const product = await new OrderService().requireProduct('fmm-pro-lifetime');

    await expect(
      world.subscriptions.create({ order, product, payer: { email: 'a@b.com' }, cardToken: 'tok' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(world.provider.calls).not.toContain('create');
  });

  it('renovação aprovada estende a validade da licença', async () => {
    const world = buildWorld();
    const order = await new OrderService().requireOrder('id');
    const product = await new OrderService().requireProduct('fmm-pro-monthly');
    await world.subscriptions.create({ order, product, payer: { email: 'a@b.com' }, cardToken: 'tok' });

    const result = await world.subscriptions.applyRenewal('PREAPP-1', 'approved', '2026-10-01T00:00:00.000Z');

    expect(result?.extended).toBe(true);
    expect(world.state.extendedDays).toEqual([30]);
    expect(world.emails).toContain('Renovação aprovada — FMM Pro — Mensal');
  });

  it('renovação repetida NÃO estende duas vezes (dedup de e-mail cobre o evento)', async () => {
    const world = buildWorld();
    const order = await new OrderService().requireOrder('id');
    const product = await new OrderService().requireProduct('fmm-pro-monthly');
    await world.subscriptions.create({ order, product, payer: { email: 'a@b.com' }, cardToken: 'tok' });

    await world.subscriptions.applyRenewal('PREAPP-1', 'approved', '2026-10-01T00:00:00.000Z');
    const emailsAfterFirst = world.emails.length;
    await world.subscriptions.applyRenewal('PREAPP-1', 'approved', '2026-10-01T00:00:00.000Z');

    // O mesmo evento de renovação não gera segundo e-mail financeiro.
    expect(world.emails).toHaveLength(emailsAfterFirst);
  });

  it('renovação falhada marca PAST_DUE e avisa sem revogar nada', async () => {
    const world = buildWorld();
    const order = await new OrderService().requireOrder('id');
    const product = await new OrderService().requireProduct('fmm-pro-monthly');
    await world.subscriptions.create({ order, product, payer: { email: 'a@b.com' }, cardToken: 'tok' });

    const result = await world.subscriptions.applyRenewal('PREAPP-1', 'failed', null);

    expect(result?.extended).toBe(false);
    expect(world.state.subscription?.status).toBe('PAST_DUE');
    expect(world.emails.some((subject) => subject.startsWith('Não conseguimos renovar'))).toBe(true);
    expect(world.state.license.status).toBe('ACTIVE'); // licença intacta
  });

  it('cancelar renovação preserva histórico e licença', async () => {
    const world = buildWorld();
    const order = await new OrderService().requireOrder('id');
    const product = await new OrderService().requireProduct('fmm-pro-monthly');
    await world.subscriptions.create({ order, product, payer: { email: 'a@b.com' }, cardToken: 'tok' });

    const cancelled = await world.subscriptions.cancel('sub-1', 'discord-1');

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.autoRenew).toBe(false);
    expect(world.state.license.status).toBe('ACTIVE');
    expect(world.sql.queriesMatching('DELETE')).toHaveLength(0);
    expect(world.emails.some((subject) => subject.startsWith('Renovação automática cancelada'))).toBe(true);
  });
});
