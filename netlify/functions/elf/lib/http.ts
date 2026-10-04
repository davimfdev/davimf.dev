import { randomUUID } from 'node:crypto';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ElfContext = { requestId: string };

function allowedOrigins(): string[] {
  return (process.env.ELF_APP_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return allowedOrigins().includes(origin);
}

/** Cookie `Secure` em todo lugar menos no dev local, onde não há TLS. */
export function shouldUseSecureCookies(req: Request): boolean {
  return new URL(req.url).hostname !== 'localhost';
}

const requestIds = new WeakMap<Request, string>();

function requestIdOf(req: Request): string {
  let id = requestIds.get(req);
  if (!id) {
    id = randomUUID();
    requestIds.set(req, id);
  }
  return id;
}

function baseHeaders(req: Request): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Request-Id': requestIdOf(req),
    Vary: 'Origin',
  });
  const origin = req.headers.get('origin');
  if (origin && isAllowedOrigin(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
  }
  return headers;
}

export function jsonResponse(
  body: unknown,
  status: number,
  req: Request,
  extraHeaders: Record<string, string> = {},
): Response {
  const headers = baseHeaders(req);
  for (const [key, value] of Object.entries(extraHeaders)) headers.append(key, value);
  return new Response(JSON.stringify(body), { status, headers });
}

export function errorResponse(error: ApiError, req: Request): Response {
  const retryAfter = error.extra?.retryAfterSeconds;
  const extraHeaders: Record<string, string> =
    typeof retryAfter === 'number' ? { 'Retry-After': String(retryAfter) } : {};
  return jsonResponse(
    { error: { code: error.code, message: error.message, ...(error.extra ?? {}) } },
    error.status,
    req,
    extraHeaders,
  );
}

const MUTATING = new Set(['POST', 'PATCH', 'DELETE']);

/**
 * Defesa contra CSRF: requisição mutante autenticada por cookie precisa vir de
 * origem conhecida. Bearer não precisa — o navegador não anexa o header sozinho.
 */
export function requireAllowedOrigin(req: Request, isCookieAuth: boolean): void {
  if (!isCookieAuth || !MUTATING.has(req.method)) return;
  if (!isAllowedOrigin(req.headers.get('origin'))) {
    throw new ApiError('ORIGIN_NOT_ALLOWED', 'Origem não permitida.', 403);
  }
}

/** Envelope comum de toda rota do $elfControl: preflight, request id e erro padronizado. */
export function withElf(
  handler: (req: Request, ctx: ElfContext) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const requestId = requestIdOf(req);
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: baseHeaders(req) });
    }
    try {
      return await handler(req, { requestId });
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(error, req);
      console.error('[elf] erro inesperado', {
        requestId,
        route: new URL(req.url).pathname,
        message: error instanceof Error ? error.message : 'desconhecido',
      });
      return errorResponse(new ApiError('INTERNAL_ERROR', 'Erro interno.', 500), req);
    }
  };
}
