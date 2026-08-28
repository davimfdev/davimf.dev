import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildManifest, parseXSignature, verifyWebhookSignature } from '../providers/mercadopago/signature';

const SECRET = 'segredo-de-teste-do-webhook';
const REQUEST_ID = 'req-abc-123';
const NOW = 1_800_000_000_000;

function signedHeaders(dataId: string, ts = String(NOW), secret = SECRET) {
  const manifest = buildManifest({ dataId, requestId: REQUEST_ID, ts });
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex');
  return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': REQUEST_ID };
}

describe('assinatura do webhook Mercado Pago', () => {
  beforeEach(() => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
  });

  it('monta o manifesto no formato oficial e minúsculo', () => {
    expect(buildManifest({ dataId: 'ORD01JQ4S4KY8', requestId: 'r1', ts: '123' }))
      .toBe('id:ord01jq4s4ky8;request-id:r1;ts:123;');
  });

  it('omite do manifesto os campos ausentes', () => {
    expect(buildManifest({ dataId: null, requestId: 'r1', ts: '123' })).toBe('request-id:r1;ts:123;');
  });

  it('extrai ts e v1 do cabeçalho', () => {
    expect(parseXSignature('ts=1704908010,v1=abc')).toEqual({ ts: '1704908010', v1: 'abc' });
    expect(parseXSignature(undefined)).toEqual({ ts: null, v1: null });
  });

  it('aceita uma notificação válida', () => {
    const result = verifyWebhookSignature({
      headers: signedHeaders('ORD-1'),
      url: 'https://davimf.dev/api/payments/webhooks/mercadopago?data.id=ORD-1&type=order',
      now: NOW,
    });
    expect(result).toEqual({ ok: true, dataId: 'ORD-1', ts: String(NOW) });
  });

  it('rejeita assinatura inválida (segredo errado)', () => {
    const result = verifyWebhookSignature({
      headers: signedHeaders('ORD-1', String(NOW), 'segredo-errado'),
      url: 'https://davimf.dev/api/payments/webhooks/mercadopago?data.id=ORD-1',
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: 'MISMATCH' });
  });

  it('rejeita quando o data.id do manifesto não bate com o da query', () => {
    const result = verifyWebhookSignature({
      headers: signedHeaders('ORD-1'),
      // Assinado para ORD-1, entregue como ORD-2: adulteração.
      url: 'https://davimf.dev/api/payments/webhooks/mercadopago?data.id=ORD-2',
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: 'MISMATCH' });
  });

  it('rejeita notificação sem cabeçalho de assinatura', () => {
    const result = verifyWebhookSignature({
      headers: { 'x-request-id': REQUEST_ID },
      url: 'https://davimf.dev/api/payments/webhooks/mercadopago?data.id=ORD-1',
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: 'MISSING_SIGNATURE' });
  });

  it('rejeita replay de notificação antiga', () => {
    const result = verifyWebhookSignature({
      headers: signedHeaders('ORD-1', String(NOW - 60 * 60 * 1000)),
      url: 'https://davimf.dev/api/payments/webhooks/mercadopago?data.id=ORD-1',
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: 'STALE' });
  });

  it('recusa tudo quando o segredo não está configurado', () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const result = verifyWebhookSignature({
      headers: signedHeaders('ORD-1'),
      url: 'https://davimf.dev/api/payments/webhooks/mercadopago?data.id=ORD-1',
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: 'NOT_CONFIGURED' });
  });
});
