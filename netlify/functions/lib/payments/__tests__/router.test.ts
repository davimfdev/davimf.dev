/**
 * Contrato HTTP: quem pode chamar o quê, e o que o backend se recusa a aceitar.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rejectRawCardData } from '../http';
import { ValidationError } from '../domain/errors';
import { routePaymentsRequest } from '../router';
import { FakeSql, productRow, uninstallSql } from './helpers';

const ORIGIN = 'https://davimf.dev';

function request(path: string, init: RequestInit & { origin?: string } = {}): Request {
  const headers = new Headers(init.headers);
  if (init.origin !== undefined) {
    if (init.origin) headers.set('origin', init.origin);
  } else if (init.method && init.method !== 'GET') {
    headers.set('origin', ORIGIN);
  }
  if (init.body) headers.set('content-type', 'application/json');
  return new Request(`https://davimf.dev${path}`, { ...init, headers });
}

describe('roteador de pagamentos', () => {
  let sql: FakeSql;

  beforeEach(() => {
    sql = new FakeSql([
      { match: (q) => q.includes('FROM products'), rows: [productRow()] },
    ]);
    sql.install();
    process.env.MERCADOPAGO_PUBLIC_KEY = 'TEST-public-key';
    process.env.PAYMENTS_ENV = 'sandbox';
  });

  afterEach(() => {
    uninstallSql();
    delete process.env.MERCADOPAGO_PUBLIC_KEY;
    delete process.env.PAYMENTS_ENV;
    vi.restoreAllMocks();
  });

  it('expõe a public key (é pública) e nunca o access token', async () => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-SECRET-ACCESS-TOKEN';

    const response = await routePaymentsRequest(request('/api/payments/config'));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(body)).toMatchObject({ provider: 'mercadopago', environment: 'sandbox', publicKey: 'TEST-public-key' });
    expect(body).not.toContain('TEST-SECRET-ACCESS-TOKEN');

    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
  });

  it('publica o catálogo com preço em centavos vindo do banco', async () => {
    const response = await routePaymentsRequest(request('/api/payments/products?family=fmm'));
    const { products } = await response.json() as { products: Array<{ code: string; priceCents: number }> };

    expect(response.status).toBe(200);
    expect(products[0]).toMatchObject({ code: 'fmm-pro-monthly', priceCents: 3500 });
  });

  it('bloqueia mutação vinda de origem não autorizada', async () => {
    const response = await routePaymentsRequest(
      request('/api/payments/checkout', { method: 'POST', origin: 'https://evil.example', body: '{}' }),
    );
    expect(response.status).toBe(403);
    expect((await response.json() as { error: { code: string } }).error.code).toBe('FORBIDDEN_ORIGIN');
  });

  it('exige sessão para criar pedido — nunca aceita userId do corpo', async () => {
    const response = await routePaymentsRequest(
      request('/api/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ productCode: 'fmm-pro-monthly', email: 'a@b.com', userId: 'admin' }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it('exige sessão para ler licenças', async () => {
    const response = await routePaymentsRequest(request('/api/payments/licenses'));
    expect(response.status).toBe(401);
  });

  it('exige sessão para reembolso administrativo', async () => {
    const response = await routePaymentsRequest(
      request('/api/payments/admin/refund', { method: 'POST', body: JSON.stringify({ paymentId: 'p1' }) }),
    );
    expect(response.status).toBe(401);
  });

  it('recusa método errado e rota inexistente', async () => {
    expect((await routePaymentsRequest(request('/api/payments/products', { method: 'POST' }))).status).toBe(405);
    expect((await routePaymentsRequest(request('/api/payments/nao-existe'))).status).toBe(404);
  });

  it('webhook sem assinatura válida responde 401', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'segredo';
    const response = await routePaymentsRequest(
      // Sem Origin: o webhook é autenticado por assinatura, não por origem.
      request('/api/payments/webhooks/mercadopago?data.id=1', {
        method: 'POST',
        origin: '',
        body: JSON.stringify({ type: 'payment', data: { id: '1' } }),
      }),
    );
    expect(response.status).toBe(401);
    expect((await response.json() as { error: { code: string } }).error.code).toBe('INVALID_SIGNATURE');
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
  });
});

describe('rejeição de dados sensíveis de cartão', () => {
  it('recusa qualquer corpo que contenha PAN ou CVV', () => {
    for (const field of ['card_number', 'cardNumber', 'cvv', 'securityCode', 'security_code', 'pan']) {
      expect(() => rejectRawCardData({ [field]: '4111111111111111' })).toThrow(ValidationError);
    }
  });

  it('não registra o valor sensível no log — só o nome do campo', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => rejectRawCardData({ cvv: '123' })).toThrow(ValidationError);
    const logged = spy.mock.calls.flat().join(' ');
    expect(logged).toContain('cvv');
    expect(logged).not.toContain('123');
    spy.mockRestore();
  });

  it('aceita corpo legítimo com token e CPF', () => {
    expect(() =>
      rejectRawCardData({ cardToken: 'tok_abc', paymentMethodId: 'master', installments: 3 }),
    ).not.toThrow();
  });
});
