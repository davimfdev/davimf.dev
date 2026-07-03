import type { Handler } from '@netlify/functions';
import { allowedOrigin } from './lib/cors';
import { AccessManagementError, getDashboardAccessView, updateDashboardAccess } from './lib/dashboard/access';
import { writeAudit } from './lib/dashboard/audit';
import { requireGuildAccess } from './lib/dashboard/guildAccess';

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'PATCH') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!allowedOrigin(event)) return json(403, { error: { code: 'BAD_ORIGIN', message: 'Origin not allowed.' } });

  let body: { guildId?: string; users?: unknown; roles?: unknown } = {};
  if (event.httpMethod === 'PATCH') {
    try {
      body = JSON.parse(event.body ?? '{}') as typeof body;
    } catch {
      return json(400, { error: { code: 'INVALID_JSON', message: 'Invalid JSON body.' } });
    }
  }

  const guildId = event.httpMethod === 'GET' ? event.queryStringParameters?.guildId : body.guildId;
  const access = await requireGuildAccess(event, guildId);
  if (!access.ok) return json(access.status, { error: { code: access.code, message: 'Guild access denied.' } });

  try {
    if (event.httpMethod === 'GET') return json(200, await getDashboardAccessView(access));
    if (!Array.isArray(body.users) || !Array.isArray(body.roles)) {
      throw new AccessManagementError(422, 'INVALID_ACCESS_MAP', 'users');
    }
    await updateDashboardAccess(access, {
      users: body.users.map(String),
      roles: body.roles.map(String),
    });
    return json(200, { ok: true });
  } catch (error) {
    if (error instanceof AccessManagementError) {
      await writeAudit({
        actorUserId: access.userId, accessLevel: access.accessLevel, targetGuildId: access.guildId,
        method: event.httpMethod, route: '/api/bot-config-access', operation: 'update-access',
        resourceType: 'dashboard_access', changeSummary: { code: error.code, field: error.field }, result: 'rejected',
      });
      return json(error.status, { error: { code: error.code, message: 'Access configuration rejected.', field: error.field } });
    }
    console.error('bot-config-access failed', error);
    return json(500, { error: { code: 'INTERNAL_ERROR', message: 'Internal error.' } });
  }
};
