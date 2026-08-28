/**
 * Utilitários de teste do módulo de pagamentos.
 *
 * `FakeSql` interpreta as queries por trecho de texto — é o suficiente para
 * exercitar as regras de idempotência (que dependem de "o INSERT retornou
 * linha ou não?") sem subir um Postgres.
 */

import { setPaymentsSqlForTesting, type PaymentsSql, type SqlRow } from '../infrastructure/db';

export type QueryRule = {
  match: (query: string) => boolean;
  rows: SqlRow[] | ((query: string, values: unknown[]) => SqlRow[]);
};

export class FakeSql {
  readonly calls: Array<{ query: string; values: unknown[] }> = [];
  private rules: QueryRule[] = [];

  constructor(rules: QueryRule[] = []) {
    this.rules = rules;
  }

  use(rules: QueryRule[]): void {
    this.rules = rules;
  }

  prepend(rule: QueryRule): void {
    this.rules.unshift(rule);
  }

  get sql(): PaymentsSql {
    return (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join(' ').replace(/\s+/g, ' ').trim();
      this.calls.push({ query, values });
      const rule = this.rules.find((candidate) => candidate.match(query));
      const rows = rule ? (typeof rule.rows === 'function' ? rule.rows(query, values) : rule.rows) : [];
      return Promise.resolve(rows);
    };
  }

  queriesMatching(fragment: string): Array<{ query: string; values: unknown[] }> {
    return this.calls.filter((call) => call.query.includes(fragment));
  }

  install(): void {
    setPaymentsSqlForTesting(this.sql);
  }
}

export function uninstallSql(): void {
  setPaymentsSqlForTesting(null);
}

export function productRow(overrides: Partial<SqlRow> = {}): SqlRow {
  return {
    id: 1,
    code: 'fmm-pro-monthly',
    family: 'fmm',
    name: 'FMM Pro — Mensal',
    description: null,
    price_cents: 3500,
    currency: 'BRL',
    is_lifetime: false,
    recurring_eligible: true,
    recurring_interval: 'months',
    recurring_frequency: 1,
    duration_days: 30,
    fulfillment_kind: 'fmm_license',
    fulfillment_ref: 'pro',
    active: true,
    ...overrides,
  };
}

export function orderRow(overrides: Partial<SqlRow> = {}): SqlRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    reference: 'DVMF-TEST0001',
    user_id: 'discord-1',
    user_email: 'comprador@example.com',
    product_id: 1,
    product_code: 'fmm-pro-monthly',
    quantity: 1,
    amount_cents: 3500,
    currency: 'BRL',
    status: 'PENDING',
    auto_renew: false,
    idempotency_key: 'idem-1',
    metadata: {},
    created_at: '2026-08-01T00:00:00.000Z',
    paid_at: null,
    fulfilled_at: null,
    ...overrides,
  };
}

export function paymentRow(overrides: Partial<SqlRow> = {}): SqlRow {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    order_id: '11111111-1111-4111-8111-111111111111',
    user_id: 'discord-1',
    provider: 'mercadopago',
    provider_payment_id: null,
    provider_txn_id: null,
    method: 'pix',
    amount_cents: 3500,
    currency: 'BRL',
    status: 'PENDING',
    status_detail: null,
    installments: 1,
    refunded_cents: 0,
    idempotency_key: 'pay-idem-1',
    details: {},
    expires_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    paid_at: null,
    ...overrides,
  };
}

export function licenseRow(overrides: Partial<SqlRow> = {}): SqlRow {
  return {
    id: 42,
    order_id: '11111111-1111-4111-8111-111111111111',
    product_id: 1,
    discord_user_id: 'discord-1',
    key_prefix: 'FMM-ABCDEF12',
    level: 'pro',
    status: 'ACTIVE',
    duration_days: 30,
    expires_at: '2026-09-01T00:00:00.000Z',
    activated_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    key_ciphertext: null,
    ...overrides,
  };
}
