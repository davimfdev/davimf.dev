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

  it('fora da janela grava manual, avisa o financeiro com o relato e nunca chama o estorno', async () => {
    // B1: gravar a linha e confirmar ao cliente não avisa NINGUÉM que uma
    // pessoa precisa agir. O relato do cliente é todo o conteúdo que o
    // analista tem — precisa chegar no alerta.
    const { service, record, refund, acknowledge, alertOperator } = build({
      findOwnedOrder: vi.fn().mockResolvedValue(order({ paidAt: '2026-08-01T12:00:00.000Z' })),
    });

    const result = await service.request({
      orderId: 'ord-1', userId: 'user-1', now: NOW,
      description: 'a licença parou de funcionar depois da atualização',
    });

    expect(result).toEqual({ status: 202, outcome: 'manual' });
    expect(refund).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'manual', description: 'a licença parou de funcionar depois da atualização',
    }));
    expect(acknowledge).toHaveBeenCalledWith(expect.anything(), 'manual');
    expect(alertOperator).toHaveBeenCalledWith(
      expect.anything(), 'manual', 'a licença parou de funcionar depois da atualização',
    );
  });

  it('fora da janela sem relato ainda avisa o financeiro (detail nulo)', async () => {
    const { service, alertOperator } = build({
      findOwnedOrder: vi.fn().mockResolvedValue(order({ paidAt: '2026-08-01T12:00:00.000Z' })),
    });

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'manual' });
    expect(alertOperator).toHaveBeenCalledWith(expect.anything(), 'manual', null);
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

  it('C1: falha ao gravar a recusa por falta de pagamento PAID ainda responde 409 (e loga)', async () => {
    // Nenhum dinheiro se moveu neste caminho — uma falha de auditoria aqui
    // não pode virar 500 no lugar de um 409 determinístico. Mas também não
    // pode ficar invisível: uma linha de log é o mínimo (cleanup 2).
    const record = vi.fn().mockRejectedValue(new Error('db down'));
    const { service } = build({
      listPayments: vi.fn().mockResolvedValue([{ id: 'pay-1', status: 'PENDING' }]),
      record,
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 409, code: 'ORDER_NOT_REFUNDABLE' });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('REFUND_REQUEST_REFUND_INELIGIBLE_AUDIT_WRITE_FAILED'));
    errorSpy.mockRestore();
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

  it('C3: um Proxy hostil (armadilhas que lançam) não escapa de request()', async () => {
    // `classifyRefundFailure` lê `props.refundAccepted` antes de qualquer
    // guarda — um Proxy cuja armadilha `get` lança derruba essa leitura.
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('trap get hostil');
        },
      },
    );
    const refund = vi.fn().mockRejectedValue(hostile);
    const { service, record } = build({ refund });

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'reconciliation_required' });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'reconciliation_required' }),
    );
  });

  it('C3: um acessor próprio que lança ao ser lido não escapa de request()', async () => {
    const hostile: Record<string, unknown> = {};
    Object.defineProperty(hostile, 'refundAccepted', {
      get() {
        throw new Error('accessor hostil');
      },
      enumerable: true,
    });
    const refund = vi.fn().mockRejectedValue(hostile);
    const { service, record } = build({ refund });

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'reconciliation_required' });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'reconciliation_required' }),
    );
  });

  it('C3: Error com `message` que não é string não derruba a resposta (raw.slice)', async () => {
    // Bibliotecas às vezes setam `message` para algo que não é string.
    // `extractProviderError` assumia `error.message` como string antes de
    // `.slice` — este teste prova o `TypeError` sem a coerção.
    const weird = new Error('placeholder');
    Object.defineProperty(weird, 'message', { value: { not: 'a string' }, enumerable: true });
    const refund = vi.fn().mockRejectedValue(weird);
    const { service, record } = build({ refund });

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'reconciliation_required' });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'reconciliation_required',
      providerError: expect.any(String),
    }));
  });

  it('C3: bookkeeping que lança um Proxy hostil não escapa de request()', async () => {
    // O erro do BOOKKEEPING (não o do provider) também é lido: o `catch` de
    // `settleAfterRefundAttempt` chama `extractProviderError(bookkeepingError)`
    // depois de `refund` já ter sido chamado. Um Proxy cuja armadilha `get`
    // lança derruba a leitura de `providerDetail` ali dentro.
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('trap get hostil no bookkeeping');
        },
      },
    );
    const record = vi.fn().mockRejectedValue(hostile);
    const { service, alertOperator } = build({ record });

    await expect(
      service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW }),
    ).resolves.toEqual({ status: 202, outcome: 'reconciliation_required' });
    expect(alertOperator).toHaveBeenCalledWith(
      expect.anything(), 'reconciliation_required', expect.any(String),
    );
  });

  it('C3: bookkeeping cujo `providerDetail` é um acessor que lança não escapa de request()', async () => {
    // `extractProviderError` lê `providerDetail` ANTES de coagir qualquer
    // coisa — um acessor próprio que lança estoura nessa leitura.
    const hostile: Record<string, unknown> = {};
    Object.defineProperty(hostile, 'providerDetail', {
      get() {
        throw new Error('providerDetail hostil');
      },
      enumerable: true,
    });
    const record = vi.fn().mockRejectedValue(hostile);
    const { service, alertOperator } = build({ record });

    await expect(
      service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW }),
    ).resolves.toEqual({ status: 202, outcome: 'reconciliation_required' });
    expect(alertOperator).toHaveBeenCalledWith(
      expect.anything(), 'reconciliation_required', expect.any(String),
    );
  });
});

describe('fix round 3: os caminhos manual e rejected são tão guardados quanto os demais', () => {
  const outOfWindow = () => ({
    findOwnedOrder: vi.fn().mockResolvedValue(order({ paidAt: '2026-08-01T12:00:00.000Z' })),
  });

  it('S2: falha ao confirmar o recebimento fora da janela não vira 500 (e não fica invisível)', async () => {
    // Uma intermitência do provedor de e-mail devolvia 500; o cliente
    // repetia; uma SEGUNDA linha era gravada e nenhuma confirmação saía.
    const acknowledge = vi.fn().mockRejectedValue(new Error('email indisponível'));
    const { service, record } = build({ ...outOfWindow(), acknowledge });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 202, outcome: 'manual' });
    expect(record).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('REFUND_REQUEST_MANUAL_ACKNOWLEDGE_FAILED'));
    errorSpy.mockRestore();
  });

  it('S2: record que lança de forma SÍNCRONA no caminho manual não escapa de request()', async () => {
    const record = vi.fn(() => {
      throw new Error('record indisponível');
    });
    const { service } = build({ ...outOfWindow(), record });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW }),
    ).resolves.toEqual({ status: 202, outcome: 'manual' });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('REFUND_REQUEST_MANUAL_RECORD_FAILED'));
    errorSpy.mockRestore();
  });

  it('S2: falha de auditoria no caminho rejected ainda responde 409 (e loga)', async () => {
    // Nenhum dinheiro se moveu: um 409 determinístico não pode virar 500 por
    // causa do registro — mesma regra já aplicada ao caminho sem pagamento PAID.
    const record = vi.fn().mockRejectedValue(new Error('db down'));
    const { service } = build({
      findOwnedOrder: vi.fn().mockResolvedValue(order({ status: 'CHARGEBACK' })),
      record,
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW });

    expect(result).toEqual({ status: 409, code: 'REFUND_UNDER_DISPUTE' });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('REFUND_REQUEST_REJECTED_AUDIT_WRITE_FAILED'));
    errorSpy.mockRestore();
  });

  it('S2: falha ao avisar o financeiro não derruba a resposta ao cliente (e loga)', async () => {
    const alertOperator = vi.fn(() => {
      throw new Error('alertOperator indisponível');
    });
    const { service, acknowledge } = build({ ...outOfWindow(), alertOperator });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      service.request({ orderId: 'ord-1', userId: 'user-1', now: NOW }),
    ).resolves.toEqual({ status: 202, outcome: 'manual' });
    expect(acknowledge).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('REFUND_REQUEST_MANUAL_ALERT_FAILED'));
    errorSpy.mockRestore();
  });

  it('B1/S2: mesmo com a confirmação ao cliente falhando, o financeiro é avisado', async () => {
    // O alerta ao financeiro não pode depender do e-mail ao comprador: é
    // exatamente quando algo falha que alguém precisa olhar o pedido.
    const acknowledge = vi.fn().mockRejectedValue(new Error('email indisponível'));
    const { service, alertOperator } = build({ ...outOfWindow(), acknowledge });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await service.request({
      orderId: 'ord-1', userId: 'user-1', now: NOW, description: 'comprei duplicado',
    });

    expect(alertOperator).toHaveBeenCalledWith(expect.anything(), 'manual', 'comprei duplicado');
    errorSpy.mockRestore();
  });
});
