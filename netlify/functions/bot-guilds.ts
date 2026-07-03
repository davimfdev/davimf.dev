import type { Handler } from '@netlify/functions';
import { botSql } from './lib/botDb';
import { configuredSupportIds } from './lib/dashboard/guildAccess';
import { getVisibleGuilds } from './lib/dashboard/guilds';
import { requireDashboardSession } from './lib/dashboard/session';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  const session = await requireDashboardSession(event);
  if (!session.ok) return { statusCode: 401, body: JSON.stringify({ error: { code: session.code, message: 'Unauthorized' } }) };
  const guilds = await getVisibleGuilds(session.session, {
    supportIds: configuredSupportIds(),
    listBotGuilds: async () => (await botSql`
      SELECT guild_id, guild_name, bot_present, last_seen_at
        FROM bot_guilds WHERE bot_present = true ORDER BY guild_name ASC`).map((row) => ({
      guildId: String(row.guild_id), name: String(row.guild_name ?? row.guild_id),
      botPresent: Boolean(row.bot_present), lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : undefined,
    })),
    listDiscordGuilds: async (token) => {
      const response = await fetch('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Discord guilds fetch failed');
      return await response.json() as Array<{ id: string; name: string; owner?: boolean; icon?: string }>;
    },
    listDirectDelegations: async (userId) => (await botSql`
      SELECT guild_id FROM guild_config
       WHERE coalesce(dashboard_access->'users', '[]'::jsonb) @> ${JSON.stringify([userId])}::jsonb`).map((row) => String(row.guild_id)),
    listRoleDelegations: async (current, botGuilds) => {
      if (!current.scopes.includes('guilds.members.read')) return [];
      const configured = await botSql`
        SELECT guild_id, dashboard_access->'roles' AS roles FROM guild_config
         WHERE jsonb_array_length(coalesce(dashboard_access->'roles', '[]'::jsonb)) > 0`;
      const allowedGuilds = new Set(botGuilds.map((guild) => guild.guildId));
      const matches = await Promise.all(configured.filter((row) => allowedGuilds.has(String(row.guild_id))).map(async (row) => {
        const response = await fetch(`https://discord.com/api/users/@me/guilds/${row.guild_id}/member`, {
          headers: { Authorization: `Bearer ${current.accessToken}` },
        });
        if (!response.ok) return null;
        const member = await response.json() as { roles?: string[] };
        const delegated = Array.isArray(row.roles) ? row.roles.map(String) : [];
        return delegated.some((roleId) => member.roles?.includes(roleId)) ? String(row.guild_id) : null;
      }));
      return matches.filter((id): id is string => Boolean(id));
    },
  });
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(guilds) };
};
