import { randomBytes } from 'node:crypto';
import cookie from 'cookie';
import type { DashboardSql } from '../botDb';
import { siteSql } from './siteDb';
import {
  decryptToken,
  encryptToken,
  hashSessionId,
  signSessionId,
  verifySessionCookie,
} from './crypto';

export const DASHBOARD_COOKIE = 'bot_dashboard_session';

export type SessionInput = {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  expiresAt: Date;
};

export type DashboardSession = {
  userId: string;
  /** Primeiro login autenticado registrado para este usuário no site. */
  registeredAt?: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  expiresAt: Date;
};

export type DashboardSessionResult =
  | { ok: true; session: DashboardSession }
  | { ok: false; status: 401; code: 'SESSION_INVALID' | 'SESSION_EXPIRED' };

type SessionEvent = { headers: Record<string, string | undefined> };
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type Deps = { sql?: DashboardSql; randomId?: () => string; fetchImpl?: FetchLike };

function cookieValue(event: SessionEvent): string | null {
  const raw = event.headers.cookie ?? event.headers.Cookie ?? '';
  return cookie.parse(raw)[DASHBOARD_COOKIE] ?? null;
}

export async function createDashboardSession(input: SessionInput, deps: Deps = {}): Promise<string> {
  const sql = deps.sql ?? siteSql;
  const id = deps.randomId?.() ?? randomBytes(32).toString('base64url');
  const idHash = hashSessionId(id);
  const access = encryptToken(input.accessToken);
  const refresh = input.refreshToken ? encryptToken(input.refreshToken) : null;
  await sql`
    INSERT INTO dashboard_sessions (
      session_id_hash, discord_user_id, access_token_ciphertext,
      refresh_token_ciphertext, granted_scopes, token_expires_at
    ) VALUES (
      ${idHash}, ${input.userId}, ${access}, ${refresh},
      ${input.scopes}, ${input.expiresAt.toISOString()}
    )`;
  return signSessionId(id);
}

export async function requireDashboardSession(event: SessionEvent, deps: Deps = {}): Promise<DashboardSessionResult> {
  const signed = cookieValue(event);
  if (!signed) return { ok: false, status: 401, code: 'SESSION_INVALID' };
  const id = verifySessionCookie(signed);
  if (!id) return { ok: false, status: 401, code: 'SESSION_INVALID' };
  const sql = deps.sql ?? siteSql;
  const rows = await sql`
    SELECT current_session.session_id_hash, current_session.discord_user_id,
           current_session.access_token_ciphertext, current_session.refresh_token_ciphertext,
           current_session.granted_scopes, current_session.token_expires_at,
           current_session.revoked_at,
           (SELECT MIN(first_session.created_at)
              FROM dashboard_sessions first_session
             WHERE first_session.discord_user_id = current_session.discord_user_id) AS user_registered_at
      FROM dashboard_sessions current_session
     WHERE current_session.session_id_hash = ${hashSessionId(id)}
     LIMIT 1`;
  const row = rows[0];
  if (!row || row.revoked_at) return { ok: false, status: 401, code: 'SESSION_INVALID' };
  const expiresAt = new Date(String(row.token_expires_at));
  if (!Number.isFinite(expiresAt.getTime())) {
    return { ok: false, status: 401, code: 'SESSION_EXPIRED' };
  }
  let accessToken = decryptToken(String(row.access_token_ciphertext));
  let refreshToken = row.refresh_token_ciphertext ? decryptToken(String(row.refresh_token_ciphertext)) : undefined;
  let scopes = Array.isArray(row.granted_scopes) ? row.granted_scopes.map(String) : [];
  let effectiveExpiry = expiresAt;
  if (expiresAt.getTime() - Date.now() < 2 * 60_000) {
    if (!refreshToken) return { ok: false, status: 401, code: 'SESSION_EXPIRED' };
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    if (!clientId || !clientSecret) return { ok: false, status: 401, code: 'SESSION_EXPIRED' };
    const refreshResponse = await (deps.fetchImpl ?? fetch)('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    if (!refreshResponse.ok) return { ok: false, status: 401, code: 'SESSION_EXPIRED' };
    const refreshed = await refreshResponse.json() as {
      access_token?: string; refresh_token?: string; expires_in?: number; scope?: string;
    };
    if (!refreshed.access_token || !Number.isFinite(refreshed.expires_in)) {
      return { ok: false, status: 401, code: 'SESSION_EXPIRED' };
    }
    accessToken = refreshed.access_token;
    refreshToken = refreshed.refresh_token ?? refreshToken;
    scopes = (refreshed.scope ?? scopes.join(' ')).split(/\s+/).filter(Boolean);
    effectiveExpiry = new Date(Date.now() + Number(refreshed.expires_in) * 1000);
    await sql`
      UPDATE dashboard_sessions
         SET access_token_ciphertext = ${encryptToken(accessToken)},
             refresh_token_ciphertext = ${refreshToken ? encryptToken(refreshToken) : null},
             granted_scopes = ${scopes}, token_expires_at = ${effectiveExpiry.toISOString()},
             last_used_at = now()
       WHERE session_id_hash = ${hashSessionId(id)}`;
  } else {
    await sql`UPDATE dashboard_sessions SET last_used_at = now() WHERE session_id_hash = ${hashSessionId(id)}`;
  }
  return {
    ok: true,
    session: {
      userId: String(row.discord_user_id),
      ...(row.user_registered_at ? { registeredAt: new Date(String(row.user_registered_at)).toISOString() } : {}),
      accessToken,
      refreshToken,
      scopes,
      expiresAt: effectiveExpiry,
    },
  };
}

export async function revokeDashboardSession(event: SessionEvent, deps: Deps = {}): Promise<void> {
  const signed = cookieValue(event);
  const id = signed ? verifySessionCookie(signed) : null;
  if (!id) return;
  const sql = deps.sql ?? siteSql;
  await sql`UPDATE dashboard_sessions SET revoked_at = now() WHERE session_id_hash = ${hashSessionId(id)}`;
}
