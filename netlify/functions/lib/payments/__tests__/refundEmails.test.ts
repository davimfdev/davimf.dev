import { describe, expect, it } from 'vitest';
import { refundAlertEmail, refundRequestedEmail } from '../email/templates';

describe('e-mail de confirmação de recebimento', () => {
  it('confirma o recebimento e diz que o estorno foi solicitado', () => {
    const email = refundRequestedEmail({ reference: 'DVMF-1', automatic: true });
    expect(email.subject).toContain('DVMF-1');
    expect(email.html).toContain('recebemos');
    expect(email.html).toContain('estorno foi solicitado');
  });

  it('caminho automático diz que a licença foi revogada e que o prazo depende do meio de pagamento', () => {
    const email = refundRequestedEmail({ reference: 'DVMF-1', automatic: true });
    expect(email.html).toMatch(/licença.*revogada/i);
    expect(email.html).toContain('depende do meio de pagamento');
  });

  it('no caminho manual confirma o recebimento sem prometer estorno', () => {
    const email = refundRequestedEmail({ reference: 'DVMF-1', automatic: false });
    expect(email.html).toContain('recebemos');
    expect(email.html).not.toContain('estorno foi solicitado');
  });

  it('caminho manual diz que será analisado e que a licença segue ativa', () => {
    const email = refundRequestedEmail({ reference: 'DVMF-1', automatic: false });
    expect(email.html).toMatch(/analis/i);
    expect(email.html).toMatch(/licença.*ativa/i);
  });

  it('ambos os caminhos trazem versão texto puro', () => {
    expect(refundRequestedEmail({ reference: 'DVMF-1', automatic: true }).text).toContain('DVMF-1');
    expect(refundRequestedEmail({ reference: 'DVMF-1', automatic: false }).text).toContain('DVMF-1');
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
    const customer = refundRequestedEmail({ reference: 'DVMF-1', automatic: false });

    expect(alert.subject).not.toBe(customer.subject);
  });

  it('detail ausente não quebra o template', () => {
    expect(() => refundAlertEmail({
      reference: 'DVMF-1', orderId: 'ord-1', outcome: 'manual', detail: null,
    })).not.toThrow();
  });
});
