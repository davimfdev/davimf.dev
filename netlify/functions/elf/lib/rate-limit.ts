import { sql, type ElfSql } from './db';
import { ApiError } from './http';

export const RATE_LIMITS = {
  deviceStart: { limit: 5, windowSeconds: 600 },
  deviceApprove: { limit: 10, windowSeconds: 600 },
  devicePoll: { limit: 1, windowSeconds: 2 },
  authStart: { limit: 20, windowSeconds: 600 },
  write: { limit: 120, windowSeconds: 60 },
  read: { limit: 600, windowSeconds: 60 },
} as const;

const CLEANUP_PROBABILITY = 0.01;

/**
 * IP do cliente como o Nginx Proxy Manager viu. O NPM SOBRESCREVE `X-Real-IP`
 * com `$remote_addr`, então o valor que o cliente mandar nesse header se perde.
 * `X-Forwarded-For` nunca é lido: é livremente forjável, e usá-lo como chave
 * permitiria escolher o bucket alheio ou escapar do próprio.
 *
 * Isso só vale enquanto a API não for alcançável sem passar pelo NPM.
 */
export function clientIp(req: Request): string {
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

type Deps = { sql?: ElfSql; random?: () => number };

export type RateLimitInput = {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
};

/** Conta a requisição na janela atual e lança RATE_LIMITED (429, com Retry-After) acima do limite. */
export async function enforceRateLimit(input: RateLimitInput, deps: Deps = {}): Promise<void> {
  const query = deps.sql ?? sql;
  const random = deps.random ?? Math.random;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(nowSeconds / input.windowSeconds) * input.windowSeconds;
  const bucket = `${input.scope}:${input.identifier}:${windowStart}`;

  // Incremento em um statement só: SELECT-depois-UPDATE perderia contagem sob concorrência.
  const rows = await query<{ hits: number }>`
    INSERT INTO rate_limits (bucket, hits, window_start)
    VALUES (${bucket}, 1, TO_TIMESTAMP(${windowStart}))
    ON CONFLICT (bucket) DO UPDATE SET hits = rate_limits.hits + 1
    RETURNING hits`;

  // Limpeza sem agendador e sem estado. A correção do limite não depende disto rodar.
  if (random() < CLEANUP_PROBABILITY) {
    await query`DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '24 hours'`;
  }

  const hits = rows[0]?.hits;
  if (hits === undefined) throw new Error('rate_limits não devolveu a contagem');
  if (hits > input.limit) {
    const retryAfterSeconds = Math.max(1, windowStart + input.windowSeconds - nowSeconds);
    throw new ApiError('RATE_LIMITED', 'Muitas requisições.', 429, { retryAfterSeconds });
  }
}

const MUTATING = new Set(['POST', 'PATCH', 'DELETE']);

/** Limite geral por usuário, aplicado nas rotas autenticadas. */
export async function enforceRouteRateLimit(
  req: Request,
  userId: string,
  deps: Deps = {},
): Promise<void> {
  const isWrite = MUTATING.has(req.method);
  await enforceRateLimit(
    {
      scope: isWrite ? 'write' : 'read',
      identifier: userId,
      ...(isWrite ? RATE_LIMITS.write : RATE_LIMITS.read),
    },
    deps,
  );
}
