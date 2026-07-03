import { Handler } from '@netlify/functions';
import { requireGuildAccess } from './lib/requireGuildAccess';
import { getGuildConfigRow } from './lib/guildConfig';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  const guildId = event.queryStringParameters?.guildId;
  const access = await requireGuildAccess(event as any, guildId);
  if (!access.ok) return { statusCode: access.status, body: JSON.stringify({ error: access.error }) };
  const row = await getGuildConfigRow(guildId!);
  return { statusCode: 200, body: JSON.stringify({ data: row ?? {} }) };
};
