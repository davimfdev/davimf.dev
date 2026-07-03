import { botSql } from './botDb';

export type Access = { ok: true; userId: string } | { ok: false; status: number; error: string };

type Deps = { fetchImpl?: typeof fetch; sql?: (strings: TemplateStringsArray, ...v: any[]) => Promise<any[]> };

function bearer(event: { headers: Record<string, string | undefined> }): string | null {
  const h = event.headers || {};
  const raw = h.authorization || h.Authorization;
  if (!raw || !raw.startsWith('Bearer ')) return null;
  return raw.slice('Bearer '.length);
}

/** owner-first: só o dono da guild, e só se um bot do sistema está presente nela. */
export async function requireGuildAccess(
  event: { headers: Record<string, string | undefined> },
  guildId: string | undefined,
  deps: Deps = {},
): Promise<Access> {
  const doFetch = deps.fetchImpl ?? fetch;
  const sql = deps.sql ?? (botSql as any);

  const token = bearer(event);
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' };
  if (!guildId) return { ok: false, status: 400, error: 'Missing guildId' };

  const me = await doFetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!me.ok) return { ok: false, status: 401, error: 'Invalid token' };
  const userId = (await me.json())?.id as string | undefined;
  if (!userId) return { ok: false, status: 401, error: 'No user id' };

  const gRes = await doFetch('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!gRes.ok) return { ok: false, status: 502, error: 'Discord guilds fetch failed' };
  const guilds = (await gRes.json()) as Array<{ id: string; owner?: boolean }>;
  const guild = guilds.find((g) => String(g.id) === String(guildId));
  if (!guild || guild.owner !== true) return { ok: false, status: 403, error: 'Not the guild owner' };

  const rows = await sql`SELECT 1 FROM bot_guilds WHERE guild_id = ${guildId} AND bot_present = true`;
  if (!rows || rows.length === 0) return { ok: false, status: 403, error: 'Bot not in this guild' };

  return { ok: true, userId };
}
