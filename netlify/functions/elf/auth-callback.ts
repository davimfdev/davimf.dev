import cookie from 'cookie';
import { withTransaction as defaultWithTransaction, type ElfTransaction } from './lib/db';
import { deviceCookie, resolveWebDevice as defaultResolveWebDevice } from './lib/device';
import { ApiError, errorResponse, shouldUseSecureCookies, withElf, type ElfContext } from './lib/http';
import { ELF_OAUTH_STATE_COOKIE, readOAuthState } from './lib/oauth-state';
import { seedSystemCategories } from './lib/seed';
import { createElfSession, sessionCookie } from './lib/session';

type Deps = {
  fetchImpl?: typeof fetch;
  withTransaction?: ElfTransaction;
  resolveWebDevice?: typeof defaultResolveWebDevice;
  createSession?: typeof createElfSession;
  seed?: typeof seedSystemCategories;
};

type DiscordIdentity = { id: string; displayName: string | null; avatarUrl: string | null };

function clearedStateCookie(secure: boolean): string {
  return cookie.serialize(ELF_OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api/elf/auth/callback',
    expires: new Date(0),
  });
}

const exchangeFailed = () => new ApiError('OAUTH_EXCHANGE_FAILED', 'Login falhou.', 400);

/**
 * Troca o code por token e lê a identidade. O token do Discord só vive nesta
 * função: a sessão do $elfControl tem ciclo de vida próprio e não o guarda.
 */
async function fetchDiscordIdentity(
  code: string,
  config: { clientId: string; clientSecret: string; redirectUri: string },
  doFetch: typeof fetch,
): Promise<DiscordIdentity> {
  const tokenResponse = await doFetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    }),
  });
  if (!tokenResponse.ok) throw exchangeFailed();
  const granted = (await tokenResponse.json()) as { access_token?: unknown };
  if (typeof granted.access_token !== 'string' || !granted.access_token) throw exchangeFailed();

  const userResponse = await doFetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${granted.access_token}` },
  });
  if (!userResponse.ok) throw exchangeFailed();
  const user = (await userResponse.json()) as {
    id?: unknown;
    global_name?: unknown;
    username?: unknown;
    avatar?: unknown;
  };
  if (typeof user.id !== 'string' || !/^\d{15,25}$/.test(user.id)) throw exchangeFailed();

  const displayName =
    typeof user.global_name === 'string'
      ? user.global_name
      : typeof user.username === 'string'
        ? user.username
        : null;
  const avatarUrl =
    typeof user.avatar === 'string' && /^[a-z0-9_]+$/i.test(user.avatar)
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      : null;
  return { id: user.id, displayName, avatarUrl };
}

/** GET /api/elf/auth/callback — fecha o login web e cria usuário, dispositivo e sessão. */
export async function handleAuthCallback(
  req: Request,
  ctx: ElfContext,
  deps: Deps = {},
): Promise<Response> {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.ELF_DISCORD_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    console.error('[elf] OAuth sem configuração no callback', { requestId: ctx.requestId });
    return errorResponse(new ApiError('OAUTH_NOT_CONFIGURED', 'Login indisponível.', 500), req);
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const cookieState = cookie.parse(req.headers.get('cookie') ?? '')[ELF_OAUTH_STATE_COOKIE] ?? null;
  const state = readOAuthState(url.searchParams.get('state'), cookieState);
  if (!code || !state) {
    return errorResponse(new ApiError('OAUTH_STATE_INVALID', 'Login inválido.', 400), req);
  }

  const identity = await fetchDiscordIdentity(
    code,
    { clientId, clientSecret, redirectUri },
    deps.fetchImpl ?? fetch,
  );

  const runTransaction = deps.withTransaction ?? defaultWithTransaction;
  const resolveDevice = deps.resolveWebDevice ?? defaultResolveWebDevice;
  const makeSession = deps.createSession ?? createElfSession;
  const runSeed = deps.seed ?? seedSystemCategories;

  // Usuário, dispositivo, categorias e sessão gravam juntos ou nada é gravado.
  const result = await runTransaction(async (tx) => {
    const [user] = await tx<{ id: string }>`
      INSERT INTO users (discord_user_id, display_name, avatar_url)
      VALUES (${identity.id}, ${identity.displayName}, ${identity.avatarUrl})
      ON CONFLICT (discord_user_id)
      DO UPDATE SET display_name = EXCLUDED.display_name,
                    avatar_url   = EXCLUDED.avatar_url,
                    updated_at   = NOW()
      RETURNING id`;
    if (!user) throw new Error('upsert em users não devolveu id');

    const device = await resolveDevice(
      {
        userId: user.id,
        cookieHeader: req.headers.get('cookie'),
        userAgent: req.headers.get('user-agent'),
      },
      { sql: tx },
    );

    // Sempre, sem perguntar se é o primeiro login: o seed é idempotente por constraint.
    await runSeed(tx, { userId: user.id, deviceId: device.deviceId, requestId: ctx.requestId });

    const sessionToken = await makeSession(
      { userId: user.id, deviceId: device.deviceId, platform: 'web' },
      { sql: tx },
    );
    return { deviceId: device.deviceId, sessionToken };
  });

  const secure = shouldUseSecureCookies(req);
  // Nada de credencial na URL: o destino é só o caminho relativo guardado no state.
  const headers = new Headers({ Location: state.returnTo });
  headers.append('Set-Cookie', clearedStateCookie(secure));
  headers.append('Set-Cookie', sessionCookie(result.sessionToken, secure));
  headers.append('Set-Cookie', deviceCookie(result.deviceId, secure));
  return new Response(null, { status: 302, headers });
}

export default withElf((req, ctx) => handleAuthCallback(req, ctx));
