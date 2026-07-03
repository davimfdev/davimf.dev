import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDashboardSession,
  requireDashboardSession,
  revokeDashboardSession,
} from '../session';
import { hashSessionId, signSessionId } from '../crypto';

type Row = Record<string, unknown>;

function memorySql() {
  const rows = new Map<string, Row>();
  const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join('?');
    if (query.includes('INSERT INTO dashboard_sessions')) {
      rows.set(String(values[0]), {
        session_id_hash: values[0],
        discord_user_id: values[1],
        access_token_ciphertext: values[2],
        refresh_token_ciphertext: values[3],
        granted_scopes: values[4],
        token_expires_at: values[5],
        revoked_at: null,
      });
      return [];
    }
    if (query.includes('SELECT session_id_hash')) {
      const row = rows.get(String(values[0]));
      return row ? [row] : [];
    }
    if (query.includes('UPDATE dashboard_sessions') && query.includes('revoked_at')) {
      const row = rows.get(String(values[0]));
      if (row) row.revoked_at = new Date().toISOString();
      return [];
    }
    return [];
  });
  return { sql, rows };
}

describe('dashboard sessions', () => {
  beforeEach(() => {
    process.env.DASHBOARD_SESSION_SECRET = '0123456789abcdef0123456789abcdef';
    process.env.DASHBOARD_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  });

  it('stores only a session hash and resolves the signed cookie', async () => {
    const db = memorySql();
    const cookieValue = await createDashboardSession({
      userId: '344214477069221888',
      accessToken: 'access-secret',
      refreshToken: 'refresh-secret',
      scopes: ['identify', 'guilds'],
      expiresAt: new Date(Date.now() + 5 * 60_000),
    }, { sql: db.sql as never, randomId: () => 'opaque-id' });

    expect([...db.rows.keys()]).toEqual([hashSessionId('opaque-id')]);
    expect(JSON.stringify([...db.rows.values()])).not.toContain('access-secret');

    const result = await requireDashboardSession({ headers: { cookie: `bot_dashboard_session=${cookieValue}` } }, { sql: db.sql as never });
    expect(result).toMatchObject({
      ok: true,
      session: { userId: '344214477069221888', accessToken: 'access-secret' },
    });
  });

  it('rejects a tampered cookie', async () => {
    const db = memorySql();
    const result = await requireDashboardSession({ headers: { cookie: `${signSessionId('opaque-id')}x` } }, { sql: db.sql as never });
    expect(result).toMatchObject({ ok: false, status: 401, code: 'SESSION_INVALID' });
  });

  it('revokes the current session', async () => {
    const db = memorySql();
    const cookieValue = await createDashboardSession({
      userId: 'u1', accessToken: 'a', scopes: ['identify'], expiresAt: new Date(Date.now() + 5 * 60_000),
    }, { sql: db.sql as never, randomId: () => 'opaque-id' });
    await revokeDashboardSession({ headers: { cookie: `bot_dashboard_session=${cookieValue}` } }, { sql: db.sql as never });
    expect(db.rows.get(hashSessionId('opaque-id'))?.revoked_at).not.toBeNull();
  });

  it('refreshes an expired Discord token when a refresh token exists', async () => {
    process.env.DISCORD_CLIENT_ID = 'client-id';
    process.env.DISCORD_CLIENT_SECRET = 'client-secret';
    const db = memorySql();
    const cookieValue = await createDashboardSession({
      userId: 'u1', accessToken: 'old', refreshToken: 'refresh', scopes: ['identify'],
      expiresAt: new Date(Date.now() - 1_000),
    }, { sql: db.sql as never, randomId: () => 'opaque-id' });
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600, scope: 'identify guilds',
    }), { status: 200 }));
    const result = await requireDashboardSession(
      { headers: { cookie: `bot_dashboard_session=${cookieValue}` } },
      { sql: db.sql as never, fetchImpl: fetchImpl as never },
    );
    expect(result).toMatchObject({ ok: true, session: { accessToken: 'new-access' } });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
