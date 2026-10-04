import { z } from 'zod';
import { ApiError } from './http';

export const VersionSchema = z.number().int().min(1);

/**
 * Lê e valida o corpo antes de qualquer efeito colateral. Os schemas das rotas
 * são `.strict()`: campo desconhecido reprova, nunca é descartado em silêncio.
 */
export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    // JSON malformado é erro do cliente, não do servidor.
    throw new ApiError('VALIDATION_FAILED', 'Corpo inválido.', 400);
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ApiError('VALIDATION_FAILED', 'Dados inválidos.', 400, {
      fields: result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        code: issue.code,
      })),
    });
  }
  return result.data;
}

export function requireIdempotencyKey(req: Request): string {
  const key = req.headers.get('idempotency-key')?.trim();
  if (!key) {
    throw new ApiError('VALIDATION_FAILED', 'Header Idempotency-Key é obrigatório.', 400);
  }
  return key;
}

/** Identificador estável da rota: sem host, sem query, sem barra final variável. */
export function endpointKey(req: Request): string {
  const path = new URL(req.url).pathname.replace(/\/+$/, '');
  return `${req.method}:${path}`;
}

const UUID_SCHEMA = z.uuid();

/** Id de recurso vindo da URL. Malformado é tratado como inexistente: 404, não 500 do Postgres. */
export function isResourceId(value: string | undefined): value is string {
  return UUID_SCHEMA.safeParse(value).success;
}
