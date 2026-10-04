import { z } from 'zod';
import { ApiError } from './http';

const MAX_CURSOR_LENGTH = 512;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const CursorSchema = z
  .object({
    v: z.literal(1),
    d: z.iso.date(),
    i: z.uuid(),
  })
  .strict();

const invalidCursor = () => new ApiError('CURSOR_INVALID', 'Cursor inválido.', 400);

export function encodeCursor(input: { date: string; id: string }): string {
  return Buffer.from(JSON.stringify({ v: 1, d: input.date, i: input.id }), 'utf8').toString(
    'base64url',
  );
}

/**
 * O cursor vem do cliente: é entrada hostil. Não é assinado porque só descreve
 * uma posição de ordenação, e toda query já filtra por user_id da sessão — um
 * cursor forjado no máximo pagina os dados do próprio usuário de outro ponto.
 */
export function decodeCursor(raw: string | null): { date: string; id: string } | null {
  if (!raw) return null;
  if (raw.length > MAX_CURSOR_LENGTH) throw invalidCursor();
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    // Base64 ou JSON ilegível é cursor inválido, não erro interno.
    throw invalidCursor();
  }
  const result = CursorSchema.safeParse(parsed);
  if (!result.success) throw invalidCursor();
  return { date: result.data.d, id: result.data.i };
}

/** Padrão 50. Acima de 200 é recusado, nunca cortado em silêncio. */
export function parseLimit(raw: string | null): number {
  if (raw === null) return DEFAULT_LIMIT;
  const result = z.coerce.number().int().min(1).max(MAX_LIMIT).safeParse(raw);
  if (!result.success) {
    throw new ApiError('VALIDATION_FAILED', `limit precisa estar entre 1 e ${MAX_LIMIT}.`, 400);
  }
  return result.data;
}
