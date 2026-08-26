import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { absoluteUrl, rawBodyOf, toWebHeaders } from './http';

/**
 * Netlify Functions no formato Web API (`export default (req: Request) => Response`).
 * Nenhum handler do projeto lê o `Context`, então ele é um stub.
 */
export type WebHandler = (req: Request, context: never) => Promise<Response> | Response;

const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD']);

/** Cabeçalhos que o Express recalcula ao escrever a resposta. */
const RECOMPUTED_RESPONSE_HEADERS = new Set(['content-length', 'content-encoding', 'transfer-encoding']);

function stubContext(): Record<string, unknown> {
  return {
    requestId: '',
    site: {},
    account: {},
    geo: {},
    cookies: { get: () => undefined, set: () => undefined, delete: () => undefined },
    json: (input: unknown) => Response.json(input),
    log: console.log.bind(console),
    next: async () => new Response(null, { status: 404 }),
    params: {},
  };
}

export function buildWebRequest(req: ExpressRequest): Request {
  const raw = rawBodyOf(req);
  const hasBody = !METHODS_WITHOUT_BODY.has(req.method.toUpperCase()) && raw.length > 0;
  return new Request(absoluteUrl(req), {
    method: req.method,
    headers: toWebHeaders(req),
    // undici aceita Buffer diretamente; o cast só reconcilia o BodyInit da lib
    // DOM com o Buffer genérico do @types/node.
    body: hasBody ? (raw as unknown as BodyInit) : undefined,
  });
}

export async function applyWebResponse(res: ExpressResponse, response: Response): Promise<void> {
  res.status(response.status);

  // getSetCookie preserva múltiplos Set-Cookie, que um forEach simples achataria
  // numa única string separada por vírgula (e quebraria os cookies do dashboard).
  const setCookies =
    typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];

  response.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'set-cookie' || RECOMPUTED_RESPONSE_HEADERS.has(lower)) return;
    res.setHeader(key, value);
  });

  for (const cookie of setCookies) res.append('Set-Cookie', cookie);

  if (response.body === null) {
    res.end();
    return;
  }

  res.end(Buffer.from(await response.arrayBuffer()));
}

/** Executa um handler no estilo Web API sobre req/res do Express. */
export async function runWebHandler(
  handler: WebHandler,
  req: ExpressRequest,
  res: ExpressResponse,
): Promise<void> {
  const response = await handler(buildWebRequest(req), stubContext() as never);
  await applyWebResponse(res, response);
}
