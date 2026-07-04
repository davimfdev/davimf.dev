import type { Config, Context } from '@netlify/functions';
import cookie from 'cookie';
import { createDashboardSession, DASHBOARD_COOKIE, type SessionInput } from './lib/dashboard/session';
import { validateOAuthState } from './lib/dashboard/oauthState';

type CallbackDeps = {
  fetchImpl?: typeof fetch;
  createSession?: (input: SessionInput) => Promise<string>;
};

type DiscordTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

function clearStateCookie(secure: boolean): string {
  return cookie.serialize('bot_dashboard_oauth_state', '', {
    httpOnly: true, secure, sameSite: 'lax', path: '/api/callback', expires: new Date(0),
  });
}

export async function handleCallback(req: Request, deps: CallbackDeps = {}): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const queryState = url.searchParams.get('state');
  const stateCookie = cookie.parse(req.headers.get('cookie') ?? '').bot_dashboard_oauth_state ?? null;
  const state = validateOAuthState(queryState, stateCookie);
  if (!code || !state) return new Response('Invalid OAuth callback', { status: 400 });

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return new Response('OAuth not configured', { status: 500 });

  const doFetch = deps.fetchImpl ?? fetch;
  const tokenResponse = await doFetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenResponse.ok) return new Response('Discord token exchange failed', { status: 400 });
  const tokens = await tokenResponse.json() as DiscordTokens;
  if (!tokens.access_token || !Number.isFinite(tokens.expires_in)) return new Response('Invalid Discord token response', { status: 502 });

  const userResponse = await doFetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userResponse.ok) return new Response('Discord identity fetch failed', { status: 502 });
  const user = await userResponse.json() as { id?: string };
  if (!user.id) return new Response('Discord identity missing', { status: 502 });

  const createSession = deps.createSession ?? createDashboardSession;
  const sessionValue = await createSession({
    userId: user.id,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    scopes: (tokens.scope ?? '').split(/\s+/).filter(Boolean),
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  });
  const isLocal = new URL(redirectUri).hostname === 'localhost';
  // O dashboard usa exclusivamente a sessão-cookie segura. As demais páginas do site
  // (todo, finanças, notas, encurtador, chaves FMM, navbar) ainda autenticam via o
  // access token do Discord no localStorage, então o entregamos na URL de retorno.
  const dest = new URL(state.returnTo, url.origin);
  if (!state.returnTo.startsWith('/dashboard')) {
    dest.searchParams.set('token', tokens.access_token);
  }
  const headers = new Headers({ Location: dest.pathname + dest.search });
  headers.append('Set-Cookie', clearStateCookie(!isLocal));
  headers.append('Set-Cookie', cookie.serialize(DASHBOARD_COOKIE, sessionValue, {
    httpOnly: true,
    secure: !isLocal,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  }));
  return new Response(null, { status: 302, headers });
}

export default async (req: Request, _context: Context) => handleCallback(req);

export const config: Config = { path: '/api/callback' };
