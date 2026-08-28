import { describe, expect, it } from 'vitest';
import { decideRefund } from '../application/RefundRequestService';
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

describe('elegibilidade do reembolso', () => {
  it('dentro dos 7 dias e pago: reembolso automático', () => {
    expect(decideRefund(order(), NOW)).toEqual({ kind: 'automatic' });
  });

  it('conta a janela a partir de paidAt, não de createdAt', () => {
    // Boleto: comprado há 20 dias, compensado ontem. A janela abre na entrega.
    const boleto = order({ createdAt: '2026-08-08T12:00:00.000Z', paidAt: '2026-08-27T12:00:00.000Z' });
    expect(decideRefund(boleto, NOW)).toEqual({ kind: 'automatic' });
  });

  it('usa o instante MAIS TARDIO entre pagamento e entrega da licença', () => {
    // Pago há 10 dias, licença emitida ontem numa retentativa: a janela
    // conta da entrega, que é o recebimento do art. 49.
    const late = order({ paidAt: '2026-08-18T12:00:00.000Z', fulfilledAt: '2026-08-27T12:00:00.000Z' });
    expect(decideRefund(late, NOW)).toEqual({ kind: 'automatic' });
  });

  it('sem pagamento e sem entrega não há janela demonstrável', () => {
    expect(decideRefund(order({ paidAt: null, fulfilledAt: null }), NOW))
      .toEqual({ kind: 'manual', reason: 'outside_window' });
  });

  it('exatamente no limite dos 7 dias ainda é automático', () => {
    expect(decideRefund(order({ paidAt: '2026-08-21T12:00:00.000Z' }), NOW)).toEqual({ kind: 'automatic' });
  });

  it('passada a janela vira solicitação manual, nunca recusa', () => {
    expect(decideRefund(order({ paidAt: '2026-08-01T12:00:00.000Z' }), NOW))
      .toEqual({ kind: 'manual', reason: 'outside_window' });
  });

  it('pedido não pago é inelegível', () => {
    expect(decideRefund(order({ status: 'PENDING', paidAt: null }), NOW))
      .toEqual({ kind: 'rejected', code: 'ORDER_NOT_REFUNDABLE' });
  });

  it('pedido já reembolsado informa que foi processado', () => {
    expect(decideRefund(order({ status: 'REFUNDED' }), NOW))
      .toEqual({ kind: 'rejected', code: 'REFUND_ALREADY_PROCESSED' });
    expect(decideRefund(order({ status: 'PARTIALLY_REFUNDED' }), NOW))
      .toEqual({ kind: 'rejected', code: 'REFUND_ALREADY_PROCESSED' });
  });

  it('contestação aberta nunca dispara reembolso automático', () => {
    expect(decideRefund(order({ status: 'CHARGEBACK' }), NOW))
      .toEqual({ kind: 'rejected', code: 'REFUND_UNDER_DISPUTE' });
  });

  it('pedido pago sem paidAt cai na entrega, quando houver', () => {
    expect(decideRefund(order({ paidAt: null, fulfilledAt: '2026-08-26T12:00:00.000Z' }), NOW))
      .toEqual({ kind: 'automatic' });
  });
});
