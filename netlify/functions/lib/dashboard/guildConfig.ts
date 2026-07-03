import { botSql, type DashboardSql } from '../botDb';
import { writeAudit, type AuditEntry } from './audit';
import { CONFIG_RULES, type MapColumn, validateMapPatch } from './configCatalog';
import { classifySnapshotAge, validateChannel, validateRole, type ChannelSnapshot, type RoleSnapshot } from './snapshots';
import type { GuildAccess } from './types';

export class DashboardConfigError extends Error {
  constructor(public status: 409 | 422, public code: string, public field?: string) {
    super(code);
  }
}

export type ConfigPatch = {
  column: MapColumn;
  set: Record<string, unknown>;
  remove: string[];
};

type PatchDeps = {
  sql: DashboardSql;
  getChannel: (guildId: string, channelId: string) => Promise<ChannelSnapshot | undefined>;
  getRole: (guildId: string, roleId: string) => Promise<RoleSnapshot | undefined>;
  getSnapshotUpdatedAt: (guildId: string) => Promise<Date | null>;
  audit: (entry: AuditEntry) => Promise<void>;
};

function defaults(sql: DashboardSql = botSql): PatchDeps {
  return {
    sql,
    getChannel: async (guildId, channelId) => {
      const rows = await sql`
        SELECT channel_id, type, bot_can_view, bot_can_send
          FROM guild_channels_snapshot WHERE guild_id = ${guildId} AND channel_id = ${channelId}`;
      return rows[0] ? {
        channelId: String(rows[0].channel_id), type: String(rows[0].type),
        botCanView: Boolean(rows[0].bot_can_view), botCanSend: Boolean(rows[0].bot_can_send),
      } : undefined;
    },
    getRole: async (guildId, roleId) => {
      const rows = await sql`
        SELECT role_id, bot_can_assign FROM guild_roles_snapshot
         WHERE guild_id = ${guildId} AND role_id = ${roleId}`;
      return rows[0] ? { roleId: String(rows[0].role_id), botCanAssign: Boolean(rows[0].bot_can_assign) } : undefined;
    },
    getSnapshotUpdatedAt: async (guildId) => {
      const rows = await sql`
        SELECT LEAST(
          (SELECT min(updated_at) FROM guild_channels_snapshot WHERE guild_id = ${guildId}),
          (SELECT min(updated_at) FROM guild_roles_snapshot WHERE guild_id = ${guildId})
        ) AS updated_at`;
      return rows[0]?.updated_at ? new Date(String(rows[0].updated_at)) : null;
    },
    audit: (entry) => writeAudit(entry, sql),
  };
}

async function validateResources(access: GuildAccess, patch: ConfigPatch, deps: PatchDeps): Promise<void> {
  const resourceEntries = Object.entries(patch.set).filter(([key]) => {
    const valueType = CONFIG_RULES[patch.column][key]?.value;
    return valueType === 'channel' || valueType === 'role';
  });
  if (resourceEntries.length === 0) return;
  const updatedAt = await deps.getSnapshotUpdatedAt(access.guildId);
  if (!updatedAt || classifySnapshotAge(updatedAt) === 'blocked') {
    throw new DashboardConfigError(409, 'SNAPSHOT_STALE');
  }
  for (const [key, value] of resourceEntries) {
    const rule = CONFIG_RULES[patch.column][key];
    const result = rule.value === 'channel'
      ? validateChannel(await deps.getChannel(access.guildId, String(value)), rule.channelNeedsSend ?? false)
      : validateRole(await deps.getRole(access.guildId, String(value)), rule.roleNeedsAssign ?? false);
    if (!result.ok) throw new DashboardConfigError(422, result.code, key);
  }
}

export async function patchGuildConfig(
  access: GuildAccess,
  patch: ConfigPatch,
  injected?: PatchDeps,
): Promise<void> {
  if (!['channels', 'roles', 'toggles', 'settings'].includes(patch.column)) {
    throw new DashboardConfigError(422, 'COLUMN_FORBIDDEN', 'column');
  }
  const validation = validateMapPatch(patch.column, patch.set);
  if (!validation.ok) throw new DashboardConfigError(422, validation.code, validation.field);
  for (const key of patch.remove) {
    if (!CONFIG_RULES[patch.column][key]) throw new DashboardConfigError(422, 'UNKNOWN_KEY', key);
  }
  const deps = injected ?? defaults();
  await validateResources(access, patch, deps);
  const setJson = JSON.stringify(patch.set);
  const remove = patch.remove;
  const { guildId, userId } = access;
  switch (patch.column) {
    case 'channels':
      await deps.sql`INSERT INTO guild_config (guild_id, channels, updated_by, updated_at)
        VALUES (${guildId}, ${setJson}::jsonb, ${userId}, now())
        ON CONFLICT (guild_id) DO UPDATE SET channels = (coalesce(guild_config.channels, '{}'::jsonb) || ${setJson}::jsonb) - ${remove}, updated_by = ${userId}, updated_at = now()`;
      break;
    case 'roles':
      await deps.sql`INSERT INTO guild_config (guild_id, roles, updated_by, updated_at)
        VALUES (${guildId}, ${setJson}::jsonb, ${userId}, now())
        ON CONFLICT (guild_id) DO UPDATE SET roles = (coalesce(guild_config.roles, '{}'::jsonb) || ${setJson}::jsonb) - ${remove}, updated_by = ${userId}, updated_at = now()`;
      break;
    case 'toggles':
      await deps.sql`INSERT INTO guild_config (guild_id, toggles, updated_by, updated_at)
        VALUES (${guildId}, ${setJson}::jsonb, ${userId}, now())
        ON CONFLICT (guild_id) DO UPDATE SET toggles = (coalesce(guild_config.toggles, '{}'::jsonb) || ${setJson}::jsonb) - ${remove}, updated_by = ${userId}, updated_at = now()`;
      break;
    case 'settings':
      await deps.sql`INSERT INTO guild_config (guild_id, settings, updated_by, updated_at)
        VALUES (${guildId}, ${setJson}::jsonb, ${userId}, now())
        ON CONFLICT (guild_id) DO UPDATE SET settings = (coalesce(guild_config.settings, '{}'::jsonb) || ${setJson}::jsonb) - ${remove}, updated_by = ${userId}, updated_at = now()`;
      break;
  }
  await deps.audit({
    actorUserId: userId, accessLevel: access.accessLevel, targetGuildId: guildId,
    method: 'PATCH', route: '/api/bot-config-patch', operation: 'patch',
    resourceType: 'guild_config', changeSummary: { column: patch.column, set: patch.set, remove }, result: 'success',
  });
}
