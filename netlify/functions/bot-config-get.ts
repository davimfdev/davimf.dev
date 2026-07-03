import type { Handler } from '@netlify/functions';
import { botSql } from './lib/botDb';
import { requireGuildAccess } from './lib/dashboard/guildAccess';
import { buildGuildHealth, type ChannelSnapshot, type RoleSnapshot } from './lib/dashboard/snapshots';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  const guildId = event.queryStringParameters?.guildId;
  const access = await requireGuildAccess(event, guildId);
  if (!access.ok) return { statusCode: access.status, body: JSON.stringify({ error: { code: access.code, message: 'Guild access denied.' } }) };
  const [configRows, botRows, channelRows, roleRows, tickets, selfRoles, rewards, quiz, shopItems, actionTypes] = await Promise.all([
    botSql`SELECT * FROM guild_config WHERE guild_id = ${access.guildId}`,
    botSql`SELECT guild_name, bot_present, last_seen_at FROM bot_guilds WHERE guild_id = ${access.guildId}`,
    botSql`SELECT * FROM guild_channels_snapshot WHERE guild_id = ${access.guildId} ORDER BY position, name`,
    botSql`SELECT * FROM guild_roles_snapshot WHERE guild_id = ${access.guildId} ORDER BY position DESC, name`,
    botSql`SELECT * FROM ticket_categories WHERE guild_id = ${access.guildId} ORDER BY position, id`,
    botSql`SELECT * FROM self_role_panels WHERE guild_id = ${access.guildId} ORDER BY created_at, id`,
    botSql`SELECT * FROM level_rewards WHERE guild_id = ${access.guildId} ORDER BY level`,
    botSql`SELECT * FROM quiz_questions WHERE guild_id = ${access.guildId} ORDER BY id`,
    botSql`SELECT * FROM shop_items WHERE guild_id = ${access.guildId} ORDER BY created_at, id`,
    botSql`SELECT * FROM fac_action_types WHERE guild_id = ${access.guildId} ORDER BY name, id`,
  ]);
  const rawConfig = configRows[0] ?? { guild_id: access.guildId, channels: {}, roles: {}, toggles: {}, settings: {}, dashboard_access: {} };
  const bot = botRows[0] ?? {};
  const channels: ChannelSnapshot[] = channelRows.map((row) => ({
    channelId: String(row.channel_id), type: String(row.type),
    botCanView: Boolean(row.bot_can_view), botCanSend: Boolean(row.bot_can_send),
  }));
  const roles: RoleSnapshot[] = roleRows.map((row) => ({ roleId: String(row.role_id), botCanAssign: Boolean(row.bot_can_assign) }));
  const channelMap = (rawConfig.channels ?? {}) as Record<string, unknown>;
  const configuredSendingChannelIds = [rawConfig.log_channel_id, rawConfig.ticket_log_channel_id, ...Object.values(channelMap)]
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const lastSeenAt = bot.last_seen_at ? new Date(String(bot.last_seen_at)) : new Date(0);
  const config = { ...rawConfig };
  if (!access.canManageAccess) {
    delete config.dashboard_access;
    config.current_user_access = { level: 'delegate', via: access.accessVia };
  }
  const health = buildGuildHealth({
    botPresent: Boolean(bot.bot_present), lastSeenAt, lastConfigReadAt: null,
    channels, roles, configuredSendingChannelIds,
  });
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      guild: { id: access.guildId, name: String(bot.guild_name ?? access.guildId), accessLevel: access.accessLevel, canManageAccess: access.canManageAccess },
      config,
      channels: channelRows,
      roles: roleRows,
      health,
      collections: { ticketCategories: tickets, selfRoles, levelRewards: rewards, quiz, shopItems, actionTypes },
    }),
  };
};
