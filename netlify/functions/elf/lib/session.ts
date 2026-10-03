import cookie from 'cookie';
import { hashToken, randomToken, signToken, verifySignedToken } from './crypto';
import { sql, type ElfSql } from './db';

export type Platform = 'web' | 'desktop' | 'android';

export type ElfSession = {
  id: string;
  userId: string;
  deviceId: string;
  platform: Platform;
};

export type SessionFailureCode = 'UNAUTHENTICATED' | 'SESSION_EXPIRED' | 'SESSION_REVOKED' | 'DEVICE_REVOKED';

export type SessionResult =
  | { ok: true; session: ElfSession; isCookieAuth: boolean }
  | { ok: false; status: 401; code: SessionFailureCode };

export const ELF_SESSION_COOKIE = 'elf_session';
export const SESSION_TTL_DAYS = 30;
export const SESSION_ABSOLUTE_DAYS = 90;
const TOUCH_WINDOW_MS = 15 * 60_000;
const DAY_MS = 24 * 3600_000;

type Deps = { sql?: ElfSql };

/** O postgres.js devolve `timestamptz` como Date; o tipo aceita string por segurança. */
type Timestamp = Date | string;

function credentialOf(req: Request): { token: string; isCookieAuth: boolean } | null {
  const header = req.headers.get('authorization');
  if (header?.startsWith('Bearer ')) {
    return { token: header.slice(7), isCookieAuth: false };
  }
  const value = cookie.parse(req.headers.get('cookie') ?? '')[ELF_SESSION_COOKIE];
  return value ? { token: value, isCookieAuth: true } : null;
}

export function sessionCookie(value: string, secure: boolean): string {
  return cookie.serialize(ELF_SESSION_COOKIE, value, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api/elf',
    maxAge: SESSION_TTL_DAYS * 24 * 3600,
  });
}

export function clearedSessionCookie(secure: boolean): string {
  return cookie.serialize(ELF_SESSION_COOKIE, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api/elf',
    expires: new Date(0),
  });
}

/** Cria a sessão e devolve o valor assinado para o cliente. O id em claro nunca toca o banco. */
export async function createElfSession(
  input: { userId: string; deviceId: string; platform: Platform },
  deps: Deps = {},
): Promise<string> {
  const query = deps.sql ?? sql;
  const id = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * DAY_MS).toISOString();
  await query`
    INSERT INTO elf_sessions (session_id_hash, user_id, device_id, platform, expires_at)
    VALUES (${hashToken(id)}, ${input.userId}, ${input.deviceId}, ${input.platform}, ${expiresAt})`;
  return signToken(id);
}

/** Única porta de entrada das rotas protegidas. Aceita Bearer (native) e cookie (web). */
export async function requireElfSession(req: Request, deps: Deps = {}): Promise<SessionResult> {
  const credential = credentialOf(req);
  if (!credential) return { ok: false, status: 401, code: 'UNAUTHENTICATED' };

  const id = verifySignedToken(credential.token);
  if (!id) return { ok: false, status: 401, code: 'UNAUTHENTICATED' };

  const query = deps.sql ?? sql;
  const rows = await query<{
    id: string;
    user_id: string;
    device_id: string;
    platform: Platform;
    expires_at: Timestamp;
    created_at: Timestamp;
    last_used_at: Timestamp;
    session_revoked_at: Timestamp | null;
    device_revoked_at: Timestamp | null;
  }>`
    SELECT s.id, s.user_id, s.device_id, s.platform, s.expires_at, s.created_at,
           s.last_used_at, s.revoked_at AS session_revoked_at,
           d.revoked_at AS device_revoked_at
      FROM elf_sessions s
      JOIN devices d ON d.id = s.device_id AND d.user_id = s.user_id
     WHERE s.session_id_hash = ${hashToken(id)}
     LIMIT 1`;

  const row = rows[0];
  if (!row) return { ok: false, status: 401, code: 'UNAUTHENTICATED' };
  if (row.session_revoked_at) return { ok: false, status: 401, code: 'SESSION_REVOKED' };
  if (row.device_revoked_at) return { ok: false, status: 401, code: 'DEVICE_REVOKED' };

  const now = Date.now();
  const expiresAt = new Date(row.expires_at).getTime();
  const createdAt = new Date(row.created_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return { ok: false, status: 401, code: 'SESSION_EXPIRED' };
  }
  if (!Number.isFinite(createdAt) || now - createdAt > SESSION_ABSOLUTE_DAYS * DAY_MS) {
    return { ok: false, status: 401, code: 'SESSION_EXPIRED' };
  }

  // Renovação amortizada: sem isso, todo GET viraria uma escrita no banco.
  if (now - new Date(row.last_used_at).getTime() > TOUCH_WINDOW_MS) {
    const renewedExpiry = new Date(now + SESSION_TTL_DAYS * DAY_MS).toISOString();
    await query`
      WITH touched AS (
        UPDATE elf_sessions
           SET last_used_at = NOW(), expires_at = ${renewedExpiry}
         WHERE id = ${row.id}
     RETURNING device_id
      )
      UPDATE devices SET last_seen_at = NOW()
       WHERE id = (SELECT device_id FROM touched)`;
  }

  return {
    ok: true,
    isCookieAuth: credential.isCookieAuth,
    session: {
      id: row.id,
      userId: row.user_id,
      deviceId: row.device_id,
      platform: row.platform,
    },
  };
}

/** Revoga no servidor. Devolve `false` se a sessão não existe, já foi revogada ou é de outro usuário. */
export async function revokeSessionById(
  sessionId: string,
  userId: string,
  deps: Deps = {},
): Promise<boolean> {
  const query = deps.sql ?? sql;
  const rows = await query`
    UPDATE elf_sessions SET revoked_at = NOW()
     WHERE id = ${sessionId} AND user_id = ${userId} AND revoked_at IS NULL
 RETURNING id`;
  return rows.length > 0;
}
