import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderError, ProviderTimeoutError, ValidationError } from '../domain/errors';
import { MercadoPagoClient } from '../providers/mercadopago/client';
import { MercadoPagoPaymentProvider } from '../providers/mercadopago/MercadoPagoPaymentProvider';
import { mapPaymentStatus } from '../providers/mercadopago/mapping';

type FetchCall = { url: string; init: RequestInit };

function stubFetch(responder: (call: FetchCall) => { status?: number; body: unknown }) {
  const calls: FetchCall[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    const { status = 200, body } = responder(call);
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function provider(fetchImpl: typeof fetch, environment: 'sandbox' | 'production' = 'production') {
  return new MercadoPagoPaymentProvider({
    client: new MercadoPagoClient({ accessToken: 'TEST-token', fetchImpl }),
    environment,
  });
}

const PAYER = { email: 'comprador@example.com', identification: { type: 'CPF', number: '12345678909' } };

/** Pagador completo: só campos que o checkout realmente coleta. */
const FULL_PAYER = {
  email: 'comprador@example.com',
  firstName: 'João',
  lastName: 'Silva',
  phone: '62999998888',
  identification: { type: 'CPF', number: '12345678909' },
  address: {
    zipCode: '74000000',
    streetName: 'Av. Goiás',
    streetNumber: '100',
    neighborhood: 'Centro',
    city: 'Goiânia',
    state: 'GO',
    complement: 'Sala 2',
  },
};

const BASE = {
  reference: 'DVMF-1',
  amountCents: 3500,
  currency: 'BRL',
  description: 'FMM Pro — Mensal',
  payer: PAYER,
  idempotencyKey: 'idem-1',
  // Valores comerciais: vêm do Product/Order do banco, nunca do request HTTP.
  quantity: 1,
  itemCode: 'fmm-pro-monthly',
  itemCategoryId: 'software',
};

const CARD = { cardToken: 'tok_seguro_123', paymentMethodId: 'master', installments: 1 };

function orderResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ORD-1',
    total_amount: '35.00',
    transactions: { payments: [{ id: 'PAY-1', amount: '35.00', status: 'action_required' }] },
    ...overrides,
  };
}

describe('MercadoPagoPaymentProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('cria Pix e devolve QR Code e código copia e cola', async () => {
    const { impl, calls } = stubFetch(() => ({
      body: {
        id: 'ORD-PIX-1',
        status: 'action_required',
        total_amount: '35.00',
        currency_id: 'BRL',
        transactions: {
          payments: [{
            id: 'PAY-1',
            amount: '35.00',
            status: 'action_required',
            status_detail: 'pending_waiting_transfer',
            payment_method: {
              id: 'pix',
              type: 'bank_transfer',
              qr_code: '00020126_PIX_COPIA_E_COLA',
              qr_code_base64: 'aGVsbG8=',
              ticket_url: 'https://mp.example/pix',
            },
          }],
        },
      },
    }));

    const result = await provider(impl).createPixPayment({ ...BASE, expiresInMinutes: 30 });

    expect(calls[0].url).toBe('https://api.mercadopago.com/v1/orders');
    // Idempotência nativa: retry com a mesma chave não gera segunda cobrança.
    expect((calls[0].init.headers as Record<string, string>)['X-Idempotency-Key']).toBe('idem-1');

    const body = JSON.parse(String(calls[0].init.body));
    expect(body.total_amount).toBe('35.00');
    expect(body.transactions.payments[0].payment_method).toEqual({ id: 'pix', type: 'bank_transfer' });
    expect(body.transactions.payments[0].expiration_time).toBe('PT30M');

    expect(result.status).toBe('PENDING');
    expect(result.method).toBe('pix');
    expect(result.amountCents).toBe(3500);
    expect(result.display.pixQrCode).toBe('00020126_PIX_COPIA_E_COLA');
    expect(result.display.pixQrCodeBase64).toBe('aGVsbG8=');
  });

  it('usa o pagador sintético exigido pelo Mercado Pago para Pix em sandbox', async () => {
    const { impl, calls } = stubFetch(() => ({
      body: {
        id: 'ORD-PIX-SANDBOX',
        total_amount: '35.00',
        transactions: { payments: [{ id: 'PAY-SANDBOX', amount: '35.00', status: 'action_required' }] },
      },
    }));

    await provider(impl, 'sandbox').createPixPayment(BASE);

    const body = JSON.parse(String(calls[0].init.body));
    expect(body.payer).toMatchObject({
      email: 'test_user_br@testuser.com',
      first_name: 'APRO',
    });
  });

  it('preserva o pagador real em produção', async () => {
    const { impl, calls } = stubFetch(() => ({
      body: {
        id: 'ORD-PIX-PRODUCTION',
        total_amount: '35.00',
        transactions: { payments: [{ id: 'PAY-PRODUCTION', amount: '35.00', status: 'action_required' }] },
      },
    }));

    await provider(impl, 'production').createPixPayment(BASE);

    const body = JSON.parse(String(calls[0].init.body));
    expect(body.payer.email).toBe(PAYER.email);
    expect(body.payer.first_name).toBeUndefined();
  });

  it('cria pagamento com cartão enviando SÓ o token, nunca PAN/CVV', async () => {
    const { impl, calls } = stubFetch(() => ({
      body: {
        id: 'ORD-CARD-1',
        status: 'processed',
        total_amount: '35.00',
        transactions: {
          payments: [{
            id: 'PAY-2',
            amount: '35.00',
            status: 'processed',
            status_detail: 'accredited',
            payment_method: {
              id: 'master', type: 'credit_card', installments: 3,
              card: { last_four_digits: '6789' },
            },
          }],
        },
      },
    }));

    const result = await provider(impl).createCardPayment({
      ...BASE,
      cardToken: 'tok_seguro_123',
      paymentMethodId: 'master',
      installments: 3,
    });

    const raw = String(calls[0].init.body);
    expect(raw).toContain('tok_seguro_123');
    // Nenhum campo sensível de cartão pode aparecer no corpo enviado.
    for (const forbidden of ['card_number', 'security_code', 'cvv', 'cardNumber']) {
      expect(raw).not.toContain(forbidden);
    }
    // O meio de pagamento carrega SÓ a referência segura — nada do cartão em si.
    // (`number` existe no corpo apenas como o CPF do pagador.)
    const sent = JSON.parse(raw);
    expect(Object.keys(sent.transactions.payments[0].payment_method).sort())
      .toEqual(['id', 'installments', 'token', 'type']);

    expect(result.status).toBe('PAID');
    expect(result.installments).toBe(3);
    expect(result.display.cardLastFour).toBe('6789');
    expect(result.display.cardBrand).toBe('master');
  });

  it('mapeia cartão recusado para DECLINED', async () => {
    const { impl } = stubFetch(() => ({
      body: {
        id: 'ORD-CARD-2',
        total_amount: '35.00',
        transactions: {
          payments: [{ id: 'PAY-3', amount: '35.00', status: 'rejected', status_detail: 'cc_rejected_insufficient_amount' }],
        },
      },
    }));

    const result = await provider(impl).createCardPayment({
      ...BASE, cardToken: 'tok', paymentMethodId: 'visa', installments: 1,
    });
    expect(result.status).toBe('DECLINED');
  });

  it('cria boleto com linha digitável e exige endereço', async () => {
    const { impl, calls } = stubFetch(() => ({
      body: {
        id: 'ORD-BOL-1',
        total_amount: '35.00',
        transactions: {
          payments: [{
            id: 'PAY-4', amount: '35.00', status: 'action_required',
            payment_method: {
              id: 'bolbradesco', type: 'ticket',
              digitable_line: '23793.38128 60007.827136 04000.063305 9 96010000003500',
              barcode_content: '23799960100000035003381260007827130400006330',
              ticket_url: 'https://mp.example/boleto',
            },
          }],
        },
      },
    }));

    const target = provider(impl);

    await expect(
      target.createBoletoPayment({ ...BASE, payer: { email: 'x@y.com' } }),
    ).rejects.toBeInstanceOf(ValidationError);

    const result = await target.createBoletoPayment({
      ...BASE,
      payer: {
        ...PAYER,
        firstName: 'João',
        lastName: 'Silva',
        address: { zipCode: '06233903', streetName: 'Av. das Nações Unidas', streetNumber: '3003' },
      },
      expiresInDays: 3,
    });

    const body = JSON.parse(String(calls.at(-1)!.init.body));
    expect(body.transactions.payments[0].payment_method).toEqual({ id: 'bolbradesco', type: 'ticket' });
    expect(body.payer.address.zip_code).toBe('06233903');

    expect(result.status).toBe('PENDING');
    expect(result.method).toBe('boleto');
    expect(result.display.boletoDigitableLine).toContain('23793.38128');
  });

  it('cria assinatura via /preapproval com o token do cartão', async () => {
    const { impl, calls } = stubFetch(() => ({
      body: { id: 'PREAPP-1', status: 'authorized', next_payment_date: '2026-09-01T00:00:00.000Z' },
    }));

    const result = await provider(impl).createSubscription({
      reference: 'DVMF-1',
      amountCents: 3500,
      currency: 'BRL',
      reason: 'FMM Pro — Mensal',
      payer: PAYER,
      cardToken: 'tok_recorrente',
      intervalUnit: 'months',
      intervalCount: 1,
      backUrl: 'https://davimf.dev/fmm-activated?order=1',
      idempotencyKey: 'sub-idem',
    });

    expect(calls[0].url).toBe('https://api.mercadopago.com/preapproval');
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.status).toBe('authorized');
    expect(body.card_token_id).toBe('tok_recorrente');
    expect(body.auto_recurring).toMatchObject({ frequency: 1, frequency_type: 'months', transaction_amount: 35 });

    expect(result.status).toBe('ACTIVE');
    expect(result.providerSubscriptionId).toBe('PREAPP-1');
  });

  it('usa o e-mail de teste do Mercado Pago em assinaturas sandbox', async () => {
    const { impl, calls } = stubFetch(() => ({
      body: { id: 'PREAPP-SANDBOX', status: 'authorized' },
    }));

    await provider(impl, 'sandbox').createSubscription({
      reference: 'DVMF-1',
      amountCents: 3500,
      currency: 'BRL',
      reason: 'FMM Pro — Mensal',
      payer: PAYER,
      cardToken: 'tok_recorrente',
      intervalUnit: 'months',
      intervalCount: 1,
      backUrl: 'https://davimf.dev/fmm-activated?order=1',
      idempotencyKey: 'sub-sandbox',
    });

    const body = JSON.parse(String(calls[0].init.body));
    expect(body.payer_email).toBe('test@testuser.com');
  });

  it('cancela assinatura sem apagar nada no provider', async () => {
    const { impl, calls } = stubFetch(() => ({ body: { id: 'PREAPP-1', status: 'cancelled' } }));
    const result = await provider(impl).cancelSubscription('PREAPP-1');
    expect(calls[0].init.method).toBe('PUT');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ status: 'cancelled' });
    expect(result.status).toBe('CANCELLED');
  });

  it('reembolsa integralmente e devolve REFUNDED', async () => {
    const { impl, calls } = stubFetch(() => ({
      body: {
        id: 'ORD-CARD-1',
        total_amount: '35.00',
        status: 'processed',
        transactions: {
          payments: [{ id: 'PAY-2', amount: '35.00', status: 'processed', status_detail: 'refunded' }],
          refunds: [{ amount: '35.00' }],
        },
      },
    }));

    const result = await provider(impl).refundPayment({ providerPaymentId: 'ORD-CARD-1', idempotencyKey: 'ref-1' });
    expect(calls[0].url).toBe('https://api.mercadopago.com/v1/orders/ORD-CARD-1/refund');
    expect(result.status).toBe('REFUNDED');
    expect(result.refundedCents).toBe(3500);
  });

  it('converte timeout do Mercado Pago em ProviderTimeoutError retentável', async () => {
    const impl = (async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }) as unknown as typeof fetch;

    const promise = provider(impl).createPixPayment(BASE);
    await expect(promise).rejects.toBeInstanceOf(ProviderTimeoutError);
    await promise.catch((error: ProviderTimeoutError) => {
      expect(error.retryable).toBe(true);
      expect(error.status).toBe(504);
    });
  });

  it('não vaza a mensagem do provider para o cliente', async () => {
    const { impl } = stubFetch(() => ({
      status: 400,
      body: { message: 'invalid card_token_id XYZ', cause: [{ code: 2062, description: 'segredo interno' }] },
    }));

    const promise = provider(impl).createCardPayment({ ...BASE, cardToken: 'tok', paymentMethodId: 'visa', installments: 1 });
    await expect(promise).rejects.toBeInstanceOf(ProviderError);
    await promise.catch((error: ProviderError) => {
      expect(error.message).not.toContain('segredo interno');
      expect(error.providerDetail).toContain('segredo interno'); // só auditoria
    });
  });

  it('recusa a notificação quando a assinatura não confere', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'segredo';
    const { impl } = stubFetch(() => ({ body: {} }));
    const result = await provider(impl).processWebhook({
      rawBody: JSON.stringify({ type: 'payment', data: { id: '1' } }),
      headers: { 'x-signature': 'ts=1,v1=deadbeef', 'x-request-id': 'r' },
      url: 'https://davimf.dev/api/payments/webhooks/mercadopago?data.id=1',
    });
    expect(result).toBeNull();
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
  });
});

// -------------------------------------------- Orders enriquecidas (qualidade)

describe('dados comerciais da Order', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mantém Orders online no schema documentado e não mistura campos de QR/Payments API', async () => {
    const { impl, calls } = stubFetch(() => ({ body: orderResponse() }));
    const target = provider(impl);

    await target.createPixPayment({ ...BASE, expiresInMinutes: 30 });
    await target.createCardPayment({ ...BASE, ...CARD });
    await target.createBoletoPayment({ ...BASE, payer: FULL_PAYER, expiresInDays: 3 });

    for (const call of calls) {
      const body = JSON.parse(String(call.init.body));
      expect(body).not.toHaveProperty('items');
      expect(body).not.toHaveProperty('description');
      expect(body).not.toHaveProperty('statement_descriptor');
      expect(body).not.toHaveProperty('additional_info');
      expect(body).toMatchObject({
        type: 'online',
        processing_mode: 'automatic',
        external_reference: BASE.reference,
        total_amount: '35.00',
      });
    }
  });

  it('envia os campos documentados do Pix e nunca capture_mode', async () => {
    const { impl, calls } = stubFetch(() => ({ body: orderResponse() }));

    await provider(impl).createPixPayment({ ...BASE, expiresInMinutes: 30 });

    const body = JSON.parse(String(calls[0].init.body));
    expect(body.total_amount).toBe('35.00');
    expect(body.external_reference).toBe('DVMF-1');
    expect(body.processing_mode).toBe('automatic');
    // capture_mode é contrato de CARTÃO; não pode vazar para Pix.
    expect(body).not.toHaveProperty('capture_mode');
    expect(body).not.toHaveProperty('config');
  });

  it('envia o pagador completo no boleto, sem capture_mode', async () => {
    const { impl, calls } = stubFetch(() => ({ body: orderResponse({ id: 'ORD-BOL' }) }));

    await provider(impl).createBoletoPayment({ ...BASE, payer: FULL_PAYER, expiresInDays: 3 });

    const body = JSON.parse(String(calls[0].init.body));
    expect(body).not.toHaveProperty('capture_mode');
    expect(body.payer).toMatchObject({
      first_name: 'João',
      last_name: 'Silva',
      phone: { area_code: '62', number: '999998888' },
      identification: { type: 'CPF', number: '12345678909' },
      address: {
        zip_code: '74000000',
        street_name: 'Av. Goiás',
        street_number: '100',
        neighborhood: 'Centro',
        city: 'Goiânia',
        state: 'GO',
        complement: 'Sala 2',
      },
    });
  });

  it('omite telefone, endereço e metadados de risco que não existem', async () => {
    const { impl, calls } = stubFetch(() => ({ body: orderResponse() }));

    await provider(impl).createPixPayment(BASE);

    const raw = String(calls[0].init.body);
    const body = JSON.parse(raw);
    expect(body.payer).not.toHaveProperty('phone');
    expect(body.payer).not.toHaveProperty('address');
    expect(body).not.toHaveProperty('additional_info');
    expect(raw).not.toContain('registration_date');
    expect(raw).not.toContain('last_purchase');
  });

  it('não inventa endereço vazio quando só o CEP e o logradouro existem', async () => {
    const { impl, calls } = stubFetch(() => ({ body: orderResponse({ id: 'ORD-BOL-2' }) }));

    await provider(impl).createBoletoPayment({
      ...BASE,
      payer: {
        ...PAYER,
        firstName: 'João',
        lastName: 'Silva',
        address: { zipCode: '06233903', streetName: 'Av. das Nações Unidas', streetNumber: '3003' },
      },
    });

    const address = JSON.parse(String(calls[0].init.body)).payer.address;
    expect(address).toEqual({ zip_code: '06233903', street_name: 'Av. das Nações Unidas', street_number: '3003' });
  });

  it('envia capture_mode automático e 3DS completo apenas no cartão', async () => {
    const { impl, calls } = stubFetch(() => ({ body: orderResponse({ id: 'ORD-CARD' }) }));

    await provider(impl).createCardPayment({ ...BASE, ...CARD });

    const cardBody = JSON.parse(String(calls[0].init.body));
    expect(cardBody).toMatchObject({
      capture_mode: 'automatic',
      config: { online: { transaction_security: { validation: 'on_fraud_risk', liability_shift: 'required' } } },
    });
    expect(cardBody).not.toHaveProperty('items');
  });

  it('cobra o cartão SALVO com a mesma Order enriquecida e o mesmo 3DS completo', async () => {
    const { impl, calls } = stubFetch(() => ({ body: orderResponse({ id: 'ORD-SAVED' }) }));

    await provider(impl).chargeSavedPaymentMethod({
      ...BASE,
      providerCustomerId: 'CUS-1',
      providerMethodId: 'CARD-1',
      cardToken: 'tok_cvv_novo',
      installments: 2,
      deviceId: 'saved-card-device-id',
    });

    const body = JSON.parse(String(calls[0].init.body));
    // Nenhuma Order de cartão pode ficar de fora do 3DS completo.
    expect(body).toMatchObject({
      capture_mode: 'automatic',
      config: { online: { transaction_security: { validation: 'on_fraud_risk', liability_shift: 'required' } } },
    });
    expect(body).not.toHaveProperty('items');
    expect(body).not.toHaveProperty('statement_descriptor');
    // O cartão salvo continua amarrado ao cliente do provider.
    expect(body.payer).toMatchObject({ email: PAYER.email, customer_id: 'CUS-1' });

    // Device ID: só header, nunca corpo — igual ao caminho do cartão novo.
    expect((calls[0].init.headers as Record<string, string>)['X-meli-session-id']).toBe('saved-card-device-id');
    expect(String(calls[0].init.body)).not.toContain('saved-card-device-id');
  });
});

describe('Device ID', () => {
  afterEach(() => vi.restoreAllMocks());

  it('vira X-meli-session-id e nunca entra no corpo da Order', async () => {
    const { impl, calls } = stubFetch(() => ({ body: orderResponse({ id: 'ORD-CARD' }) }));

    await provider(impl).createCardPayment({ ...BASE, ...CARD, deviceId: 'real-sdk-device-id' });

    const cardHeaders = calls[0].init.headers as Record<string, string>;
    const cardBody = JSON.parse(String(calls[0].init.body));
    expect(cardHeaders['X-meli-session-id']).toBe('real-sdk-device-id');
    expect(JSON.stringify(cardBody)).not.toContain('real-sdk-device-id');
  });

  it('acompanha Pix e boleto e some quando o SDK não gerou nada', async () => {
    const withId = stubFetch(() => ({ body: orderResponse() }));
    await provider(withId.impl).createPixPayment({ ...BASE, deviceId: 'pix-device-id' });
    await provider(withId.impl).createBoletoPayment({ ...BASE, payer: FULL_PAYER, deviceId: 'boleto-device-id' });
    expect((withId.calls[0].init.headers as Record<string, string>)['X-meli-session-id']).toBe('pix-device-id');
    expect((withId.calls[1].init.headers as Record<string, string>)['X-meli-session-id']).toBe('boleto-device-id');

    const without = stubFetch(() => ({ body: orderResponse() }));
    await provider(without.impl).createPixPayment(BASE);
    expect(without.calls[0].init.headers as Record<string, string>).not.toHaveProperty('X-meli-session-id');
  });

  it('recusa Device ID vazio, longo demais ou com quebra de linha', async () => {
    const { impl, calls } = stubFetch(() => ({ body: orderResponse() }));
    const target = provider(impl);

    await target.createPixPayment({ ...BASE, deviceId: '   ' });
    await target.createPixPayment({ ...BASE, deviceId: 'x'.repeat(301) });
    await target.createPixPayment({ ...BASE, deviceId: 'ok\r\nX-Injected: 1' });

    for (const call of calls) {
      expect(call.init.headers as Record<string, string>).not.toHaveProperty('X-meli-session-id');
    }
  });

  it('não coloca o Device ID no detalhe de auditoria do erro do provider', async () => {
    const { impl } = stubFetch(() => ({ status: 400, body: { message: 'rejeitado' } }));

    const promise = provider(impl).createCardPayment({ ...BASE, ...CARD, deviceId: 'real-sdk-device-id' });
    await expect(promise).rejects.toBeInstanceOf(ProviderError);
    await promise.catch((error: ProviderError) => {
      expect(error.providerDetail ?? '').not.toContain('real-sdk-device-id');
      expect(error.message).not.toContain('real-sdk-device-id');
    });
  });
});

// ------------------------------------------------------------ 3DS Challenge

const CHALLENGE_URL = 'https://www.mercadopago.com.br/checkout/v1/payment/redirect/3ds/abc123';

/** Fixture oficial de sandbox: titular `APRO-CHOK` (Challenge autenticado). */
function challengeCreatedFixture(id: string) {
  return {
    id,
    status: 'action_required',
    status_detail: 'pending_challenge',
    total_amount: '35.00',
    transactions: {
      payments: [{
        id: `${id}-PAY`,
        amount: '35.00',
        status: 'action_required',
        status_detail: 'pending_challenge',
        payment_method: {
          id: 'master',
          type: 'credit_card',
          installments: 1,
          transaction_security: { type: 'challenge', url: CHALLENGE_URL },
        },
      }],
    },
  };
}

describe('3DS Challenge', () => {
  afterEach(() => vi.restoreAllMocks());

  it('APRO-CHOK: expõe a URL do Challenge e só vira PAID depois da consulta', async () => {
    const { impl } = stubFetch((call) => ({
      body: call.init.method === 'POST'
        ? challengeCreatedFixture('ORD-3DS-APRO')
        : {
            id: 'ORD-3DS-APRO',
            status: 'processed',
            total_amount: '35.00',
            transactions: {
              payments: [{
                id: 'ORD-3DS-APRO-PAY',
                amount: '35.00',
                status: 'processed',
                status_detail: 'accredited',
                payment_method: { id: 'master', type: 'credit_card', installments: 1 },
              }],
            },
          },
    }));

    const target = provider(impl);
    const created = await target.createCardPayment({ ...BASE, ...CARD, cardToken: 'tok_apro_chok' });

    // Challenge pendente NÃO é terminal e nunca é aprovação.
    expect(created.status).toBe('PROCESSING');
    expect(created.statusDetail).toBe('pending_challenge');
    expect(created.display.threeDsUrl).toBe(CHALLENGE_URL);

    const reconciled = await target.getPayment('ORD-3DS-APRO');
    expect(reconciled.status).toBe('PAID');
  });

  it('OTHE-CHNO: Challenge reprovado vira DECLINED', async () => {
    const { impl } = stubFetch((call) => ({
      body: call.init.method === 'POST'
        ? challengeCreatedFixture('ORD-3DS-OTHE')
        : {
            id: 'ORD-3DS-OTHE',
            status: 'action_required',
            total_amount: '35.00',
            transactions: {
              payments: [{
                id: 'ORD-3DS-OTHE-PAY',
                amount: '35.00',
                status: 'rejected',
                status_detail: 'cc_rejected_3ds_challenge',
                payment_method: { id: 'master', type: 'credit_card', installments: 1 },
              }],
            },
          },
    }));

    const target = provider(impl);
    const created = await target.createCardPayment({ ...BASE, ...CARD, cardToken: 'tok_othe_chno' });
    expect(created.status).toBe('PROCESSING');
    expect(created.display.threeDsUrl).toBe(CHALLENGE_URL);

    const reconciled = await target.getPayment('ORD-3DS-OTHE');
    expect(reconciled.status).toBe('DECLINED');
  });
});

describe('normalização de status', () => {
  it('trata o Challenge 3DS como não terminal e a recusa 3DS como recusa', () => {
    expect(mapPaymentStatus('action_required', 'pending_challenge')).toBe('PROCESSING');
    expect(mapPaymentStatus('rejected', 'cc_rejected_3ds_challenge')).toBe('DECLINED');
    expect(mapPaymentStatus('action_required', 'cc_rejected_3ds_challenge')).toBe('DECLINED');
  });

  it('não deixa status do Mercado Pago vazarem para o domínio', () => {
    expect(mapPaymentStatus('processed', 'accredited')).toBe('PAID');
    expect(mapPaymentStatus('action_required', 'pending_waiting_transfer')).toBe('PENDING');
    expect(mapPaymentStatus('rejected', 'cc_rejected_bad_filled_security_code')).toBe('DECLINED');
    expect(mapPaymentStatus('processed', 'partially_refunded')).toBe('PARTIALLY_REFUNDED');
    expect(mapPaymentStatus('charged_back', null)).toBe('CHARGEBACK');
    expect(mapPaymentStatus('expired', null)).toBe('EXPIRED');
    expect(mapPaymentStatus('coisa_desconhecida', null)).toBe('PENDING');
  });
});
