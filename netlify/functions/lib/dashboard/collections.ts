import { randomUUID } from 'node:crypto';
import { botSql, type DashboardSql, type SqlRow } from '../botDb';
import { writeAudit } from './audit';
import type { GuildAccess } from './types';

export const COLLECTION_TABLES = {
  'ticket-categories': 'ticket_categories',
  'self-roles': 'self_role_panels',
  'self-role-options': 'self_role_options',
  'level-rewards': 'level_rewards',
  quiz: 'quiz_questions',
  'shop-items': 'shop_items',
  'action-types': 'fac_action_types',
} as const;

export type CollectionName = keyof typeof COLLECTION_TABLES;

export class CollectionError extends Error {
  constructor(public status: 400 | 404 | 422, public code: string, public field?: string) { super(code); }
}

export async function listCollection(name: CollectionName, access: GuildAccess, sql: DashboardSql = botSql): Promise<SqlRow[]> {
  const guildId = access.guildId;
  switch (name) {
    case 'ticket-categories': return sql`SELECT * FROM ticket_categories WHERE guild_id = ${guildId} ORDER BY position, id`;
    case 'self-roles': return sql`SELECT * FROM self_role_panels WHERE guild_id = ${guildId} ORDER BY created_at, id`;
    case 'self-role-options': return sql`SELECT o.* FROM self_role_options o JOIN self_role_panels p ON p.id = o.panel_id WHERE p.guild_id = ${guildId} ORDER BY o.position, o.role_id`;
    case 'level-rewards': return sql`SELECT * FROM level_rewards WHERE guild_id = ${guildId} ORDER BY level`;
    case 'quiz': return sql`SELECT * FROM quiz_questions WHERE guild_id = ${guildId} ORDER BY id`;
    case 'shop-items': return sql`SELECT * FROM shop_items WHERE guild_id = ${guildId} ORDER BY created_at, id`;
    case 'action-types': return sql`SELECT * FROM fac_action_types WHERE guild_id = ${guildId} ORDER BY name, id`;
  }
}

export async function createCollectionItem(
  name: CollectionName, access: GuildAccess, data: Record<string, unknown>, sql: DashboardSql = botSql,
): Promise<SqlRow | null> {
  const guildId = access.guildId;
  const id = typeof data.id === 'string' && data.id ? data.id : randomUUID();
  let rows: SqlRow[];
  switch (name) {
    case 'ticket-categories':
      rows = await sql`INSERT INTO ticket_categories (id, guild_id, name, emoji, description, discord_category_id, staff_role_ids, position)
        VALUES (${id}, ${guildId}, ${data.name}, ${data.emoji ?? null}, ${data.description ?? null}, ${data.discordCategoryId}, ${JSON.stringify(data.staffRoleIds ?? [])}::jsonb, ${data.position ?? 0}) RETURNING *`;
      break;
    case 'self-roles':
      rows = await sql`INSERT INTO self_role_panels (id, guild_id, title, description, style, unique_choice, channel_id, message_id, enabled)
        VALUES (${id}, ${guildId}, ${data.title}, ${data.description ?? null}, ${data.style ?? 'buttons'}, ${data.isUnique ?? false}, ${data.channelId ?? null}, ${data.messageId ?? null}, true) RETURNING *`;
      break;
    case 'self-role-options': {
      const count = await sql`SELECT count(*)::int AS count FROM self_role_options o JOIN self_role_panels p ON p.id=o.panel_id WHERE p.guild_id=${guildId} AND o.panel_id=${data.panelId}`;
      if (Number(count[0]?.count ?? 0) >= 25) throw new CollectionError(422, 'DISCORD_COMPONENT_LIMIT', 'panelId');
      rows = await sql`INSERT INTO self_role_options (panel_id, role_id, label, emoji, position)
        SELECT p.id, ${data.roleId}, ${data.label}, ${data.emoji ?? null}, ${data.position ?? 0}
          FROM self_role_panels p WHERE p.guild_id=${guildId} AND p.id=${data.panelId} RETURNING *`;
      break;
    }
    case 'level-rewards':
      rows = await sql`INSERT INTO level_rewards (guild_id, level, role_id) VALUES (${guildId}, ${data.level}, ${data.roleId}) RETURNING *`;
      break;
    case 'quiz':
      rows = await sql`INSERT INTO quiz_questions (id, guild_id, question, correct, wrong1, wrong2, wrong3)
        VALUES (${id}, ${guildId}, ${data.question}, ${data.correct}, ${data.wrong1}, ${data.wrong2}, ${data.wrong3}) RETURNING *`;
      break;
    case 'shop-items': {
      const count = await sql`SELECT count(*)::int AS count FROM shop_items WHERE guild_id=${guildId} AND enabled=true`;
      if (Number(count[0]?.count ?? 0) >= 25) throw new CollectionError(422, 'DISCORD_COMPONENT_LIMIT', 'shop-items');
      rows = await sql`INSERT INTO shop_items (guild_id, type, role_id, name, description, price, duration_s, stock, per_user, enabled, created_at)
        VALUES (${guildId}, ${data.type}, ${data.roleId ?? null}, ${data.name}, ${data.description ?? null}, ${data.price}, ${data.durationS ?? null}, ${data.stock ?? null}, ${data.perUser ?? null}, true, ${Date.now()}) RETURNING *`;
      break;
    }
    case 'action-types':
      rows = await sql`INSERT INTO fac_action_types (id, guild_id, name, max_contingent, min_contingent, dirty_money)
        VALUES (${id}, ${guildId}, ${data.name}, ${data.maxContingent ?? 0}, ${data.minContingent ?? 0}, ${data.dirtyMoney ?? 0}) RETURNING *`;
      break;
  }
  if (!rows[0]) throw new CollectionError(404, 'PARENT_NOT_FOUND');
  await writeAudit({ actorUserId: access.userId, accessLevel: access.accessLevel, targetGuildId: guildId, method: 'POST', route: '/api/bot-config-collection', operation: 'create', resourceType: name, resourceId: String(rows[0].id ?? id), changeSummary: data, result: 'success' }, sql);
  return rows[0];
}

export async function updateCollectionItem(
  name: CollectionName, access: GuildAccess, resourceId: string, data: Record<string, unknown>, sql: DashboardSql = botSql,
): Promise<SqlRow | null> {
  const guildId = access.guildId;
  let rows: SqlRow[];
  switch (name) {
    case 'ticket-categories': rows = await sql`UPDATE ticket_categories SET name=${data.name}, emoji=${data.emoji ?? null}, description=${data.description ?? null}, discord_category_id=${data.discordCategoryId}, staff_role_ids=${JSON.stringify(data.staffRoleIds ?? [])}::jsonb, position=${data.position ?? 0} WHERE guild_id=${guildId} AND id=${resourceId} RETURNING *`; break;
    case 'self-roles': rows = await sql`UPDATE self_role_panels SET title=${data.title}, description=${data.description ?? null}, style=${data.style ?? 'buttons'}, unique_choice=${data.isUnique ?? false}, channel_id=${data.channelId ?? null}, message_id=${data.messageId ?? null} WHERE guild_id=${guildId} AND id=${resourceId} RETURNING *`; break;
    case 'level-rewards': rows = await sql`UPDATE level_rewards SET role_id=${data.roleId} WHERE guild_id=${guildId} AND level=${resourceId}::int RETURNING *`; break;
    case 'quiz': rows = await sql`UPDATE quiz_questions SET question=${data.question}, correct=${data.correct}, wrong1=${data.wrong1}, wrong2=${data.wrong2}, wrong3=${data.wrong3} WHERE guild_id=${guildId} AND id=${resourceId} RETURNING *`; break;
    case 'shop-items': rows = await sql`UPDATE shop_items SET type=${data.type}, role_id=${data.roleId ?? null}, name=${data.name}, description=${data.description ?? null}, price=${data.price}, duration_s=${data.durationS ?? null}, stock=${data.stock ?? null}, per_user=${data.perUser ?? null} WHERE guild_id=${guildId} AND id=${resourceId}::bigint RETURNING *`; break;
    case 'action-types': rows = await sql`UPDATE fac_action_types SET name=${data.name}, max_contingent=${data.maxContingent ?? 0}, min_contingent=${data.minContingent ?? 0}, dirty_money=${data.dirtyMoney ?? 0} WHERE guild_id=${guildId} AND id=${resourceId} RETURNING *`; break;
    case 'self-role-options': {
      const panelId = typeof data.panelId === 'string' ? data.panelId : '';
      if (!panelId) throw new CollectionError(400, 'PANEL_ID_REQUIRED', 'panelId');
      rows = await sql`UPDATE self_role_options o
        SET label=${data.label}, emoji=${data.emoji ?? null}, position=${data.position ?? 0}
        FROM self_role_panels p
        WHERE o.panel_id=p.id AND p.guild_id=${guildId} AND o.panel_id=${panelId} AND o.role_id=${resourceId}
        RETURNING o.*`;
      break;
    }
  }
  if (!rows[0]) throw new CollectionError(404, 'RESOURCE_NOT_FOUND');
  await writeAudit({ actorUserId: access.userId, accessLevel: access.accessLevel, targetGuildId: guildId, method: 'PATCH', route: '/api/bot-config-collection', operation: 'update', resourceType: name, resourceId, changeSummary: data, result: 'success' }, sql);
  return rows[0];
}

export async function disableCollectionItem(
  name: 'shop-items' | 'self-roles', access: GuildAccess, resourceId: string, sql: DashboardSql = botSql,
): Promise<void> {
  const rows = name === 'shop-items'
    ? await sql`UPDATE shop_items SET enabled = false WHERE guild_id = ${access.guildId} AND id = ${resourceId}::bigint RETURNING id`
    : await sql`UPDATE self_role_panels SET enabled = false WHERE guild_id = ${access.guildId} AND id = ${resourceId} RETURNING id`;
  if (!rows[0]) throw new CollectionError(404, 'RESOURCE_NOT_FOUND');
  await writeAudit({ actorUserId: access.userId, accessLevel: access.accessLevel, targetGuildId: access.guildId, method: 'DELETE', route: '/api/bot-config-collection', operation: 'disable', resourceType: name, resourceId, changeSummary: { enabled: false }, result: 'success' }, sql);
}
