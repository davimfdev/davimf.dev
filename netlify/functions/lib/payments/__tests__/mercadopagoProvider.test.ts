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

function provider(fetchImpl: typeof fetch) {
  return new MercadoPagoPaymentProvider({ client: new MercadoPagoClient({ accessToken: 'TEST-token', fetchImpl }) });
}

const PAYER = { email: 'comprador@example.com', identification: { type: 'CPF', number: '12345678909' } };

const BASE = {
  reference: 'DVMF-1',
  amountCents: 3500,
  currency: 'BRL',
  description: 'FMM Pro — Mensal',
  payer: PAYER,
  idempotencyKey: 'idem-1',
};

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

describe('normalização de status', () => {
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
