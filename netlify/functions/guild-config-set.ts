import { Handler } from '@netlify/functions';
import { requireGuildAccess } from './lib/requireGuildAccess';
import { allowedOrigin } from './lib/cors';
import { patchMap, MAP_COLUMNS, MapColumn } from './lib/guildConfig';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!allowedOrigin(event as any)) return { statusCode: 403, body: JSON.stringify({ error: 'Bad origin' }) };

  const body = event.body ? JSON.parse(event.body) : {};
  const { guildId, column, patch } = body as { guildId?: string; column?: string; patch?: Record<string, unknown> };
  if (!MAP_COLUMNS.includes(column as MapColumn)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'coluna inválida' }) };
  }
  const access = await requireGuildAccess(event as any, guildId);
  if (!access.ok) return { statusCode: access.status, body: JSON.stringify({ error: access.error }) };

  await patchMap(guildId!, column as MapColumn, patch ?? {}, access.userId);
  return { statusCode: 200, body: JSON.stringify({ message: 'ok' }) };
};
