import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { absoluteUrl, flattenHeaders, multiValueHeaders, rawBodyOf } from './http';

/**
 * Formato de evento das Netlify Functions "clássicas" (`export const handler`).
 * Reproduzido estruturalmente para que os handlers existentes rodem sem
 * qualquer alteração no código-fonte deles.
 */
export type NetlifyEvent = {
  rawUrl: string;
  rawQuery: string;
  path: string;
  httpMethod: string;
  headers: Record<string, string | undefined>;
  multiValueHeaders: Record<string, string[]>;
  queryStringParameters: Record<string, string> | null;
  multiValueQueryStringParameters: Record<string, string[]> | null;
  body: string | null;
  isBase64Encoded: boolean;
};

export type NetlifyHandlerResponse = {
  statusCode: number;
  headers?: Record<string, string | number | boolean | undefined>;
  multiValueHeaders?: Record<string, Array<string | number | boolean>>;
  body?: string;
  isBase64Encoded?: boolean;
};

export type NetlifyHandler = (
  event: never,
  context: never,
) => Promise<NetlifyHandlerResponse | void | undefined> | NetlifyHandlerResponse | void | undefined;

/** Contexto mínimo: nenhum handler do projeto lê campos dele. */
function stubContext(): Record<string, unknown> {
  return {
    functionName: 'davimf-api',
    functionVersion: '1',
    awsRequestId: '',
    clientContext: undefined,
    identity: undefined,
    callbackWaitsForEmptyEventLoop: false,
    getRemainingTimeInMillis: () => 30_000,
    done: () => undefined,
    fail: () => undefined,
    succeed: () => undefined,
  };
}

export function buildNetlifyEvent(req: ExpressRequest): NetlifyEvent {
  const rawUrl = absoluteUrl(req);
  const url = new URL(rawUrl);
  const raw = rawBodyOf(req);

  const single: Record<string, string> = {};
  const multi: Record<string, string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    single[key] = values[values.length - 1];
    multi[key] = values;
  }

  return {
    rawUrl,
    rawQuery: url.search.startsWith('?') ? url.search.slice(1) : url.search,
    path: url.pathname,
    httpMethod: req.method,
    headers: flattenHeaders(req),
    multiValueHeaders: multiValueHeaders(req),
    queryStringParameters: single,
    multiValueQueryStringParameters: multi,
    body: raw.length > 0 ? raw.toString('utf8') : null,
    isBase64Encoded: false,
  };
}

export function applyNetlifyResponse(res: ExpressResponse, result: NetlifyHandlerResponse | void | undefined): void {
  if (!result) {
    res.status(204).end();
    return;
  }

  res.status(result.statusCode ?? 200);

  for (const [key, value] of Object.entries(result.headers ?? {})) {
    if (value === undefined) continue;
    // Set-Cookie precisa de append para não sobrescrever um cookie já enfileirado.
    if (key.toLowerCase() === 'set-cookie') res.append(key, String(value));
    else res.setHeader(key, String(value));
  }

  for (const [key, values] of Object.entries(result.multiValueHeaders ?? {})) {
    for (const value of values) res.append(key, String(value));
  }

  if (result.body === undefined || result.body === null) {
    res.end();
    return;
  }

  res.end(result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body);
}

/** Executa um handler no estilo `export const handler` sobre req/res do Express. */
export async function runNetlifyHandler(
  handler: NetlifyHandler,
  req: ExpressRequest,
  res: ExpressResponse,
): Promise<void> {
  const event = buildNetlifyEvent(req);
  const result = await handler(event as never, stubContext() as never);
  applyNetlifyResponse(res, result);
}
