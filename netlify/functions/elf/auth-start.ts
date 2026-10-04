import cookie from 'cookie';
import { ApiError, errorResponse, shouldUseSecureCookies, withElf } from './lib/http';
import { ELF_OAUTH_STATE_COOKIE, createOAuthState } from './lib/oauth-state';
import { clientIp, enforceRateLimit as defaultEnforce, RATE_LIMITS } from './lib/rate-limit';

type Deps = { enforceRateLimit?: typeof defaultEnforce };

/** GET /api/elf/auth/start?returnTo=/caminho — redireciona para o Discord. */
export async function handleAuthStart(req: Request, deps: Deps = {}): Promise<Response> {
  await (deps.enforceRateLimit ?? defaultEnforce)({
    scope: 'auth_start',
    identifier: clientIp(req),
    ...RATE_LIMITS.authStart,
  });
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.ELF_DISCORD_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    console.error('[elf] OAuth sem configuração', {
      missing: !clientId ? 'DISCORD_CLIENT_ID' : 'ELF_DISCORD_REDIRECT_URI',
    });
    return errorResponse(new ApiError('OAUTH_NOT_CONFIGURED', 'Login indisponível.', 500), req);
  }

  const url = new URL(req.url);
  const state = createOAuthState(url.searchParams.get('returnTo') ?? '/');

  const authorize = new URL('https://discord.com/api/oauth2/authorize');
  authorize.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    // Só identify: a API precisa apenas do id, e escopo a mais é superfície a mais.
    scope: 'identify',
    state,
  }).toString();

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Set-Cookie': cookie.serialize(ELF_OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        secure: shouldUseSecureCookies(req),
        sameSite: 'lax',
        path: '/api/elf/auth/callback',
        maxAge: 600,
      }),
    },
  });
}

export default withElf((req) => handleAuthStart(req));
