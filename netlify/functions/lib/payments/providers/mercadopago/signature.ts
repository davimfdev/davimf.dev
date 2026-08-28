/**
 * Validação da assinatura `x-signature` das notificações do Mercado Pago.
 *
 * Manifesto oficial: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * — `data.id` vem da QUERY STRING da notificação (minúsculo se alfanumérico);
 * — partes ausentes são OMITIDAS do manifesto (inclusive o rótulo);
 * — HMAC-SHA256 hex com MERCADOPAGO_WEBHOOK_SECRET, comparado a `v1`.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Tolerância de relógio; barra replay de notificações antigas capturadas. */
const MAX_SKEW_MS = Number(process.env.MERCADOPAGO_WEBHOOK_MAX_SKEW_MS ?? 15 * 60_000);

export type SignatureParts = { ts: string | null; v1: string | null };

export function parseXSignature(header: string | undefined | null): SignatureParts {
  if (!header) return { ts: null, v1: null };
  const parts: SignatureParts = { ts: null, v1: null };
  for (const chunk of header.split(',')) {
    const separator = chunk.indexOf('=');
    if (separator <= 0) continue;
    const key = chunk.slice(0, separator).trim();
    const value = chunk.slice(separator + 1).trim();
    if (key === 'ts') parts.ts = value;
    else if (key === 'v1') parts.v1 = value;
  }
  return parts;
}

export function buildManifest(input: {
  dataId: string | null;
  requestId: string | null;
  ts: string | null;
}): string {
  const segments: string[] = [];
  if (input.dataId) segments.push(`id:${input.dataId.toLowerCase()};`);
  if (input.requestId) segments.push(`request-id:${input.requestId};`);
  if (input.ts) segments.push(`ts:${input.ts};`);
  return segments.join('');
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

export type VerifyInput = {
  headers: Record<string, string | undefined>;
  url: string;
  secret?: string;
  now?: number;
};

export type VerifyResult =
  | { ok: true; dataId: string | null; ts: string | null }
  | { ok: false; reason: 'NOT_CONFIGURED' | 'MISSING_SIGNATURE' | 'STALE' | 'MISMATCH' };

function headerValue(headers: Record<string, string | undefined>, name: string): string | null {
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (direct) return direct;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name.toLowerCase() && value) return value;
  }
  return null;
}

export function verifyWebhookSignature(input: VerifyInput): VerifyResult {
  // Teste e produção podem apontar para a mesma URL, mas o painel gera um
  // segredo independente para cada modo. Validamos contra ambos sem jamais
  // identificar no log qual deles conferiu. A variável legada continua
  // aceita para instalações com apenas um ambiente.
  const secrets = (input.secret !== undefined
    ? [input.secret]
    : [
        process.env.MERCADOPAGO_WEBHOOK_SECRET_TEST,
        process.env.MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION,
        process.env.MERCADOPAGO_WEBHOOK_SECRET,
      ])
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (secrets.length === 0) return { ok: false, reason: 'NOT_CONFIGURED' };

  const { ts, v1 } = parseXSignature(headerValue(input.headers, 'x-signature'));
  if (!ts || !v1) return { ok: false, reason: 'MISSING_SIGNATURE' };

  const timestamp = Number(ts);
  if (Number.isFinite(timestamp)) {
    // O MP envia ts em milissegundos; alguns painéis antigos mandam em segundos.
    const asMs = ts.length <= 10 ? timestamp * 1000 : timestamp;
    const now = input.now ?? Date.now();
    if (Math.abs(now - asMs) > MAX_SKEW_MS) return { ok: false, reason: 'STALE' };
  }

  let dataId: string | null = null;
  try {
    const parsed = new URL(input.url, 'https://davimf.dev');
    dataId = parsed.searchParams.get('data.id') ?? parsed.searchParams.get('id');
  } catch {
    dataId = null;
  }

  const manifest = buildManifest({
    dataId,
    requestId: headerValue(input.headers, 'x-request-id'),
    ts,
  });

  const received = v1.toLowerCase();
  const matches = secrets.some((secret) => {
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');
    return safeEqualHex(expected, received);
  });
  if (!matches) return { ok: false, reason: 'MISMATCH' };

  return { ok: true, dataId, ts };
}
