import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../application/NotificationService';
import { siteUrl } from '../config';
import { ResendEmailProvider } from '../email/ResendEmailProvider';
import { fmmLicenseEmail, orderCreatedEmail, paymentApprovedEmail, pixCreatedEmail, type OrderSummary } from '../email/templates';
import type { EmailProvider } from '../email/EmailProvider';
import { FakeSql, uninstallSql } from './helpers';

const BASE_ORDER: OrderSummary = {
  reference: 'DVMF-1',
  productName: 'FMM Pro',
  amountCents: 3500,
  currency: 'BRL',
  method: 'pix',
  legalAcceptance: null,
};

const EMAIL = fmmLicenseEmail({
  reference: 'DVMF-1',
  productName: 'FMM Pro — Mensal',
  amountCents: 3500,
  currency: 'BRL',
  method: 'pix',
  planName: 'FMM Pro — Mensal',
  licenseKey: 'FMM-AAAAAAAA-BBBBBBBB',
  expiresAt: '2026-09-01T00:00:00.000Z',
  isLifetime: false,
  downloadUrl: 'https://github.com/davimfdev/FMM-Releases/releases/latest/download/FMM.exe',
  keysUrl: 'https://davimf.dev/my-keys',
});

function collectingProvider(): EmailProvider & { sent: unknown[] } {
  const sent: unknown[] = [];
  return {
    name: 'fake',
    sent,
    async send(message) {
      sent.push(message);
      return { id: `msg-${sent.length}` };
    },
  };
}

describe('NotificationService', () => {
  let sql: FakeSql;

  beforeEach(() => {
    sql = new FakeSql();
    sql.install();
  });
  afterEach(() => {
    uninstallSql();
    vi.restoreAllMocks();
  });

  it('envia o e-mail quando o evento é novo', async () => {
    sql.use([{ match: (q) => q.includes('INSERT INTO email_dispatches'), rows: [{ id: 1, dedupe_key: 'k' }] }]);
    const provider = collectingProvider();

    const result = await new NotificationService(provider).notify({
      dedupeKey: 'order:1:fmm-license',
      template: 'fmm-license',
      recipient: 'comprador@example.com',
      email: EMAIL,
    });

    expect(result).toEqual({ sent: true, deduped: false });
    expect(provider.sent).toHaveLength(1);
    expect(sql.queriesMatching("status = 'SENT'")).toHaveLength(1);
  });

  it('NÃO reenvia e-mail financeiro duplicado', async () => {
    // O INSERT com ON CONFLICT volta vazio e o reopen não acha nada FAILED.
    sql.use([
      { match: (q) => q.includes('INSERT INTO email_dispatches'), rows: [] },
      { match: (q) => q.includes('UPDATE email_dispatches') && q.includes("status = 'FAILED'"), rows: [] },
    ]);
    const provider = collectingProvider();

    const result = await new NotificationService(provider).notify({
      dedupeKey: 'order:1:fmm-license',
      template: 'fmm-license',
      recipient: 'comprador@example.com',
      email: EMAIL,
    });

    expect(result).toEqual({ sent: false, deduped: true });
    expect(provider.sent).toHaveLength(0);
  });

  it('falha do Resend NÃO derruba o fluxo — e-mail vira FAILED e nada mais', async () => {
    sql.use([
      { match: (q) => q.includes('INSERT INTO email_dispatches'), rows: [{ id: 9, dedupe_key: 'k' }] },
      { match: (q) => q.includes('UPDATE email_dispatches'), rows: [] },
    ]);

    const failing: EmailProvider = {
      name: 'broken',
      send: async () => {
        throw new Error('resend fora do ar');
      },
    };

    const result = await new NotificationService(failing).notify({
      dedupeKey: 'order:1:fmm-license',
      template: 'fmm-license',
      recipient: 'comprador@example.com',
      email: EMAIL,
    });

    // Sem exceção propagada: a licença e o pedido continuam válidos.
    expect(result.sent).toBe(false);
    expect(result.error).toContain('resend fora do ar');
    expect(sql.queriesMatching("status = 'FAILED'")).toHaveLength(1);
  });
});

describe('ResendEmailProvider', () => {
  it('usa a API REST do Resend com o remetente e o Reply-To do projeto', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (input: string, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response(JSON.stringify({ id: 'resend-1' }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await new ResendEmailProvider({ apiKey: 're_test', fetchImpl }).send({
      to: 'comprador@example.com',
      subject: EMAIL.subject,
      html: EMAIL.html,
      text: EMAIL.text,
      idempotencyKey: 'order:1:fmm-license',
    });

    expect(result.id).toBe('resend-1');
    expect(calls[0].url).toBe('https://api.resend.com/emails');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer re_test');
    expect(headers['Idempotency-Key']).toBe('order:1:fmm-license');

    const body = JSON.parse(String(calls[0].init.body));
    expect(body.from).toBe('DAVIMF <noreply@davimf.dev>');
    expect(body.reply_to).toBe('financeiro@davimf.dev');
    expect(body.to).toEqual(['comprador@example.com']);
  });
});

describe('templates', () => {
  it('o e-mail de aprovação carrega chave, download e contatos', () => {
    expect(EMAIL.subject).toBe('FMM — Pagamento aprovado e sua chave');
    for (const expected of [
      'FMM-AAAAAAAA-BBBBBBBB',
      'https://github.com/davimfdev/FMM-Releases/releases/latest/download/FMM.exe',
      'financeiro@davimf.dev',
      'contato@davimf.dev',
      'R$ 35,00',
      'DVMF-1',
    ]) {
      expect(EMAIL.html).toContain(expected);
    }
    expect(EMAIL.text).toContain('FMM-AAAAAAAA-BBBBBBBB');
  });

  it('e-mail da chave FMM (o que o cliente de fmm_license realmente recebe) linka a versão exata aceita, DEPOIS da chave e do download', () => {
    const email = fmmLicenseEmail({
      ...BASE_ORDER,
      planName: 'FMM Pro — Mensal',
      licenseKey: 'FMM-AAAAAAAA-BBBBBBBB',
      expiresAt: '2026-09-01T00:00:00.000Z',
      isLifetime: false,
      downloadUrl: 'https://github.com/davimfdev/FMM-Releases/releases/latest/download/FMM.exe',
      keysUrl: 'https://davimf.dev/my-keys',
      legalAcceptance: {
        version: '2026-08-28-v1',
        acceptedAt: '2026-08-28T12:00:00.000Z',
        termsHash: 'hash-terms',
        privacyHash: 'hash-privacy',
        refundHash: 'hash-refund',
      },
    });

    const base = siteUrl();
    const termsUrl = `${base}/legal/2026-08-28-v1/terms-of-service`;
    expect(email.html).toContain(termsUrl);
    expect(email.html).toContain(`${base}/legal/2026-08-28-v1/privacy-policy`);
    expect(email.html).toContain(`${base}/legal/2026-08-28-v1/refund-policy`);
    expect(email.text).toContain(termsUrl);

    // O bloco de links não pode competir com o que o cliente abriu o e-mail
    // para ver: a chave e o download vêm ANTES, os links de documentos vêm
    // no FIM do corpo.
    expect(email.html.indexOf('FMM-AAAAAAAA-BBBBBBBB')).toBeLessThan(email.html.indexOf(termsUrl));
    expect(email.html.indexOf('github.com/davimfdev/FMM-Releases')).toBeLessThan(email.html.indexOf(termsUrl));
  });

  it('e-mail da chave FMM de pedido sem aceite registrado (anterior à migração) renderiza sem os links, sem quebrar', () => {
    expect(EMAIL.html).not.toContain('/legal/');
    expect(EMAIL.html).not.toMatch(/\bnull\b/);
    expect(EMAIL.text).not.toContain('/legal/');
    expect(EMAIL.text).not.toMatch(/\bnull\b/);
  });

  it('e-mail de pedido criado linka a versão exata dos documentos aceitos', () => {
    const email = orderCreatedEmail({
      ...BASE_ORDER,
      legalAcceptance: {
        version: '2026-08-28-v1',
        acceptedAt: '2026-08-28T12:00:00.000Z',
        termsHash: 'hash-terms',
        privacyHash: 'hash-privacy',
        refundHash: 'hash-refund',
      },
    });

    const base = siteUrl();
    expect(email.html).toContain(`${base}/legal/2026-08-28-v1/terms-of-service`);
    expect(email.html).toContain(`${base}/legal/2026-08-28-v1/privacy-policy`);
    expect(email.html).toContain(`${base}/legal/2026-08-28-v1/refund-policy`);
    expect(email.text).toContain(`${base}/legal/2026-08-28-v1/terms-of-service`);
  });

  it('pedido sem aceite registrado (anterior à migração) renderiza sem os links, sem quebrar', () => {
    const email = orderCreatedEmail(BASE_ORDER);

    expect(email.html).not.toContain('/legal/');
    expect(email.html).not.toMatch(/\bnull\b/);
    expect(email.text).not.toContain('/legal/');
    expect(email.text).not.toMatch(/\bnull\b/);
  });

  it('e-mail de pagamento aprovado (o que o cliente realmente recebe) linka a versão exata aceita', () => {
    const email = paymentApprovedEmail({
      ...BASE_ORDER,
      legalAcceptance: {
        version: '2026-08-28-v1',
        acceptedAt: '2026-08-28T12:00:00.000Z',
        termsHash: 'hash-terms',
        privacyHash: 'hash-privacy',
        refundHash: 'hash-refund',
      },
    });

    const base = siteUrl();
    expect(email.html).toContain(`${base}/legal/2026-08-28-v1/terms-of-service`);
    expect(email.html).toContain(`${base}/legal/2026-08-28-v1/privacy-policy`);
    expect(email.html).toContain(`${base}/legal/2026-08-28-v1/refund-policy`);
    expect(email.text).toContain(`${base}/legal/2026-08-28-v1/terms-of-service`);
  });

  it('pagamento aprovado de pedido sem aceite registrado (anterior à migração) renderiza sem os links, sem quebrar', () => {
    const email = paymentApprovedEmail(BASE_ORDER);

    expect(email.html).not.toContain('/legal/');
    expect(email.html).not.toMatch(/\bnull\b/);
    expect(email.text).not.toContain('/legal/');
    expect(email.text).not.toMatch(/\bnull\b/);
  });

  it('nenhum template carrega dado sensível de cartão', () => {
    const pix = pixCreatedEmail({
      reference: 'DVMF-1',
      productName: 'FMM Pro',
      amountCents: 3500,
      currency: 'BRL',
      method: 'pix',
      pixCode: '00020126PIX',
      expiresAt: null,
    });
    const DISCLAIMER = 'Nunca pedimos número de cartão ou CVV por e-mail.';
    expect(EMAIL.html).toContain(DISCLAIMER);

    // Fora do aviso do rodapé, nenhuma menção a campo sensível de cartão.
    for (const html of [EMAIL.html, pix.html]) {
      expect(html.replace(DISCLAIMER, '')).not.toMatch(/cvv|security_code|card_number/i);
    }
  });
});
