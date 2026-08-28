import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildManifest,
  parseXSignature,
  secretFingerprint,
  verifyWebhookSignature,
} from '../providers/mercadopago/signature';

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
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET_TEST;
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION;
  });

  it('monta o manifesto oficial preservando o case exato do Order ID', () => {
    expect(buildManifest({ dataId: 'ORD01JQ4S4KY8', requestId: 'r1', ts: '123' }))
      .toBe('id:ORD01JQ4S4KY8;request-id:r1;ts:123;');
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
    expect(result).toEqual({ ok: true, dataId: 'ORD-1', resourceId: 'ORD-1', ts: String(NOW) });
  });

  it('aceita assinaturas distintas de teste e produção na mesma URL', () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    process.env.MERCADOPAGO_WEBHOOK_SECRET_TEST = 'segredo-webhook-teste';
    process.env.MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION = 'segredo-webhook-producao';

    for (const secret of [process.env.MERCADOPAGO_WEBHOOK_SECRET_TEST, process.env.MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION]) {
      const result = verifyWebhookSignature({
        headers: signedHeaders('ORD-1', String(NOW), secret),
        url: 'https://davimf.dev/api/payments/webhooks/mercadopago?data.id=ORD-1&type=order',
        now: NOW,
      });
      expect(result).toMatchObject({ ok: true, dataId: 'ORD-1' });
    }
  });

  it('aceita a normalização minúscula usada por notificações legadas de Order', () => {
    const dataId = 'ORDTST01ABCDEF';
    const ts = String(NOW);
    const legacyManifest = buildManifest({ dataId: dataId.toLowerCase(), requestId: REQUEST_ID, ts });
    const v1 = createHmac('sha256', SECRET).update(legacyManifest).digest('hex');

    const result = verifyWebhookSignature({
      headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': REQUEST_ID },
      url: `https://davimf.dev/api/payments/webhooks/mercadopago?data.id=${dataId}&type=order`,
      now: NOW,
    });

    expect(result).toEqual({ ok: true, dataId, resourceId: dataId, ts });
  });

  it('monta o manifesto apenas com `data.id`, ignorando o `id` legado da query', () => {
    const ts = String(NOW);
    // Documentação: partes ausentes saem do manifesto. `?id=` NÃO substitui
    // `data.id`, ele só localiza o recurso depois da assinatura conferir.
    const manifest = buildManifest({ dataId: null, requestId: REQUEST_ID, ts });
    const v1 = createHmac('sha256', SECRET).update(manifest).digest('hex');

    const result = verifyWebhookSignature({
      headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': REQUEST_ID },
      url: 'https://davimf.dev/api/payments/webhooks/mercadopago?id=123456&topic=payment',
      now: NOW,
    });

    expect(result).toEqual({ ok: true, dataId: null, resourceId: '123456', ts });
  });

  it('não aceita o `id` legado no lugar de `data.id` dentro do manifesto', () => {
    const ts = String(NOW);
    const v1 = createHmac('sha256', SECRET)
      .update(buildManifest({ dataId: '123456', requestId: REQUEST_ID, ts }))
      .digest('hex');

    const result = verifyWebhookSignature({
      headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': REQUEST_ID },
      url: 'https://davimf.dev/api/payments/webhooks/mercadopago?id=123456&topic=payment',
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, reason: 'MISMATCH' });
  });

  it('diagnostica a rejeição sem expor segredo, manifesto ou assinatura', () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    process.env.MERCADOPAGO_WEBHOOK_SECRET_TEST = 'segredo-webhook-teste';
    process.env.MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION = 'segredo-webhook-producao';

    const result = verifyWebhookSignature({
      headers: signedHeaders('ORD-1', String(NOW - 120_000), 'segredo-errado'),
      url: 'https://davimf.dev/api/payments/webhooks/mercadopago?data.id=ORD-1&type=order',
      now: NOW,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: 'MISMATCH',
      diagnostics: {
        secrets: [
          `test:${secretFingerprint('segredo-webhook-teste')}`,
          `production:${secretFingerprint('segredo-webhook-producao')}`,
        ],
        tsAgeSeconds: 120,
        idSource: 'query',
        variants: ['exact', 'lowercase'],
        requestIdValues: 1,
      },
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('segredo-webhook-teste');
    expect(serialized).not.toContain('segredo-webhook-producao');
  });

  it('denuncia teste e produção configurados com o MESMO valor', () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    process.env.MERCADOPAGO_WEBHOOK_SECRET_TEST = 'mesmo-valor-colado-duas-vezes';
    process.env.MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION = 'mesmo-valor-colado-duas-vezes';

    const result = verifyWebhookSignature({
      headers: signedHeaders('ORD-1', String(NOW), 'segredo-errado'),
      url: 'https://davimf.dev/api/payments/webhooks/mercadopago?data.id=ORD-1',
      now: NOW,
    });

    // Um único fingerprint com os dois rótulos: é assim que o log denuncia
    // "colei a mesma assinatura nas duas variáveis".
    expect(result).toMatchObject({
      ok: false,
      reason: 'MISMATCH',
      diagnostics: {
        secrets: [`test+production:${secretFingerprint('mesmo-valor-colado-duas-vezes')}`],
      },
    });
  });

  it('conta os valores de x-request-id para flagrar proxy duplicando o cabeçalho', () => {
    const ts = String(NOW);
    const result = verifyWebhookSignature({
      // `Headers` junta cabeçalhos repetidos com vírgula: o manifesto passa a
      // usar "a, b" e nenhuma assinatura confere.
      headers: { 'x-signature': `ts=${ts},v1=deadbeef`, 'x-request-id': `${REQUEST_ID}, proxy-gerado` },
      url: 'https://davimf.dev/api/payments/webhooks/mercadopago?data.id=ORD-1',
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, reason: 'MISMATCH', diagnostics: { requestIdValues: 2 } });
  });

  it('ignora espaços e quebras de linha coladas no segredo do painel de deploy', () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    process.env.MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION = `  ${SECRET}\n`;

    const result = verifyWebhookSignature({
      headers: signedHeaders('ORD-1'),
      url: 'https://davimf.dev/api/payments/webhooks/mercadopago?data.id=ORD-1',
      now: NOW,
    });

    expect(result).toMatchObject({ ok: true, dataId: 'ORD-1' });
  });

  it('rejeita assinatura inválida (segredo errado)', () => {
    const result = verifyWebhookSignature({
      headers: signedHeaders('ORD-1', String(NOW), 'segredo-errado'),
      url: 'https://davimf.dev/api/payments/webhooks/mercadopago?data.id=ORD-1',
      now: NOW,
    });
    expect(result).toMatchObject({ ok: false, reason: 'MISMATCH' });
  });

  it('rejeita quando o data.id do manifesto não bate com o da query', () => {
    const result = verifyWebhookSignature({
      headers: signedHeaders('ORD-1'),
      // Assinado para ORD-1, entregue como ORD-2: adulteração.
      url: 'https://davimf.dev/api/payments/webhooks/mercadopago?data.id=ORD-2',
      now: NOW,
    });
    expect(result).toMatchObject({ ok: false, reason: 'MISMATCH' });
  });

  it('rejeita notificação sem cabeçalho de assinatura', () => {
    const result = verifyWebhookSignature({
      headers: { 'x-request-id': REQUEST_ID },
      url: 'https://davimf.dev/api/payments/webhooks/mercadopago?data.id=ORD-1',
      now: NOW,
    });
    expect(result).toMatchObject({ ok: false, reason: 'MISSING_SIGNATURE' });
  });

  it('rejeita replay de notificação antiga', () => {
    const result = verifyWebhookSignature({
      headers: signedHeaders('ORD-1', String(NOW - 60 * 60 * 1000)),
      url: 'https://davimf.dev/api/payments/webhooks/mercadopago?data.id=ORD-1',
      now: NOW,
    });
    expect(result).toMatchObject({ ok: false, reason: 'STALE' });
  });

  it('recusa tudo quando o segredo não está configurado', () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const result = verifyWebhookSignature({
      headers: signedHeaders('ORD-1'),
      url: 'https://davimf.dev/api/payments/webhooks/mercadopago?data.id=ORD-1',
      now: NOW,
    });
    expect(result).toMatchObject({ ok: false, reason: 'NOT_CONFIGURED' });
  });
});
