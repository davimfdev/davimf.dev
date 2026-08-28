import { afterEach, describe, expect, it } from 'vitest';
import { setPaymentsSqlForTesting } from '../infrastructure/db';
import { createRefundRequest } from '../repositories/RefundRequestRepository';

function fakeSql(rows: Record<string, unknown>[]) {
  const calls: string[] = [];
  const sql = ((strings: TemplateStringsArray) => {
    calls.push(strings.join('?'));
    return Promise.resolve(rows);
  }) as never;
  return { sql, calls };
}

afterEach(() => setPaymentsSqlForTesting(null));

describe('RefundRequestRepository', () => {
  it('grava o pedido com o desfecho e devolve a linha', async () => {
    const { sql, calls } = fakeSql([{
      id: 'req-1',
      order_id: 'ord-1',
      user_id: 'user-1',
      requested_at: '2026-08-28T12:00:00.000Z',
      outcome: 'refunded',
      provider_error: null,
    }]);
    setPaymentsSqlForTesting(sql);

    const saved = await createRefundRequest({
      orderId: 'ord-1',
      userId: 'user-1',
      outcome: 'refunded',
    });

    expect(saved).toEqual({
      id: 'req-1',
      orderId: 'ord-1',
      userId: 'user-1',
      requestedAt: '2026-08-28T12:00:00.000Z',
      outcome: 'refunded',
      reasonCode: null,
      description: null,
      providerError: null,
    });
    expect(calls[0]).toContain('INSERT INTO refund_requests');
  });

  it('preserva o erro do provider quando o desfecho exige análise', async () => {
    const { sql } = fakeSql([{
      id: 'req-2', order_id: 'ord-1', user_id: 'user-1',
      requested_at: '2026-08-28T12:00:00.000Z',
      outcome: 'reconciliation_required',
      provider_error: 'HTTP 500 gateway',
    }]);
    setPaymentsSqlForTesting(sql);

    const saved = await createRefundRequest({
      orderId: 'ord-1', userId: 'user-1',
      outcome: 'reconciliation_required', providerError: 'HTTP 500 gateway',
    });

    expect(saved.providerError).toBe('HTTP 500 gateway');
  });
});
