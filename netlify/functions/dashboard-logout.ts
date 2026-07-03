import type { Handler } from '@netlify/functions';
import cookie from 'cookie';
import { DASHBOARD_COOKIE, revokeDashboardSession } from './lib/dashboard/session';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  await revokeDashboardSession(event);
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie.serialize(DASHBOARD_COOKIE, '', {
        httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: new Date(0),
      }),
    },
    body: JSON.stringify({ ok: true }),
  };
};
