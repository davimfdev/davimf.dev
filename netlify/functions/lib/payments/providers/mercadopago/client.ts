/**
 * Cliente HTTP do Mercado Pago.
 *
 * Fala direto com a API REST oficial (mesma superfície que o SDK Node cobre),
 * o que evita divergência de dependência entre package.json da raiz (testes) e
 * de server/ (runtime do container) — os handlers em netlify/functions/ são
 * compilados nos dois.
 *
 * Endpoints usados (Checkout Transparente via Orders API + Assinaturas):
 *   POST /v1/orders                    cria Pix / cartão / boleto
 *   GET  /v1/orders/{id}               consulta estado real
 *   POST /v1/orders/{id}/refund        reembolso total/parcial
 *   POST /preapproval                  assinatura sem plano associado
 *   GET/PUT /preapproval/{id}          consulta/cancelamento
 *   POST /v1/customers/{id}/cards      salva meio de pagamento (token do front)
 */

import { ProviderError, ProviderTimeoutError } from '../../domain/errors';

export const MP_API_BASE = 'https://api.mercadopago.com';

const DEFAULT_TIMEOUT_MS = Number(process.env.MERCADOPAGO_TIMEOUT_MS ?? 12_000);

export type MpFetch = typeof fetch;

export type MpRequest = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  idempotencyKey?: string;
  timeoutMs?: number;
};

export type MpClientOptions = {
  accessToken?: string;
  fetchImpl?: MpFetch;
  baseUrl?: string;
  timeoutMs?: number;
};

export type MpJson = Record<string, unknown>;

function accessToken(explicit?: string): string {
  const token = explicit ?? process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new ProviderError('Pagamentos indisponíveis no momento.', {
      code: 'PROVIDER_NOT_CONFIGURED',
      status: 503,
      detail: 'MERCADOPAGO_ACCESS_TOKEN ausente',
    });
  }
  return token;
}

/** Mensagem do MP só vai para log/auditoria; o cliente recebe texto genérico. */
function describeError(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return String(payload ?? '');
  const record = payload as MpJson;
  const cause = record.cause;
  if (Array.isArray(cause) && cause.length > 0) {
    return cause
      .map((entry) => {
        const item = entry as MpJson;
        return `${String(item.code ?? '')}:${String(item.description ?? item.message ?? '')}`;
      })
      .join('; ');
  }
  return String(record.message ?? record.error ?? JSON.stringify(record).slice(0, 400));
}

export class MercadoPagoClient {
  private readonly fetchImpl: MpFetch;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly token?: string;

  constructor(options: MpClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? MP_API_BASE;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.token = options.accessToken;
  }

  async request<T extends MpJson = MpJson>(input: MpRequest): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken(this.token)}`,
      Accept: 'application/json',
    };
    if (input.body !== undefined) headers['Content-Type'] = 'application/json';
    // Idempotência nativa do Mercado Pago: retry/duplo clique com a mesma chave
    // devolve a MESMA cobrança em vez de criar outra.
    if (input.idempotencyKey) headers['X-Idempotency-Key'] = input.idempotencyKey;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${input.path}`, {
        method: input.method,
        headers,
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
        signal: controller.signal,
      });
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (name === 'AbortError' || name === 'TimeoutError') throw new ProviderTimeoutError();
      throw new ProviderError('Não foi possível falar com o provedor de pagamento.', {
        code: 'PROVIDER_UNREACHABLE',
        retryable: true,
        detail: (error as Error)?.message,
      });
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text.slice(0, 1000) };
      }
    }

    if (!response.ok) {
      // 4xx é decisão do provider (não retentável); 5xx/429 vale retry.
      const retryable = response.status >= 500 || response.status === 429;
      throw new ProviderError('O provedor de pagamento recusou a operação.', {
        code: retryable ? 'PROVIDER_UNAVAILABLE' : 'PROVIDER_REJECTED',
        status: retryable ? 502 : 422,
        retryable,
        detail: `HTTP ${response.status} ${describeError(payload)}`,
      });
    }

    return (payload ?? {}) as T;
  }
}

/** Lê valores aninhados sem `any` espalhado pelo provider. */
export function pick(source: unknown, ...path: string[]): unknown {
  let current: unknown = source;
  for (const segment of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function pickString(source: unknown, ...path: string[]): string | null {
  const value = pick(source, ...path);
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function pickNumber(source: unknown, ...path: string[]): number | null {
  const value = pick(source, ...path);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}
