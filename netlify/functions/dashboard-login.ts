import type { Handler } from '@netlify/functions';
import cookie from 'cookie';
import { createOAuthState } from './lib/dashboard/oauthState';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return { statusCode: 500, body: JSON.stringify({ error: { code: 'OAUTH_NOT_CONFIGURED', message: 'Discord OAuth is not configured.' } }) };
  }
  const state = createOAuthState(event.queryStringParameters?.returnTo ?? '/dashboard');
  const authorize = new URL('https://discord.com/api/oauth2/authorize');
  authorize.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify guilds guilds.members.read',
    state,
  }).toString();
  const isLocal = (event.headers.host ?? '').includes('localhost');
  return {
    statusCode: 302,
    headers: {
      Location: authorize.toString(),
      'Set-Cookie': cookie.serialize('bot_dashboard_oauth_state', state, {
        httpOnly: true,
        secure: !isLocal,
        sameSite: 'lax',
        path: '/api/callback',
        maxAge: 600,
      }),
    },
    body: '',
  };
};
