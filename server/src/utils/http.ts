import type { Request as ExpressRequest } from 'express';

/**
 * Cabeçalhos que pertencem ao salto HTTP atual (proxy -> backend) e não devem
 * ser repassados adiante para dentro dos handlers. `host` sai porque a URL
 * absoluta já carrega o host; `content-length` sai porque quem monta o corpo
 * novamente é o adaptador.
 */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'expect',
  'content-length',
  'host',
]);

/**
 * URL absoluta da requisição como o cliente a viu.
 *
 * Atrás do Nginx Proxy Manager o backend recebe http://davimf-api:3000, mas os
 * handlers precisam enxergar https://davimf.dev/... - daí `trust proxy` no app
 * (que faz `req.protocol` ler o X-Forwarded-Proto) somado ao Host repassado.
 */
export function absoluteUrl(req: ExpressRequest): string {
  const host = req.get('host') ?? process.env.PUBLIC_SITE_HOST ?? 'davimf.dev';
  return `${req.protocol}://${host}${req.originalUrl}`;
}

/** Cabeçalhos do Express (string | string[]) achatados no formato Netlify. */
export function flattenHeaders(req: ExpressRequest): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    out[key] = Array.isArray(value) ? value.join(', ') : value;
  }
  return out;
}

export function multiValueHeaders(req: ExpressRequest): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    out[key] = Array.isArray(value) ? value : [value];
  }
  return out;
}

/** Monta um `Headers` da Web API a partir da requisição Express. */
export function toWebHeaders(req: ExpressRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || HOP_BY_HOP.has(key.toLowerCase())) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

/**
 * O middleware de corpo cru sempre entrega um Buffer. Métodos sem corpo e
 * corpos vazios viram `null`, que é exatamente o que a Netlify entregava em
 * `event.body` - os handlers já tratam esse caso (`event.body ?? '{}'`).
 */
export function rawBodyOf(req: ExpressRequest): Buffer {
  const body: unknown = req.body;
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return Buffer.from(body, 'utf8');
  return Buffer.alloc(0);
}
