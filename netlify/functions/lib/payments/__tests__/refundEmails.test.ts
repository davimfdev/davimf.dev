import { describe, expect, it } from 'vitest';
import { refundAlertEmail, refundRequestedEmail } from '../email/templates';

describe('e-mail de confirmação de recebimento', () => {
  it('confirma o recebimento e diz que o estorno foi solicitado', () => {
    const email = refundRequestedEmail({ reference: 'DVMF-1', outcome: 'refunded' });
    expect(email.subject).toContain('DVMF-1');
    expect(email.html).toContain('recebemos');
    expect(email.html).toContain('estorno foi solicitado');
  });

  it('caminho automático diz que a licença foi revogada e que o prazo depende do meio de pagamento', () => {
    const email = refundRequestedEmail({ reference: 'DVMF-1', outcome: 'refunded' });
    expect(email.html).toMatch(/licença.*revogada/i);
    expect(email.html).toContain('depende do meio de pagamento');
  });

  it('no caminho manual confirma o recebimento sem prometer estorno', () => {
    const email = refundRequestedEmail({ reference: 'DVMF-1', outcome: 'manual' });
    expect(email.html).toContain('recebemos');
    expect(email.html).not.toContain('estorno foi solicitado');
  });

  it('caminho manual diz que será analisado e que a licença segue ativa', () => {
    const email = refundRequestedEmail({ reference: 'DVMF-1', outcome: 'manual' });
    expect(email.html).toMatch(/analis/i);
    expect(email.html).toMatch(/licença.*ativa/i);
  });

  it('reconciliation_required NÃO reaproveita o corpo manual: nada de licença ativa nem de estorno negado', () => {
    // B2: neste desfecho o dinheiro pode ter se movido e a licença pode ter
    // sido revogada. Afirmar o contrário é pior do que não dizer nada.
    const email = refundRequestedEmail({ reference: 'DVMF-1', outcome: 'reconciliation_required' });

    expect(email.html).toContain('recebemos');
    expect(email.html).not.toMatch(/nenhum estorno foi feito/i);
    expect(email.html).not.toMatch(/licença continua ativa/i);
    expect(email.text).not.toMatch(/nenhum estorno foi feito/i);
    expect(email.text).not.toMatch(/licença continua ativa/i);
  });

  it('reconciliation_required diz que o estorno foi pedido ao Mercado Pago e que a chegada está sendo confirmada', () => {
    const email = refundRequestedEmail({ reference: 'DVMF-1', outcome: 'reconciliation_required' });

    expect(email.html).toContain('estorno foi solicitado');
    expect(email.html).toContain('Mercado Pago');
    expect(email.html).toMatch(/confirma/i);
  });

  it('cada desfecho tem um corpo próprio — nenhum se repete', () => {
    const bodies = (['refunded', 'manual', 'reconciliation_required'] as const)
      .map((outcome) => refundRequestedEmail({ reference: 'DVMF-1', outcome }).html);

    expect(new Set(bodies).size).toBe(3);
  });

  it('os três caminhos trazem versão texto puro', () => {
    expect(refundRequestedEmail({ reference: 'DVMF-1', outcome: 'refunded' }).text).toContain('DVMF-1');
    expect(refundRequestedEmail({ reference: 'DVMF-1', outcome: 'manual' }).text).toContain('DVMF-1');
    expect(refundRequestedEmail({ reference: 'DVMF-1', outcome: 'reconciliation_required' }).text).toContain('DVMF-1');
  });
});

describe('e-mail de alerta ao financeiro (nunca ao cliente)', () => {
  it('reconciliation_required ganha assunto próprio deixando claro que o dinheiro pode ter se movido', () => {
    const email = refundAlertEmail({
      reference: 'DVMF-1',
      orderId: 'ord-1',
      outcome: 'reconciliation_required',
      detail: 'HTTP 500 gateway',
    });

    expect(email.subject).toContain('DVMF-1');
    expect(email.subject.toLowerCase()).toMatch(/diverg|urgente/);
    expect(email.html).toContain('HTTP 500 gateway');
  });

  it('manual recebe um assunto DIFERENTE do de reconciliation_required', () => {
    const manual = refundAlertEmail({
      reference: 'DVMF-1', orderId: 'ord-1', outcome: 'manual', detail: null,
    });
    const reconciliation = refundAlertEmail({
      reference: 'DVMF-1', orderId: 'ord-1', outcome: 'reconciliation_required', detail: null,
    });

    expect(manual.subject).not.toBe(reconciliation.subject);
  });

  it('não reaproveita o template voltado ao cliente', () => {
    const alert = refundAlertEmail({ reference: 'DVMF-1', orderId: 'ord-1', outcome: 'manual', detail: null });
    const customer = refundRequestedEmail({ reference: 'DVMF-1', outcome: 'manual' });

    expect(alert.subject).not.toBe(customer.subject);
  });

  it('detail ausente não quebra o template', () => {
    expect(() => refundAlertEmail({
      reference: 'DVMF-1', orderId: 'ord-1', outcome: 'manual', detail: null,
    })).not.toThrow();
  });
});
