import { describe, expect, it, vi } from 'vitest';
import { RefundRequestService } from '../application/RefundRequestService';
import type { Order } from '../domain/types';
import { ProviderError } from '../domain/errors';

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
  const logAccessDenied = vi.fn();
  const service = new RefundRequestService({
    findOwnedOrder: vi.fn().mockResolvedValue(order()),
    listPayments: vi.fn().mockResolvedValue([{ id: 'pay-1', status: 'PAID' }]),
    refund,
    record,
    acknowledge,
    alertOperator,
    logAccessDenied,
    ...overrides,
  } as never);
  return { service, record, refund, acknowledge, alertOperator, logAccessDenied };
}

describe('execução do pedido de reembolso', () => {
  it('pedido de outro usuário responde 404, NÃO grava auditoria e loga a tentativa', async () => {
    const record = vi.fn();
    const { service, logAccessDenied } = build({ findOwnedOrder: vi.fn().mockResolvedValue(null), record });

    const result = await service.request({ orderId: 'ord-alheio', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 404 });
    expect(record).not.toHaveBeenCalled();
    expect(logAccessDenied).toHaveBeenCalledTimes(1);
    expect(logAccessDenied).toHaveBeenCalledWith({ userId: 'user-1', orderId: 'ord-alheio' });
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
      new ProviderError('recusado', { code: 'PROVIDER_REJECTED', detail: 'HTTP 422 rejected' }),
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
      new ProviderError('recusado', { code: 'PROVIDER_REJECTED', detail: hugeError }),
    );
    const { service, record } = build({ refund });

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'manual' });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ providerError: 'x'.repeat(2000) }),
    );
  });

  it('erro lançado como string pura não derruba a resposta (coerção segura, sem placeholder)', async () => {
    // C2: `.slice` sobre um valor `undefined` (nenhum `providerDetail`, e o
    // erro nem é `Error`) lançaria — precisa coercionar antes.
    const refund = vi.fn().mockRejectedValue('falha sem contrato');
    const { service, record } = build({ refund });

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'reconciliation_required' });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'reconciliation_required', providerError: 'falha sem contrato',
    }));
  });

  it('erro sem retryable nem refundAccepted (objeto sem contrato) vira reconciliation_required', async () => {
    // I1: o default seguro para forma desconhecida — inclusive um erro do
    // NOSSO próprio código — é reconciliação, nunca manual.
    const refund = vi.fn().mockRejectedValue({ weird: true });
    const { service, record } = build({ refund });

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'reconciliation_required' });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'reconciliation_required' }),
    );
  });

  it('sem pagamento PAID responde 409 e grava a recusa (posse já confirmada)', async () => {
    // C1: passou pela posse, então também é registrável, mesmo sem
    // pagamento PAID para estornar.
    const { service, record, refund } = build({
      listPayments: vi.fn().mockResolvedValue([{ id: 'pay-1', status: 'PENDING' }]),
    });

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 409, code: 'ORDER_NOT_REFUNDABLE' });
    expect(refund).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'rejected', reasonCode: 'ORDER_NOT_REFUNDABLE' }),
    );
  });

  it('falha de auditoria depois do estorno não escapa nem pede novo estorno', async () => {
    const record = vi.fn()
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({ id: 'req-reconciliation' });
    const { service, refund, alertOperator } = build({ record });

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'reconciliation_required' });
    expect(refund).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenLastCalledWith(expect.objectContaining({
      outcome: 'reconciliation_required', providerError: 'database unavailable',
    }));
    expect(alertOperator).toHaveBeenCalledWith(
      expect.anything(), 'reconciliation_required', 'database unavailable',
    );
  });

  it('falha ao confirmar por e-mail depois do estorno bem-sucedido degrada para reconciliation_required', async () => {
    const acknowledge = vi.fn()
      .mockRejectedValueOnce(new Error('email indisponível'))
      .mockResolvedValue(undefined);
    const { service, record, refund, alertOperator } = build({ acknowledge });

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'reconciliation_required' });
    expect(refund).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledTimes(2);
    expect(record).toHaveBeenLastCalledWith(expect.objectContaining({
      outcome: 'reconciliation_required', providerError: 'email indisponível',
    }));
    expect(alertOperator).toHaveBeenCalledWith(
      expect.anything(), 'reconciliation_required', 'email indisponível',
    );
  });

  it('grava antes de confirmar por e-mail em toda a execução (auditoria antes do aviso)', async () => {
    const calls: string[] = [];
    const record = vi.fn().mockImplementation(async () => {
      calls.push('record');
      return { id: 'req-1' };
    });
    const acknowledge = vi.fn().mockImplementation(async () => {
      calls.push('acknowledge');
    });
    const { service } = build({ record, acknowledge });

    await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(calls).toEqual(['record', 'acknowledge']);
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

describe('fix round 2: nada escapa de request() depois de tentar o estorno', () => {
  it('C3: record que lança de forma SÍNCRONA na degradação não escapa de request()', async () => {
    // Simula wiring incompleto: `deps.record` nem retorna uma promise, só
    // lança na hora — é o caso realista de um dep mal ligado.
    const record = vi.fn(() => {
      throw new Error('record indisponível');
    });
    const { service, alertOperator } = build({ record });

    await expect(
      service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW }),
    ).resolves.toEqual({ status: 202, outcome: 'reconciliation_required' });
    expect(alertOperator).toHaveBeenCalledWith(
      expect.anything(), 'reconciliation_required', 'record indisponível',
    );
  });

  it('C3: alertOperator que lança de forma SÍNCRONA não escapa de request()', async () => {
    const refund = vi.fn().mockRejectedValue(
      Object.assign(new Error('recusado'), { retryable: false }),
    );
    const alertOperator = vi.fn(() => {
      throw new Error('alertOperator indisponível');
    });
    const { service, record } = build({ refund, alertOperator });

    await expect(
      service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW }),
    ).resolves.toEqual({ status: 202, outcome: 'manual' });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'manual' }));
  });

  it('C2/C3: erro sem protótipo (Object.create(null)) não derruba a resposta', async () => {
    // `String()` sobre um objeto sem protótipo lança
    // "Cannot convert object to primitive value" — precisa de coerção segura.
    const refund = vi.fn().mockRejectedValue(Object.create(null));
    const { service, record } = build({ refund });

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'reconciliation_required' });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'reconciliation_required', providerError: 'erro não representável' }),
    );
  });

  it('C1: falha ao gravar a recusa por falta de pagamento PAID ainda responde 409', async () => {
    // Nenhum dinheiro se moveu neste caminho — uma falha de auditoria aqui
    // não pode virar 500 no lugar de um 409 determinístico.
    const record = vi.fn().mockRejectedValue(new Error('db down'));
    const { service } = build({
      listPayments: vi.fn().mockResolvedValue([{ id: 'pay-1', status: 'PENDING' }]),
      record,
    });

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 409, code: 'ORDER_NOT_REFUNDABLE' });
  });

  it('grava antes de confirmar por e-mail também no caminho degradado', async () => {
    const calls: string[] = [];
    const record = vi.fn()
      .mockImplementationOnce(async () => {
        calls.push('record');
        throw new Error('db down');
      })
      .mockImplementationOnce(async () => {
        calls.push('record');
        return { id: 'req-1' };
      });
    const acknowledge = vi.fn().mockImplementation(async () => {
      calls.push('acknowledge');
    });
    const { service } = build({ record, acknowledge });

    await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(calls).toEqual(['record', 'record', 'acknowledge']);
  });
});
