import { describe, expect, it, vi } from 'vitest';
import { RefundRequestService } from '../application/RefundRequestService';
import type { Order } from '../domain/types';

const NOW = new Date('2026-08-28T12:00:00.000Z');

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-1', reference: 'DVMF-1', userId: 'user-1', userEmail: 'a@b.com',
    productId: 1, productCode: 'fmm-pro-lifetime', quantity: 1,
    amountCents: 20000, currency: 'BRL', status: 'PAID', autoRenew: false,
    idempotencyKey: null, metadata: {}, createdAt: '2026-08-25T12:00:00.000Z',
    paidAt: '2026-08-25T12:00:00.000Z', fulfilledAt: null,
    ...overrides,
  };
}

function build(overrides: Record<string, unknown> = {}) {
  const record = vi.fn().mockResolvedValue({ id: 'req-1' });
  const refund = vi.fn().mockResolvedValue({ id: 'pay-1' });
  const acknowledge = vi.fn().mockResolvedValue(undefined);
  // Fake: a implementação real do financeiro é de uma tarefa posterior.
  const alertOperator = vi.fn().mockResolvedValue(undefined);
  const service = new RefundRequestService({
    findOwnedOrder: vi.fn().mockResolvedValue(order()),
    listPayments: vi.fn().mockResolvedValue([{ id: 'pay-1', status: 'PAID' }]),
    refund,
    record,
    acknowledge,
    alertOperator,
    ...overrides,
  } as never);
  return { service, record, refund, acknowledge, alertOperator };
}

describe('execução do pedido de reembolso', () => {
  it('pedido de outro usuário responde 404 e NÃO grava auditoria', async () => {
    const record = vi.fn();
    const { service } = build({ findOwnedOrder: vi.fn().mockResolvedValue(null), record });

    const result = await service.request({ orderId: 'ord-alheio', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 404 });
    expect(record).not.toHaveBeenCalled();
  });

  it('caminho elegível estorna, revoga e grava desfecho refunded', async () => {
    const { service, record, refund, acknowledge } = build();

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 200, outcome: 'refunded' });
    expect(refund).toHaveBeenCalledWith('pay-1');
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'refunded' }));
    expect(acknowledge).toHaveBeenCalledTimes(1);
  });

  it('falha do provider vira manual, sem tocar na licença', async () => {
    const refund = vi.fn().mockRejectedValue(
      Object.assign(new Error('recusado'), { providerDetail: 'HTTP 422 rejected' }),
    );
    const { service, record, alertOperator } = build({ refund });

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'manual' });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'manual', providerError: 'HTTP 422 rejected' }),
    );
    expect(alertOperator).toHaveBeenCalledWith(expect.anything(), 'manual', 'HTTP 422 rejected');
  });

  it('estorno aceito com gravação local falha vira reconciliation_required', async () => {
    const refund = vi.fn().mockRejectedValue(
      Object.assign(new Error('write failed'), { refundAccepted: true }),
    );
    const { service, record, alertOperator } = build({ refund });

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'reconciliation_required' });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'reconciliation_required' }),
    );
    expect(alertOperator).toHaveBeenCalledWith(expect.anything(), 'reconciliation_required', 'write failed');
    // Nunca se pede o estorno de novo ao provider para tentar recuperar.
    expect(refund).toHaveBeenCalledTimes(1);
  });

  it('resultado ambíguo do provider (retryable) também vira reconciliation_required', async () => {
    // Timeout/5xx/429: não sabemos se o estorno ocorreu. Reconciliação, nunca
    // repetir a chamada — repedir é como um reembolso vira dois.
    const refund = vi.fn().mockRejectedValue(
      Object.assign(new Error('gateway timeout'), { retryable: true }),
    );
    const { service, record } = build({ refund });

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'reconciliation_required' });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'reconciliation_required' }),
    );
  });

  it('erro do provider maior que 2000 caracteres é truncado antes de gravar', async () => {
    const hugeError = 'x'.repeat(5000);
    const refund = vi.fn().mockRejectedValue(
      Object.assign(new Error('recusado'), { providerDetail: hugeError }),
    );
    const { service, record } = build({ refund });

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'manual' });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ providerError: 'x'.repeat(2000) }),
    );
  });

  it('fora da janela grava manual e nunca chama o estorno', async () => {
    const { service, record, refund } = build({
      findOwnedOrder: vi.fn().mockResolvedValue(order({ paidAt: '2026-08-01T12:00:00.000Z' })),
    });

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'manual' });
    expect(refund).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'manual' }));
  });

  it('contestação aberta responde 409 e grava a recusa (posse já confirmada)', async () => {
    // Passou pela checagem de posse, então É registrável: recusa repetida
    // durante uma contestação é justamente o que se quer enxergar depois.
    const { service, record } = build({
      findOwnedOrder: vi.fn().mockResolvedValue(order({ status: 'CHARGEBACK' })),
    });

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 409, code: 'REFUND_UNDER_DISPUTE' });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'rejected', reasonCode: 'REFUND_UNDER_DISPUTE' }),
    );
  });
});
