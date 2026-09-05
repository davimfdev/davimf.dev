/**
 * Validação da assinatura `x-signature` das notificações do Mercado Pago.
 *
 * Manifesto oficial: `id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];`
 * - `data.id` vem da QUERY STRING (nunca do corpo);
 * - a documentação manda usar o `data.id` em MINÚSCULAS quando ele é
 *   alfanumérico (`ORD01...` → `ord01...`); o simulador do painel, porém,
 *   assina preservando o case. As duas formas são testadas, e ambas continuam
 *   exigindo HMAC-SHA256 válido com um segredo configurado;
 * - partes ausentes são OMITIDAS do manifesto (inclusive o rótulo);
 * - HMAC-SHA256 hex comparado a `v1` em tempo constante.
 *
 * Diagnóstico: falhas devolvem `diagnostics` com dados NÃO sensíveis
 * (rótulos lógicos e fingerprints irreversíveis dos segredos, idade do `ts`,
 * origem do id, variantes testadas). Segredo, manifesto e assinatura nunca
 * saem daqui.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

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
  if (input.dataId) segments.push(`id:${input.dataId};`);
  if (input.requestId) segments.push(`request-id:${input.requestId};`);
  if (input.ts) segments.push(`ts:${input.ts};`);
  return segments.join('');
}

/**
 * Impressão digital curta e irreversível de um segredo, só para o operador
 * conferir NO LOG se teste e produção são valores distintos e se o valor mudou
 * depois de um deploy. 8 hex de um SHA-256 com separação de domínio: não
 * permite recuperar nem comparar contra o painel sem o segredo em mãos.
 */
export function secretFingerprint(secret: string): string {
  return createHash('sha256').update(`mp-webhook-secret:${secret}`).digest('hex').slice(0, 8);
}

type SecretSource = { label: string; value: string };

/**
 * Teste e produção podem apontar para a MESMA URL, mas o painel gera um
 * segredo independente por aplicação/modo. Validamos contra todos os
 * configurados sem jamais registrar qual deles conferiu. A variável legada
 * continua aceita para instalações de ambiente único.
 */
function configuredSecrets(explicit?: string): SecretSource[] {
  const candidates: SecretSource[] =
    explicit !== undefined
      ? [{ label: 'explicit', value: explicit }]
      : [
          { label: 'test', value: process.env.MERCADOPAGO_WEBHOOK_SECRET_TEST ?? '' },
          { label: 'production', value: process.env.MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION ?? '' },
          { label: 'legacy', value: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? '' },
        ];
  // O `trim` cobre o erro mais comum de painel de deploy: valor colado com
  // espaço ou quebra de linha no fim.
  return candidates
    .map((candidate) => ({ label: candidate.label, value: candidate.value.trim() }))
    .filter((candidate) => candidate.value.length > 0);
}

/**
 * Agrupa os segredos por VALOR: rótulos com o mesmo fingerprint viram
 * `test+production:ac346080`, deixando explícito no log que ali existe UMA
 * assinatura sob dois nomes. Isso é o esperado - o painel gera a assinatura
 * secreta vinculada à APLICAÇÃO, não ao modo, então teste e produção
 * legitimamente compartilham o mesmo valor. Fingerprints diferentes só
 * aparecem em conta com mais de uma aplicação configurada aqui.
 */
function describeSecrets(secrets: SecretSource[]): string[] {
  const byFingerprint = new Map<string, string[]>();
  for (const secret of secrets) {
    const print = secretFingerprint(secret.value);
    byFingerprint.set(print, [...(byFingerprint.get(print) ?? []), secret.label]);
  }
  return [...byFingerprint].map(([print, labels]) => `${labels.join('+')}:${print}`);
}

/** Tudo aqui é seguro de registrar: nenhum campo deriva do segredo ou da assinatura. */
export type SignatureDiagnostics = {
  /** Conjunto lógico tentado, como `test:1a2b3c4d` - rótulo + fingerprint. */
  secrets: string[];
  /** Idade da assinatura em segundos (negativa = relógio do servidor atrasado). */
  tsAgeSeconds: number | null;
  /** De onde saiu o id do manifesto. */
  idSource: 'query' | 'absent';
  /** Variantes canônicas testadas para o `data.id`. */
  variants: string[];
  /** Valores em `x-request-id`; >1 denuncia proxy duplicando o cabeçalho. */
  requestIdValues: number;
  /**
   * Entradas EXATAS do manifesto mais um prefixo curto de `v1`, para reproduzir
   * o HMAC fora do servidor quando todo o resto já foi descartado. Nenhuma
   * delas é segredo: `data.id` e `x-request-id` são identificadores de
   * requisição, `ts` é público no cabeçalho, e 8 hex de um HMAC-SHA256 não
   * permitem forjar assinatura. Ainda assim, quem decide registrar isto é o
   * chamador - ver `MERCADOPAGO_WEBHOOK_DEBUG`.
   */
  manifestInputs: {
    dataId: string | null;
    requestId: string | null;
    ts: string | null;
    v1Prefix: string | null;
  };
};

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

export type VerifyFailureReason = 'NOT_CONFIGURED' | 'MISSING_SIGNATURE' | 'STALE' | 'MISMATCH';

export type VerifyResult =
  | { ok: true; dataId: string | null; resourceId: string | null; ts: string | null }
  | { ok: false; reason: VerifyFailureReason; diagnostics: SignatureDiagnostics };

function headerValue(headers: Record<string, string | undefined>, name: string): string | null {
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (direct) return direct;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name.toLowerCase() && value) return value;
  }
  return null;
}

/** `Headers` junta cabeçalhos repetidos com vírgula; contamos os valores. */
function countHeaderValues(value: string | null): number {
  if (!value) return 0;
  return value.split(',').filter((part) => part.trim().length > 0).length;
}

function timestampToMs(ts: string): number | null {
  const parsed = Number(ts);
  if (!Number.isFinite(parsed)) return null;
  // O Mercado Pago envia `ts` em SEGUNDOS (ex.: 1704908010); aceitamos também
  // milissegundos para não depender do formato de um painel específico.
  return ts.trim().length <= 10 ? parsed * 1000 : parsed;
}

export function verifyWebhookSignature(input: VerifyInput): VerifyResult {
  const secrets = configuredSecrets(input.secret);
  const rawRequestId = headerValue(input.headers, 'x-request-id');

  let dataId: string | null = null;
  let legacyId: string | null = null;
  try {
    const parsed = new URL(input.url, 'https://davimf.dev');
    // Só `data.id` entra no manifesto - é o que a documentação define. O `id`
    // das notificações legadas serve apenas para localizar o recurso depois.
    dataId = parsed.searchParams.get('data.id');
    legacyId = parsed.searchParams.get('id');
  } catch {
    dataId = null;
  }

  const lowercased = dataId ? dataId.toLowerCase() : null;
  const diagnostics: SignatureDiagnostics = {
    secrets: describeSecrets(secrets),
    tsAgeSeconds: null,
    idSource: dataId ? 'query' : 'absent',
    variants: dataId ? (dataId === lowercased ? ['exact'] : ['exact', 'lowercase']) : ['none'],
    requestIdValues: countHeaderValues(rawRequestId),
    manifestInputs: { dataId, requestId: rawRequestId, ts: null, v1Prefix: null },
  };

  const { ts, v1 } = parseXSignature(headerValue(input.headers, 'x-signature'));
  diagnostics.manifestInputs.ts = ts;
  diagnostics.manifestInputs.v1Prefix = v1 ? v1.toLowerCase().slice(0, 8) : null;

  if (ts) {
    const asMs = timestampToMs(ts);
    if (asMs !== null) {
      diagnostics.tsAgeSeconds = Math.round(((input.now ?? Date.now()) - asMs) / 1000);
    }
  }

  if (secrets.length === 0) return { ok: false, reason: 'NOT_CONFIGURED', diagnostics };
  if (!ts || !v1) return { ok: false, reason: 'MISSING_SIGNATURE', diagnostics };

  if (diagnostics.tsAgeSeconds !== null && Math.abs(diagnostics.tsAgeSeconds * 1000) > MAX_SKEW_MS) {
    return { ok: false, reason: 'STALE', diagnostics };
  }

  const requestId = rawRequestId;
  // Ordem: primeiro o case exato (o que o simulador do painel assina), depois a
  // normalização minúscula documentada para IDs alfanuméricos de Order.
  const manifests = [buildManifest({ dataId, requestId, ts })];
  if (lowercased && lowercased !== dataId) {
    manifests.push(buildManifest({ dataId: lowercased, requestId, ts }));
  }

  const received = v1.toLowerCase();
  const matches = secrets.some((secret) =>
    manifests.some((manifest) => {
      const expected = createHmac('sha256', secret.value).update(manifest).digest('hex');
      return safeEqualHex(expected, received);
    }),
  );
  if (!matches) return { ok: false, reason: 'MISMATCH', diagnostics };

  return { ok: true, dataId, resourceId: dataId ?? legacyId, ts };
}
