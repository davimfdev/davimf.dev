import { afterEach, describe, expect, it } from 'vitest';
import { setPaymentsSqlForTesting } from '../infrastructure/db';
import { createOrder } from '../repositories/OrderRepository';

const ACCEPTANCE = {
  version: '2026-08-28-v1',
  acceptedAt: '2026-08-29T12:00:00.000Z',
  termsHash: 'a'.repeat(64),
  privacyHash: 'b'.repeat(64),
  refundHash: 'c'.repeat(64),
};

function captureSql(row: Record<string, unknown>) {
  const statements: string[] = [];
  const values: unknown[][] = [];
  const sql = ((strings: TemplateStringsArray, ...args: unknown[]) => {
    statements.push(strings.join('?'));
    values.push(args);
    return Promise.resolve([row]);
  }) as never;
  return { sql, statements, values };
}

const BASE_ROW = {
  id: 'ord-1', reference: 'DVMF-1', user_id: 'u1', user_email: 'a@b.com',
  product_id: 1, product_code: 'fmm-pro-lifetime', quantity: 1,
  amount_cents: 20000, currency: 'BRL', status: 'PENDING', auto_renew: false,
  idempotency_key: 'k1', metadata: {}, created_at: '2026-08-29T12:00:00.000Z',
  paid_at: null, fulfilled_at: null,
  legal_version: '2026-08-28-v1', legal_accepted_at: '2026-08-29T12:00:00.000Z',
  terms_hash: 'a'.repeat(64), privacy_policy_hash: 'b'.repeat(64),
  refund_policy_hash: 'c'.repeat(64),
};

const INPUT = {
  reference: 'DVMF-1', userId: 'u1', userEmail: 'a@b.com', productId: 1,
  productCode: 'fmm-pro-lifetime', quantity: 1, amountCents: 20000,
  currency: 'BRL', autoRenew: false, idempotencyKey: 'k1',
};

afterEach(() => setPaymentsSqlForTesting(null));

describe('aceite legal no pedido', () => {
  it('grava versão, instante e os três hashes', async () => {
    const { sql, values } = captureSql(BASE_ROW);
    setPaymentsSqlForTesting(sql);

    const order = await createOrder({ ...INPUT, legalAcceptance: ACCEPTANCE });

    expect(values[0]).toContain('2026-08-28-v1');
    expect(values[0]).toContain('a'.repeat(64));
    expect(order.legalAcceptance).toEqual(ACCEPTANCE);
  });

  it('NÃO sobrescreve o aceite original quando o pedido é reaproveitado', async () => {
    const { sql, statements } = captureSql(BASE_ROW);
    setPaymentsSqlForTesting(sql);

    await createOrder({ ...INPUT, legalAcceptance: ACCEPTANCE });

    // O INSERT termina em ON CONFLICT DO UPDATE. O aceite não pode entrar
    // nesse UPDATE: o que vale é o que a pessoa aceitou da primeira vez.
    // Recorta só o fragmento DO UPDATE SET (até o RETURNING) — o RETURNING
    // legitimamente lista as colunas de aceite, então não pode entrar na checagem.
    const doUpdateStart = statements[0].indexOf('DO UPDATE');
    const returningStart = statements[0].indexOf('RETURNING');
    const doUpdateClause = statements[0].slice(doUpdateStart, returningStart);
    expect(doUpdateClause).not.toContain('legal_version');
    expect(doUpdateClause).not.toContain('terms_hash');
  });

  it('pedido antigo sem aceite devolve null em vez de inventar um', async () => {
    const { sql } = captureSql({
      ...BASE_ROW, legal_version: null, legal_accepted_at: null,
      terms_hash: null, privacy_policy_hash: null, refund_policy_hash: null,
    });
    setPaymentsSqlForTesting(sql);

    const order = await createOrder(INPUT);
    expect(order.legalAcceptance).toBeNull();
  });
});
