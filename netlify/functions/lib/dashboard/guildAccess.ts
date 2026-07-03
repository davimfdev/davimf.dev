import type { DashboardSql } from '../botDb';
import { botSql } from '../botDb';
import { requireDashboardSession } from './session';
import type { DashboardSessionResult } from './session';
import type { GuildAccessResult } from './types';

type Event = { headers: Record<string, string | undefined> };
type BotGuild = { guildId: string; botPresent: boolean };
type DiscordGuild = { id: string; owner?: boolean };
type DashboardAccess = { users: string[]; roles: string[] };

export type GuildAccessDeps = {
  requireSession: (event: Event) => Promise<DashboardSessionResult>;
  supportIds: ReadonlySet<string>;
  getBotGuild: (guildId: string) => Promise<BotGuild | null>;
  getDiscordGuilds: (accessToken: string) => Promise<DiscordGuild[]>;
  getDashboardAccess: (guildId: string) => Promise<DashboardAccess>;
  getMemberRoles: (accessToken: string, guildId: string) => Promise<string[]>;
};

function configuredSupportIds(): ReadonlySet<string> {
  const raw = process.env.BOT_SUPPORT_USER_IDS?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === 'production') throw new Error('BOT_SUPPORT_USER_IDS is required in production');
    return new Set();
  }
  const ids = raw.split(',').map((id) => id.trim()).filter(Boolean);
  if (ids.some((id) => !/^\d{17,20}$/.test(id))) throw new Error('BOT_SUPPORT_USER_IDS contains an invalid Discord id');
  return new Set(ids);
}

function defaultDeps(sql: DashboardSql = botSql): GuildAccessDeps {
  return {
    requireSession: requireDashboardSession,
    supportIds: configuredSupportIds(),
    getBotGuild: async (guildId) => {
      const rows = await sql`SELECT guild_id, bot_present FROM bot_guilds WHERE guild_id = ${guildId} AND bot_present = true`;
      return rows[0] ? { guildId: String(rows[0].guild_id), botPresent: Boolean(rows[0].bot_present) } : null;
    },
    getDiscordGuilds: async (accessToken) => {
      const response = await fetch('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error('Discord guilds fetch failed');
      return await response.json() as DiscordGuild[];
    },
    getDashboardAccess: async (guildId) => {
      const rows = await sql`SELECT dashboard_access FROM guild_config WHERE guild_id = ${guildId}`;
      const value = (rows[0]?.dashboard_access ?? {}) as Record<string, unknown>;
      return {
        users: Array.isArray(value.users) ? value.users.map(String) : [],
        roles: Array.isArray(value.roles) ? value.roles.map(String) : [],
      };
    },
    getMemberRoles: async (accessToken, guildId) => {
      const response = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) return [];
      const member = await response.json() as { roles?: string[] };
      return member.roles?.map(String) ?? [];
    },
  };
}

export async function requireGuildAccess(
  event: Event,
  guildId: string | undefined,
  injected?: GuildAccessDeps,
): Promise<GuildAccessResult> {
  if (!guildId) return { ok: false, status: 400, code: 'GUILD_ID_REQUIRED' };
  const deps = injected ?? defaultDeps();
  const sessionResult = await deps.requireSession(event);
  if (!sessionResult.ok) return { ok: false, status: 401, code: sessionResult.code };
  const { userId, accessToken, scopes } = sessionResult.session;
  const botGuild = await deps.getBotGuild(guildId);
  if (!botGuild?.botPresent) return { ok: false, status: 403, code: 'BOT_NOT_PRESENT' };
  if (deps.supportIds.has(userId)) {
    return { ok: true, userId, guildId, accessLevel: 'support', accessVia: 'support', canManageAccess: true, roleDelegationAvailable: true };
  }

  let guilds: DiscordGuild[];
  try {
    guilds = await deps.getDiscordGuilds(accessToken);
  } catch {
    return { ok: false, status: 502, code: 'DISCORD_GUILDS_UNAVAILABLE' };
  }
  if (guilds.some((guild) => guild.id === guildId && guild.owner === true)) {
    return { ok: true, userId, guildId, accessLevel: 'owner', accessVia: 'owner', canManageAccess: true, roleDelegationAvailable: true };
  }
  const access = await deps.getDashboardAccess(guildId);
  if (access.users.includes(userId)) {
    return { ok: true, userId, guildId, accessLevel: 'delegate', accessVia: 'user', canManageAccess: false, roleDelegationAvailable: scopes.includes('guilds.members.read') };
  }
  if (!scopes.includes('guilds.members.read')) {
    return { ok: false, status: 403, code: 'ACCESS_DENIED', roleDelegationAvailable: false };
  }
  const memberRoles = await deps.getMemberRoles(accessToken, guildId);
  if (access.roles.some((roleId) => memberRoles.includes(roleId))) {
    return { ok: true, userId, guildId, accessLevel: 'delegate', accessVia: 'role', canManageAccess: false, roleDelegationAvailable: true };
  }
  return { ok: false, status: 403, code: 'ACCESS_DENIED', roleDelegationAvailable: true };
}
