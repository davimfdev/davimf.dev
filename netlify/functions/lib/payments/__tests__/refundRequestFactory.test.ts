import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRefundRequestService } from '../application/RefundRequestService';
import { setOrderServiceForTesting } from '../application/OrderService';
import { setPaymentServiceForTesting } from '../application/PaymentService';
import { setEmailProviderForTesting } from '../email/ResendEmailProvider';
import { ForbiddenError, NotFoundError, ProviderError } from '../domain/errors';
import type { Order } from '../domain/types';
import type { EmailProvider, EmailMessage } from '../email/EmailProvider';
import { FakeSql, uninstallSql } from './helpers';

const NOW = new Date('2026-08-28T12:00:00.000Z');

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-1', reference: 'DVMF-1', userId: 'user-1', userEmail: 'comprador@example.com',
    productId: 1, productCode: 'fmm-pro-lifetime', quantity: 1,
    amountCents: 20000, currency: 'BRL', status: 'PAID', autoRenew: false,
    idempotencyKey: null, metadata: {}, createdAt: '2026-08-25T12:00:00.000Z',
    paidAt: '2026-08-25T12:00:00.000Z', fulfilledAt: null,
    ...overrides,
  };
}

function collectingProvider(): EmailProvider & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return {
    name: 'fake',
    sent,
    async send(message) {
      sent.push(message);
      return { id: `msg-${sent.length}` };
    },
  };
}

/** Aceita qualquer INSERT/UPDATE que o fluxo precise, devolvendo linhas plausíveis. */
function wireFakeSql(): FakeSql {
  const sql = new FakeSql([
    {
      match: (q) => q.includes('INSERT INTO email_dispatches'),
      rows: [{ id: 1, dedupe_key: 'k' }],
    },
    { match: (q) => q.includes('UPDATE email_dispatches'), rows: [] },
    {
      match: (q) => q.includes('INSERT INTO refund_requests'),
      rows: [{
        id: 'req-1', order_id: 'ord-1', user_id: 'user-1',
        requested_at: '2026-08-28T12:00:00.000Z',
        outcome: 'refunded', reason_code: null, description: null, provider_error: null,
      }],
    },
  ]);
  sql.install();
  return sql;
}

afterEach(() => {
  uninstallSql();
  setOrderServiceForTesting(null);
  setPaymentServiceForTesting(null);
  setEmailProviderForTesting(null);
  vi.restoreAllMocks();
});

describe('getRefundRequestService — findOwnedOrder', () => {
  it('NotFoundError vira null (404), sem propagar', async () => {
    wireFakeSql();
    setOrderServiceForTesting({
      requireOwnedOrder: async () => { throw new NotFoundError(); },
    } as never);
    setPaymentServiceForTesting({} as never);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await getRefundRequestService().request({ orderId: 'ord-x', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 404 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ORDER_ACCESS_DENIED'));
  });

  it('ForbiddenError também vira null (404)', async () => {
    wireFakeSql();
    setOrderServiceForTesting({
      requireOwnedOrder: async () => { throw new ForbiddenError(); },
    } as never);
    setPaymentServiceForTesting({} as never);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await getRefundRequestService().request({ orderId: 'ord-x', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 404 });
  });

  it('qualquer outro erro PROPAGA — um banco fora do ar não pode virar 404', async () => {
    wireFakeSql();
    setOrderServiceForTesting({
      requireOwnedOrder: async () => { throw new Error('banco fora do ar'); },
    } as never);
    setPaymentServiceForTesting({} as never);

    await expect(
      getRefundRequestService().request({ orderId: 'ord-x', userId: 'user-1', now: NOW }),
    ).rejects.toThrow('banco fora do ar');
  });
});

describe('getRefundRequestService — caminho feliz (dentro da janela)', () => {
  it('estorna via PaymentService.refund e confirma o recebimento por e-mail ao comprador', async () => {
    wireFakeSql();
    setOrderServiceForTesting({ requireOwnedOrder: async () => order() } as never);
    const refund = vi.fn().mockResolvedValue({ id: 'pay-1' });
    setPaymentServiceForTesting({
      listForOrder: async () => [{ id: 'pay-1', status: 'PAID' }],
      refund,
    } as never);
    const provider = collectingProvider();
    setEmailProviderForTesting(provider);

    const result = await getRefundRequestService().request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 200, outcome: 'refunded' });
    expect(refund).toHaveBeenCalledWith('pay-1');
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0].to).toBe('comprador@example.com');
    expect(provider.sent[0].idempotencyKey).toBe('order:ord-1:refund-request:refunded');
    expect(provider.sent[0].html).toContain('estorno foi solicitado');
  });
});

describe('getRefundRequestService — alertOperator avisa o financeiro por e-mail', () => {
  it('recusa CONFIRMADA do provider (retryable: false) vira manual: financeiro recebe aviso, comprador recebe confirmação', async () => {
    wireFakeSql();
    setOrderServiceForTesting({ requireOwnedOrder: async () => order() } as never);
    setPaymentServiceForTesting({
      listForOrder: async () => [{ id: 'pay-1', status: 'PAID' }],
      // ProviderError default retryable:false = recusa confirmada, dinheiro não se moveu.
      refund: vi.fn().mockRejectedValue(new ProviderError('recusado', { code: 'PROVIDER_REJECTED', detail: 'HTTP 422 rejected' })),
    } as never);
    const provider = collectingProvider();
    setEmailProviderForTesting(provider);

    const result = await getRefundRequestService().request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'manual' });
    expect(provider.sent).toHaveLength(2); // confirmação ao comprador + alerta ao financeiro
    const operatorMail = provider.sent.find((m) => m.to === 'financeiro@davimf.dev');
    expect(operatorMail).toBeDefined();
    expect(operatorMail?.idempotencyKey).toBe('order:ord-1:refund-alert:manual');
  });

  it('reconciliation_required: alerta ao financeiro usa assunto/dedupe próprios do desfecho', async () => {
    wireFakeSql();
    setOrderServiceForTesting({ requireOwnedOrder: async () => order() } as never);
    setPaymentServiceForTesting({
      listForOrder: async () => [{ id: 'pay-1', status: 'PAID' }],
      refund: vi.fn().mockRejectedValue(Object.assign(new Error('write failed'), { refundAccepted: true })),
    } as never);
    const provider = collectingProvider();
    setEmailProviderForTesting(provider);

    const result = await getRefundRequestService().request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'reconciliation_required' });
    const operatorMail = provider.sent.find((m) => m.to === 'financeiro@davimf.dev');
    expect(operatorMail).toBeDefined();
    expect(operatorMail?.idempotencyKey).toBe('order:ord-1:refund-alert:reconciliation_required');
    expect(operatorMail?.subject).not.toBe(
      provider.sent.find((m) => m.idempotencyKey === 'order:ord-1:refund-alert:manual')?.subject,
    );
  });

  it('B2: no reconciliation_required o comprador NÃO recebe o corpo que nega o estorno', async () => {
    // O desfecho significa que o Mercado Pago pode ter aceitado o estorno e a
    // licença pode ter sido revogada. Mandar o corpo manual ("licença continua
    // ativa — nenhum estorno foi feito") nega ao cliente algo que aconteceu.
    wireFakeSql();
    setOrderServiceForTesting({ requireOwnedOrder: async () => order() } as never);
    setPaymentServiceForTesting({
      listForOrder: async () => [{ id: 'pay-1', status: 'PAID' }],
      refund: vi.fn().mockRejectedValue(Object.assign(new Error('write failed'), { refundAccepted: true })),
    } as never);
    const provider = collectingProvider();
    setEmailProviderForTesting(provider);

    const result = await getRefundRequestService().request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'reconciliation_required' });
    const buyerMail = provider.sent.find((m) => m.to === 'comprador@example.com');
    expect(buyerMail).toBeDefined();
    expect(buyerMail?.html).not.toMatch(/nenhum estorno foi feito/i);
    expect(buyerMail?.html).not.toMatch(/licença continua ativa/i);
    expect(buyerMail?.html).toContain('estorno foi solicitado');
  });

  it('caminho refunded NÃO aciona o alerta ao financeiro', async () => {
    wireFakeSql();
    setOrderServiceForTesting({ requireOwnedOrder: async () => order() } as never);
    setPaymentServiceForTesting({
      listForOrder: async () => [{ id: 'pay-1', status: 'PAID' }],
      refund: vi.fn().mockResolvedValue({ id: 'pay-1' }),
    } as never);
    const provider = collectingProvider();
    setEmailProviderForTesting(provider);

    await getRefundRequestService().request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(provider.sent.some((m) => m.to === 'financeiro@davimf.dev')).toBe(false);
  });
});

describe('getRefundRequestService — fora da janela (análise manual)', () => {
  it('B1: o financeiro recebe o alerta com o relato do cliente, não só o banco', async () => {
    wireFakeSql();
    setOrderServiceForTesting({
      requireOwnedOrder: async () => order({ paidAt: '2026-08-01T12:00:00.000Z' }),
    } as never);
    const refund = vi.fn();
    setPaymentServiceForTesting({ listForOrder: async () => [], refund } as never);
    const provider = collectingProvider();
    setEmailProviderForTesting(provider);

    const result = await getRefundRequestService().request({
      orderId: 'ord-1', userId: 'user-1', now: NOW,
      description: 'comprei duplicado por engano',
    });

    expect(result).toEqual({ status: 202, outcome: 'manual' });
    expect(refund).not.toHaveBeenCalled();
    const operatorMail = provider.sent.find((m) => m.to === 'financeiro@davimf.dev');
    expect(operatorMail).toBeDefined();
    expect(operatorMail?.idempotencyKey).toBe('order:ord-1:refund-alert:manual');
    expect(operatorMail?.html).toContain('comprei duplicado por engano');
    // O comprador também segue recebendo a confirmação de recebimento.
    expect(provider.sent.some((m) => m.to === 'comprador@example.com')).toBe(true);
  });
});
