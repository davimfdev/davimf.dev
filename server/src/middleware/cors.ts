import type { NextFunction, Request as ExpressRequest, Response as ExpressResponse } from 'express';

/**
 * CORS opcional e desligado por padrão.
 *
 * Em produção o frontend e a API vivem no mesmo domínio (https://davimf.dev e
 * https://davimf.dev/api/*), então não há requisição cross-origin nenhuma. Em
 * desenvolvimento o Vite faz proxy de /api para o backend, o que também mantém
 * tudo same-origin. Só defina CORS_ALLOWED_ORIGINS se algum consumidor externo
 * (ex.: uma build local apontando direto para a VPS) precisar disso.
 */
export function allowedOriginsFromEnv(): string[] {
  return (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function corsMiddleware(allowed: string[]) {
  const enabled = allowed.length > 0;

  return (req: ExpressRequest, res: ExpressResponse, next: NextFunction): void => {
    if (!enabled) {
      next();
      return;
    }

    const origin = req.headers.origin;
    if (origin && allowed.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        req.headers['access-control-request-headers'] ?? 'Content-Type, Authorization, X-Admin-Secret, X-Ticket-Secret',
      );
      res.setHeader('Access-Control-Max-Age', '600');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}
