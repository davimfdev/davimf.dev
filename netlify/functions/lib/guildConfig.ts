import { botSql } from './botDb';

export const MAP_COLUMNS = ['channels', 'roles', 'toggles', 'settings'] as const;
export type MapColumn = (typeof MAP_COLUMNS)[number];

// Allowlist mínima do contrato (dashboard-config-schema-contract.md §Chaves permitidas).
// Expandir conforme a UI cobrir mais grupos; começa com os principais.
const ALLOWED_KEYS: Record<MapColumn, ReadonlySet<string>> = {
  channels: new Set([
    'log-comandos','log-mensagens','log-entradas','log-saidas','log-membros','log-voz','log-canais',
    'log-cargos','log-servidor','log-bans','log-kicks','log-moderacao','log-formularios','log-loja',
    'log-tickets','event-channel','level-notify','welcome:channel','welcome:farewell-channel',
  ]),
  roles: new Set([
    'moderador','staff','mutado','nao-verificado','vendedor','welcome:autorole',
  ]),
  toggles: new Set([
    'mod:dm-on-action','mod:require-reason','sec:automod','sec:automod-warn','sec:automod-block-invites',
    'sec:verify','sec:antiraid','sec:antinuke','welcome:enabled','welcome:dm','welcome:farewell-enabled',
    'level:enabled','eco:enabled','event:enabled',
  ]),
  settings: new Set([
    'mod:warn-ttl-days','mod:escalation','welcome:message','welcome:image','welcome:farewell-message',
    'level:notify','level:ignored-channels','eco:currency-name','eco:currency-emoji','eco:daily',
    'event:min-interval','event:max-interval',
  ]),
};

/** Devolve só as chaves permitidas do patch para aquela coluna. Lança em coluna desconhecida. */
export function sanitizePatch(column: MapColumn, patch: Record<string, unknown>): Record<string, unknown> {
  const allowed = ALLOWED_KEYS[column];
  if (!allowed) throw new Error(`coluna não editável: ${column}`);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

export async function getGuildConfigRow(guildId: string, sql = botSql) {
  const rows = await sql`
    SELECT guild_id, log_channel_id, ticket_log_channel_id,
           channels, roles, toggles, staff_role_ids, settings, dashboard_access, updated_at
      FROM guild_config WHERE guild_id = ${guildId}`;
  return rows[0] ?? null;
}

/** Merge por chave num mapa JSONB, criando a linha se preciso. Nunca toca dashboard_access. */
export async function patchMap(
  guildId: string, column: MapColumn, patch: Record<string, unknown>, updatedBy: string, sql = botSql,
) {
  const clean = sanitizePatch(column, patch);
  const json = JSON.stringify(clean);
  // Coluna é estática por ramo (tagged templates não parametrizam identificadores).
  switch (column) {
    case 'channels':
      return sql`INSERT INTO guild_config (guild_id, channels, updated_by, updated_at)
                 VALUES (${guildId}, ${json}::jsonb, ${updatedBy}, now())
                 ON CONFLICT (guild_id) DO UPDATE SET
                   channels = coalesce(guild_config.channels,'{}'::jsonb) || ${json}::jsonb,
                   updated_by = ${updatedBy}, updated_at = now()`;
    case 'roles':
      return sql`INSERT INTO guild_config (guild_id, roles, updated_by, updated_at)
                 VALUES (${guildId}, ${json}::jsonb, ${updatedBy}, now())
                 ON CONFLICT (guild_id) DO UPDATE SET
                   roles = coalesce(guild_config.roles,'{}'::jsonb) || ${json}::jsonb,
                   updated_by = ${updatedBy}, updated_at = now()`;
    case 'toggles':
      return sql`INSERT INTO guild_config (guild_id, toggles, updated_by, updated_at)
                 VALUES (${guildId}, ${json}::jsonb, ${updatedBy}, now())
                 ON CONFLICT (guild_id) DO UPDATE SET
                   toggles = coalesce(guild_config.toggles,'{}'::jsonb) || ${json}::jsonb,
                   updated_by = ${updatedBy}, updated_at = now()`;
    case 'settings':
      return sql`INSERT INTO guild_config (guild_id, settings, updated_by, updated_at)
                 VALUES (${guildId}, ${json}::jsonb, ${updatedBy}, now())
                 ON CONFLICT (guild_id) DO UPDATE SET
                   settings = coalesce(guild_config.settings,'{}'::jsonb) || ${json}::jsonb,
                   updated_by = ${updatedBy}, updated_at = now()`;
  }
}
