import type { Handler } from '@netlify/functions';
import { allowedOrigin } from './lib/cors';
import { writeAudit } from './lib/dashboard/audit';
import { DashboardConfigError, patchGuildConfig, type ConfigPatch } from './lib/dashboard/guildConfig';
import { requireGuildAccess } from './lib/dashboard/guildAccess';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'PATCH') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!allowedOrigin(event)) return { statusCode: 403, body: JSON.stringify({ error: { code: 'BAD_ORIGIN', message: 'Origin not allowed.' } }) };
  let body: { guildId?: string; column?: string; set?: Record<string, unknown>; remove?: string[] };
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body.' } }) };
  }
  const access = await requireGuildAccess(event, body.guildId);
  if (!access.ok) return { statusCode: access.status, body: JSON.stringify({ error: { code: access.code, message: 'Guild access denied.' } }) };
  try {
    await patchGuildConfig(access, {
      column: body.column as ConfigPatch['column'],
      set: body.set ?? {},
      remove: Array.isArray(body.remove) ? body.remove.map(String) : [],
    });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    if (error instanceof DashboardConfigError) {
      await writeAudit({
        actorUserId: access.userId, accessLevel: access.accessLevel, targetGuildId: access.guildId,
        method: 'PATCH', route: '/api/bot-config-patch', operation: 'patch', resourceType: 'guild_config',
        changeSummary: { column: body.column, rejectedField: error.field, code: error.code }, result: 'rejected',
      });
      return { statusCode: error.status, body: JSON.stringify({ error: { code: error.code, message: 'Configuration rejected.', field: error.field } }) };
    }
    console.error('bot-config-patch failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Internal error.' } }) };
  }
};
