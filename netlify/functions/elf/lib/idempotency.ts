import { createHash } from 'node:crypto';
import type { ElfSql } from './db';
import { ApiError } from './http';

/** Serialização com ordenação estável de chaves, recursiva. Arrays mantêm a ordem. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(',')}}`;
}

/**
 * Hash do corpo já validado e normalizado. Hash do corpo HTTP cru não serve:
 * as mesmas chaves em outra ordem são o mesmo pedido, e fariam um retry
 * legítimo virar IDEMPOTENCY_MISMATCH. Nunca inclua valor gerado pelo servidor.
 */
export function requestHash(body: unknown): string {
  return createHash('sha256').update(stableStringify(body), 'utf8').digest('hex');
}

type Input = { userId: string; endpoint: string; key: string; hash: string };

const LOCK_NOT_AVAILABLE = '55P03';

/**
 * Serializa as requisições que compartilham a chave e devolve a resposta já
 * gravada, se houver. Precisa rodar dentro de `withTransaction`: o advisory
 * lock é liberado no COMMIT ou no ROLLBACK daquela transação.
 */
export async function acquireIdempotency(
  tx: ElfSql,
  input: Input,
): Promise<{ replay: { status: number; body: unknown } | null }> {
  // Desiste em 5 s em vez de segurar a conexão do pool indefinidamente.
  await tx`SET LOCAL lock_timeout = '5s'`;

  try {
    await tx`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${input.userId}::text || ':' || ${input.endpoint}::text || ':' || ${input.key}::text, 0)
      )`;
  } catch (error) {
    if ((error as { code?: unknown }).code === LOCK_NOT_AVAILABLE) {
      throw new ApiError('IDEMPOTENCY_IN_PROGRESS', 'Operação já em andamento.', 409, {
        retryAfterSeconds: 2,
      });
    }
    throw error;
  }

  const [row] = await tx<{ request_hash: string; response_status: number; response_body: unknown }>`
    SELECT request_hash, response_status, response_body
      FROM idempotency_keys
     WHERE user_id = ${input.userId} AND endpoint = ${input.endpoint} AND key = ${input.key}`;

  if (!row) return { replay: null };

  if (row.request_hash !== input.hash) {
    throw new ApiError(
      'IDEMPOTENCY_MISMATCH',
      'Chave de idempotência já usada com outro conteúdo.',
      409,
    );
  }
  return { replay: { status: row.response_status, body: row.response_body } };
}

/** Gravado na mesma transação da escrita: ou os dois existem, ou nenhum. */
export async function recordIdempotency(
  tx: ElfSql,
  input: Input & { status: number; body: unknown },
): Promise<void> {
  await tx`
    INSERT INTO idempotency_keys
      (key, user_id, endpoint, request_hash, response_status, response_body)
    VALUES
      (${input.key}, ${input.userId}, ${input.endpoint}, ${input.hash}, ${input.status},
       ${input.body}::jsonb)`;
}
