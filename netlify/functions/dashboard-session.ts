import type { Handler } from '@netlify/functions';
import { requireDashboardSession } from './lib/dashboard/session';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  const result = await requireDashboardSession(event);
  if (!result.ok) {
    return { statusCode: 401, body: JSON.stringify({ error: { code: result.code, message: 'Dashboard session is invalid.' } }) };
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: result.session.userId, scopes: result.session.scopes }),
  };
};
