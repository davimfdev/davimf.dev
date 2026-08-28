/**
 * Contrato HTTP: quem pode chamar o quê, e o que o backend se recusa a aceitar.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireDashboardSession } from '../../dashboard/session';
import { setOrderServiceForTesting } from '../application/OrderService';
import { PayerProfileService, setPayerProfileServiceForTesting } from '../application/PayerProfileService';
import { PaymentService, setPaymentServiceForTesting } from '../application/PaymentService';
import { setSubscriptionServiceForTesting } from '../application/SubscriptionService';
import { parsePayer, rejectRawCardData } from '../http';
import { upsertPayerProfile, type PayerProfileData } from '../repositories/PayerProfileRepository';
import { ValidationError } from '../domain/errors';
import { routePaymentsRequest } from '../router';
import { FakeSql, paymentRow, productRow, uninstallSql } from './helpers';
import type { SqlRow } from '../infrastructure/db';

vi.mock('../../dashboard/session', () => ({
  requireDashboardSession: vi.fn(),
}));

const ORIGIN = 'https://davimf.dev';
const PAYER_PROFILE: PayerProfileData = {
  firstName: 'Davi',
  lastName: 'Moraes',
  email: 'davi@example.com',
  phone: '+5511999999999',
  identification: { type: 'CPF', number: '12345678909' },
  address: {
    zipCode: '01310100', streetName: 'Avenida Paulista', streetNumber: '1000',
    neighborhood: 'Bela Vista', city: 'Sao Paulo', state: 'SP', complement: 'Apto 42',
  },
};

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
  let payerProfiles = new Map<string, Record<string, unknown>>();

  beforeEach(() => {
    payerProfiles = new Map();
    sql = new FakeSql([
      { match: (q) => q.includes('FROM products'), rows: [productRow()] },
      {
        match: (q) => q.includes('INSERT INTO payer_profiles'),
        rows: (_query, values) => {
          const row = {
            user_id: String(values[0]), first_name: String(values[1]), email: String(values[3]),
            last_name: String(values[2]), sensitive_ciphertext: String(values[4]), cipher_version: 1,
          };
          payerProfiles.set(row.user_id, row);
          return [row];
        },
      },
      {
        match: (q) => q.trimStart().startsWith('SELECT') && q.includes('FROM payer_profiles'),
        rows: (_query, values) => {
          const row = payerProfiles.get(String(values[0]));
          return row ? [row] : [];
        },
      },
      {
        match: (q) => q.includes('DELETE FROM payer_profiles'),
        rows: (_query, values) => payerProfiles.delete(String(values[0])) ? [{ user_id: values[0] }] : [],
      },
    ]);
    sql.install();
    process.env.MERCADOPAGO_PUBLIC_KEY = 'TEST-public-key';
    process.env.PAYMENTS_ENV = 'sandbox';
    process.env.PAYMENTS_PAYER_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString('base64');
    vi.mocked(requireDashboardSession).mockResolvedValue({ ok: false, status: 401, code: 'SESSION_INVALID' });
  });

  afterEach(() => {
    uninstallSql();
    delete process.env.MERCADOPAGO_PUBLIC_KEY;
    delete process.env.PAYMENTS_ENV;
    delete process.env.PAYMENTS_PAYER_ENCRYPTION_KEY;
    setOrderServiceForTesting(null);
    setPaymentServiceForTesting(null);
    setSubscriptionServiceForTesting(null);
    setPayerProfileServiceForTesting(null);
    vi.restoreAllMocks();
  });

  function authenticate(userId = 'discord-1'): void {
    vi.mocked(requireDashboardSession).mockResolvedValue({
      ok: true,
      session: { userId, accessToken: 'test-access-token', scopes: [], expiresAt: new Date('2027-01-01') },
    });
  }

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

  it('expõe somente o perfil do usuário autenticado e sua disponibilidade de persistência', async () => {
    await upsertPayerProfile('discord-1', PAYER_PROFILE);
    await upsertPayerProfile('discord-2', { ...PAYER_PROFILE, email: 'other@example.com' });
    authenticate('discord-1');

    const response = await routePaymentsRequest(request('/api/payments/payer-profile'));
    const body = await response.json() as { persistenceAvailable: boolean; profile: PayerProfileData | null };

    expect(response.status).toBe(200);
    expect(body).toEqual({ persistenceAvailable: true, profile: PAYER_PROFILE });
    expect(JSON.stringify(body)).not.toContain('other@example.com');
  });

  it('exige sessão para ler, salvar ou apagar o perfil', async () => {
    expect((await routePaymentsRequest(request('/api/payments/payer-profile'))).status).toBe(401);
    expect((await routePaymentsRequest(request('/api/payments/payer-profile', {
      method: 'PUT', body: JSON.stringify(PAYER_PROFILE),
    }))).status).toBe(401);
    expect((await routePaymentsRequest(request('/api/payments/payer-profile', { method: 'DELETE' }))).status).toBe(401);
  });

  it('recusa PUT e DELETE do perfil vindos de origem não autorizada', async () => {
    authenticate();
    for (const method of ['PUT', 'DELETE']) {
      const response = await routePaymentsRequest(request('/api/payments/payer-profile', {
        method, origin: 'https://evil.example', body: method === 'PUT' ? JSON.stringify(PAYER_PROFILE) : undefined,
      }));
      expect(response.status).toBe(403);
    }
  });

  it('recusa salvar quando a chave de criptografia não está disponível sem expor dados do perfil', async () => {
    delete process.env.PAYMENTS_PAYER_ENCRYPTION_KEY;
    authenticate();
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await routePaymentsRequest(request('/api/payments/payer-profile', {
      method: 'PUT', body: JSON.stringify(PAYER_PROFILE),
    }));
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toContain('PAYER_PROFILE_PERSISTENCE_UNAVAILABLE');
    expect(body).not.toContain(PAYER_PROFILE.identification.number);
    expect(errorLog.mock.calls.flat().join(' ')).not.toContain(PAYER_PROFILE.identification.number);
  });

  it('degrada GET para indisponível quando a chave de perfil não existe', async () => {
    delete process.env.PAYMENTS_PAYER_ENCRYPTION_KEY;
    authenticate();

    const response = await routePaymentsRequest(request('/api/payments/payer-profile'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ persistenceAvailable: false, profile: null });
  });

  it('trata INSERT sem RETURNING como falha estável de persistência', async () => {
    authenticate();
    sql.use([{
      match: (query) => query.includes('INSERT INTO payer_profiles'),
      rows: [],
    }]);

    const response = await routePaymentsRequest(request('/api/payments/payer-profile', {
      method: 'PUT', body: JSON.stringify(PAYER_PROFILE),
    }));

    expect(response.status).toBe(503);
    expect((await response.json() as { error: { code: string } }).error.code).toBe('PAYER_PROFILE_PERSISTENCE_FAILED');
  });

  it('salva o perfil consentido pela cobrança /card com renovação automática', async () => {
    authenticate();
    const saved: Array<{ userId: string; profile: PayerProfileData }> = [];
    setOrderServiceForTesting({
      requireOwnedOrder: async () => ({
        id: 'order-1', userId: 'discord-1', userEmail: 'comprador@example.com', productCode: 'fmm-pro-monthly',
        autoRenew: true,
      }),
      requireProduct: async () => productRow(),
    } as never);
    setSubscriptionServiceForTesting({
      create: async () => ({ id: 'sub-1', status: 'ACTIVE', nextBillingDate: null, autoRenew: true }),
    } as never);
    setPaymentServiceForTesting({ listForOrder: async () => [] } as never);
    setPayerProfileServiceForTesting(new PayerProfileService({
      persistenceAvailable: () => true,
      repository: {
        find: async () => null,
        upsert: async (userId, profile) => {
          saved.push({ userId, profile });
          return profile;
        },
        delete: async () => false,
      },
    }));

    const response = await routePaymentsRequest(request('/api/payments/card', {
      method: 'POST',
      body: JSON.stringify({
        orderId: 'order-1', cardToken: 'tok_123', paymentMethodId: 'master', savePayerProfile: true,
        payer: PAYER_PROFILE,
      }),
    }));

    expect(response.status).toBe(201);
    expect(saved).toMatchObject([{ userId: 'discord-1', profile: { email: 'davi@example.com' } }]);
  });

  it('mantém a assinatura /card com renovação automática quando salvar o perfil falha', async () => {
    authenticate();
    setOrderServiceForTesting({
      requireOwnedOrder: async () => ({
        id: 'order-1', userId: 'discord-1', userEmail: 'comprador@example.com', productCode: 'fmm-pro-monthly',
        autoRenew: true,
      }),
      requireProduct: async () => productRow(),
    } as never);
    setSubscriptionServiceForTesting({
      create: async () => ({ id: 'sub-1', status: 'ACTIVE', nextBillingDate: null, autoRenew: true }),
    } as never);
    setPaymentServiceForTesting({ listForOrder: async () => [] } as never);
    setPayerProfileServiceForTesting(new PayerProfileService({
      persistenceAvailable: () => true,
      repository: {
        find: async () => null,
        upsert: async () => { throw new Error(`database rejected ${PAYER_PROFILE.identification.number}`); },
        delete: async () => false,
      },
    }));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await routePaymentsRequest(request('/api/payments/card', {
      method: 'POST',
      body: JSON.stringify({
        orderId: 'order-1', cardToken: 'tok_123', paymentMethodId: 'master', savePayerProfile: true,
        payer: PAYER_PROFILE,
      }),
    }));

    const logged = errorLog.mock.calls.flat().join(' ');
    errorLog.mockRestore();
    expect(response.status).toBe(201);
    expect(logged).toContain('PAYER_PROFILE_SAVE_FAILED');
    expect(logged).not.toContain(PAYER_PROFILE.identification.number);
  });

  it('não expõe PII quando o armazenamento do perfil falha', async () => {
    authenticate();
    sql.use([{
      match: (query) => query.includes('INSERT INTO payer_profiles'),
      rows: () => { throw new Error(`database rejected ${PAYER_PROFILE.identification.number}`); },
    }]);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await routePaymentsRequest(request('/api/payments/payer-profile', {
      method: 'PUT', body: JSON.stringify(PAYER_PROFILE),
    }));
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toContain('PAYER_PROFILE_PERSISTENCE_FAILED');
    expect(body).not.toContain(PAYER_PROFILE.identification.number);
    expect(errorLog.mock.calls.flat().join(' ')).not.toContain(PAYER_PROFILE.identification.number);
  });

  it('apaga o perfil de quem chamou de forma idempotente', async () => {
    await upsertPayerProfile('discord-1', PAYER_PROFILE);
    await upsertPayerProfile('discord-2', { ...PAYER_PROFILE, email: 'other@example.com' });
    authenticate('discord-1');

    const first = await routePaymentsRequest(request('/api/payments/payer-profile', { method: 'DELETE' }));
    const second = await routePaymentsRequest(request('/api/payments/payer-profile', { method: 'DELETE' }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await first.json() as { deleted: boolean }).deleted).toBe(true);
    expect((await second.json() as { deleted: boolean }).deleted).toBe(false);
    authenticate('discord-2');
    expect((await (await routePaymentsRequest(request('/api/payments/payer-profile'))).json() as { profile: unknown }).profile).toMatchObject({ email: 'other@example.com' });
  });

  // ------------------------------------------------------------ Device ID --

  /**
   * Fronteira pública do Device ID. Ele entra pelo corpo da cobrança, chega ao
   * provider e MORRE ali: não vai para o banco, nem para a resposta.
   */
  const CHARGE_ORDER = {
    id: 'order-1',
    reference: 'DVMF-TEST0001',
    userId: 'discord-1',
    userEmail: 'comprador@example.com',
    productCode: 'fmm-pro-monthly',
    quantity: 1,
    amountCents: 3500,
    currency: 'BRL',
    status: 'PENDING',
    autoRenew: false,
    metadata: {},
    createdAt: '2026-08-01T00:00:00.000Z',
    paidAt: null,
  };

  const CHARGE_PRODUCT = {
    id: 1,
    code: 'fmm-pro-monthly',
    family: 'fmm',
    name: 'FMM Pro',
    description: null,
    priceCents: 3500,
    currency: 'BRL',
    isLifetime: false,
    fulfillmentKind: 'fmm_license',
    fulfillmentRef: 'pro',
  };

  /** Instala um PaymentService real com provider falso e SQL de pagamento. */
  function installChargeWorld(): {
    providerInputs: Array<Record<string, unknown>>;
    savedProfiles: Array<{ userId: string; profile: Record<string, unknown> }>;
  } {
    const providerInputs: Array<Record<string, unknown>> = [];
    const savedProfiles: Array<{ userId: string; profile: Record<string, unknown> }> = [];
    let stored: SqlRow | null = null;

    sql.use([
      {
        match: (query) => query.includes('INSERT INTO payments'),
        rows: (_query, values) => {
          stored ??= paymentRow({ order_id: values[0], user_id: values[1], method: values[3], idempotency_key: values[7] });
          return [stored];
        },
      },
      { match: (query) => query.startsWith('SELECT 1 FROM payments'), rows: [] },
      {
        match: (query) => query.includes('UPDATE payments SET'),
        rows: (_query, values) => {
          stored = {
            ...(stored ?? paymentRow()),
            provider_payment_id: values[0] ?? null,
            provider_txn_id: values[1] ?? null,
            status: values[2],
            status_detail: values[3] ?? null,
            details: values[6] ? JSON.parse(String(values[6])) : {},
          };
          return [stored];
        },
      },
      { match: (query) => query.includes('FROM payments WHERE id'), rows: () => (stored ? [stored] : []) },
      { match: (query) => query.includes('INSERT INTO email_dispatches'), rows: [] },
    ]);

    setOrderServiceForTesting({
      requireOwnedOrder: async () => CHARGE_ORDER,
      requireProduct: async () => CHARGE_PRODUCT,
      requireOrder: async () => CHARGE_ORDER,
    } as never);

    setPaymentServiceForTesting(new PaymentService(
      {
        name: 'mercadopago',
        createPixPayment: async (input: Record<string, unknown>) => {
          providerInputs.push(input);
          return {
            providerPaymentId: 'ORD-1', providerTxnId: 'PAY-1', status: 'PENDING',
            statusDetail: 'pending_waiting_transfer', method: 'pix', amountCents: 3500, currency: 'BRL',
            installments: 1, refundedCents: 0, expiresAt: null,
            display: { pixQrCode: '00020126PIX' }, raw: {},
          };
        },
        createCardPayment: async (input: Record<string, unknown>) => {
          providerInputs.push(input);
          return {
            providerPaymentId: 'ORD-2', providerTxnId: 'PAY-2', status: 'PENDING',
            statusDetail: 'pending_review_manual', method: 'card', amountCents: 3500, currency: 'BRL',
            installments: 1, refundedCents: 0, expiresAt: null,
            display: { cardBrand: 'master', cardLastFour: '1234' }, raw: {},
          };
        },
      } as never,
      { requireOrder: async () => CHARGE_ORDER } as never,
      { findByOrder: async () => null } as never,
      { notify: async () => undefined } as never,
      {
        saveFromCharge: async (userId: string, profile: Record<string, unknown>) => {
          savedProfiles.push({ userId, profile });
        },
      } as never,
    ));

    return { providerInputs, savedProfiles };
  }

  function pixRequest(body: Record<string, unknown>): Request {
    return request('/api/payments/pix', { method: 'POST', body: JSON.stringify({ orderId: 'order-1', ...body }) });
  }

  it('leva o Device ID do navegador ao provider sem persistir nem devolvê-lo', async () => {
    authenticate();
    const { providerInputs } = installChargeWorld();
    const deviceId = 'mp-device-session-do-navegador';

    const response = await routePaymentsRequest(pixRequest({
      deviceId,
      payer: { email: 'comprador@example.com' },
    }));
    const body = await response.text();

    expect(response.status).toBe(201);
    expect(providerInputs[0]).toMatchObject({ deviceId });
    // Nunca ecoado na resposta…
    expect(body).not.toContain(deviceId);
    // …e nunca gravado: nenhum valor ligado a nenhuma query o contém.
    expect(JSON.stringify(sql.calls)).not.toContain(deviceId);
  });

  it('cobra normalmente quando o navegador não envia Device ID', async () => {
    authenticate();
    const { providerInputs } = installChargeWorld();

    const response = await routePaymentsRequest(pixRequest({ payer: { email: 'comprador@example.com' } }));

    expect(response.status).toBe(201);
    expect(providerInputs[0]).not.toHaveProperty('deviceId');
  });

  /**
   * Cartão + consentimento: a transação leva o documento do PORTADOR (é o que
   * o emissor valida) e o perfil guarda a identificação que o usuário revisou.
   * Sem essa separação o CPF do portador vira o perfil salvo e volta
   * pré-preenchido na próxima compra.
   */
  it('cobra no cartão com o documento do portador e guarda o perfil revisado', async () => {
    authenticate();
    const { providerInputs, savedProfiles } = installChargeWorld();
    const cardholderDocument = '98765432100';

    const response = await routePaymentsRequest(request('/api/payments/card', {
      method: 'POST',
      body: JSON.stringify({
        orderId: 'order-1',
        cardToken: 'tok_123',
        paymentMethodId: 'master',
        installments: 1,
        savePayerProfile: true,
        payer: { ...PAYER_PROFILE, identification: { type: 'CPF', number: cardholderDocument } },
        payerProfile: PAYER_PROFILE,
      }),
    }));

    expect(response.status).toBe(201);
    // O provider recebe o portador…
    expect(providerInputs[0]).toMatchObject({
      payer: { identification: { type: 'CPF', number: cardholderDocument } },
    });
    // …e o perfil guarda o que foi revisado na identificação.
    expect(savedProfiles).toMatchObject([
      { userId: 'discord-1', profile: { identification: { type: 'CPF', number: PAYER_PROFILE.identification.number } } },
    ]);
    // Campo só-de-perfil nunca é repassado ao provider.
    expect(providerInputs[0]).not.toHaveProperty('payerProfile');
    expect(JSON.stringify(providerInputs[0])).not.toContain(PAYER_PROFILE.identification.number);
  });

  it('valida o perfil consentido com o mesmo rigor, sem ecoar o valor recusado', async () => {
    authenticate();
    const { savedProfiles } = installChargeWorld();

    const response = await routePaymentsRequest(request('/api/payments/card', {
      method: 'POST',
      body: JSON.stringify({
        orderId: 'order-1',
        cardToken: 'tok_123',
        paymentMethodId: 'master',
        savePayerProfile: true,
        payer: { ...PAYER_PROFILE, identification: { type: 'CPF', number: '98765432100' } },
        payerProfile: { ...PAYER_PROFILE, identification: { type: 'CPF', number: '123' } },
      }),
    }));
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(JSON.parse(body)).toMatchObject({ error: { code: 'FIELD_INVALID' } });
    expect(body).not.toContain('123456');
    expect(savedProfiles).toEqual([]);
  });

  it('recusa payerProfile que não seja objeto', async () => {
    authenticate();
    installChargeWorld();

    for (const payerProfile of ['x', 42, [PAYER_PROFILE]]) {
      const response = await routePaymentsRequest(pixRequest({
        savePayerProfile: true, payer: PAYER_PROFILE, payerProfile,
      }));
      expect(response.status).toBe(400);
      expect((await response.json() as { error: { code: string } }).error.code).toBe('FIELD_INVALID');
    }
  });

  it('recusa Device ID que não seja string não vazia e limitada', async () => {
    authenticate();
    installChargeWorld();

    for (const deviceId of [42, { id: 'x' }, 'x'.repeat(301)]) {
      const response = await routePaymentsRequest(pixRequest({ deviceId, payer: { email: 'comprador@example.com' } }));
      expect(response.status).toBe(400);
      expect((await response.json() as { error: { code: string } }).error.code).toBe('FIELD_INVALID');
    }
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

  it('rejeita nome vazio quando ele é enviado no pagador da cobrança', () => {
    expect(() => parsePayer({ payer: { firstName: '' } }, 'comprador@example.com')).toThrow(ValidationError);
  });
});

describe('migração ausente', () => {
  it('vira 503 acionável em vez de 500 genérico', async () => {
    const sql = new FakeSql([
      {
        match: () => true,
        rows: () => {
          // Reproduz o erro real do Postgres quando db/005_payments.sql não
          // foi aplicado no banco que o módulo usa.
          throw Object.assign(new Error('relation "products" does not exist'), { code: '42P01' });
        },
      },
    ]);
    sql.install();
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await routePaymentsRequest(request('/api/payments/products'));
    const body = await response.json() as { error: { code: string; message: string } };

    expect(response.status).toBe(503);
    expect(body.error.code).toBe('PAYMENTS_SCHEMA_MISSING');
    expect(body.error.message).not.toMatch(/relation|products|postgres/i);

    // O log do servidor diz o que fazer e para qual banco.
    const logged = errorLog.mock.calls.flat().join(' ');
    expect(logged).toContain('db/005_payments.sql');
    expect(logged).toContain('products');

    errorLog.mockRestore();
    uninstallSql();
  });

});
