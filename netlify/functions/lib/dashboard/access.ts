import { botSql, type DashboardSql } from '../botDb';
import { writeAudit, type AuditEntry } from './audit';
import type { GuildAccess } from './types';

export class AccessManagementError extends Error {
  constructor(public status: 403 | 422, public code: string, public field?: string) { super(code); }
}

type AccessInput = { users: string[]; roles: string[] };
type AccessDeps = {
  sql: DashboardSql;
  validateRoleIds: (guildId: string, roleIds: string[]) => Promise<void>;
  audit: (entry: AuditEntry) => Promise<void>;
};

function defaults(sql: DashboardSql = botSql): AccessDeps {
  return {
    sql,
    validateRoleIds: async (guildId, roleIds) => {
      if (roleIds.length === 0) return;
      const rows = await sql`SELECT role_id FROM guild_roles_snapshot WHERE guild_id=${guildId} AND role_id = ANY(${roleIds})`;
      const found = new Set(rows.map((row) => String(row.role_id)));
      if (roleIds.some((id) => !found.has(id))) throw new AccessManagementError(422, 'ROLE_NOT_FOUND', 'roles');
    },
    audit: (entry) => writeAudit(entry, sql),
  };
}

export async function getDashboardAccessView(access: GuildAccess, sql: DashboardSql = botSql): Promise<Record<string, unknown>> {
  if (!access.canManageAccess) {
    return { currentUserAccess: { level: 'delegate', via: access.accessVia } };
  }
  const rows = await sql`SELECT dashboard_access FROM guild_config WHERE guild_id=${access.guildId}`;
  const value = (rows[0]?.dashboard_access ?? {}) as Record<string, unknown>;
  return {
    users: Array.isArray(value.users) ? value.users.map(String) : [],
    roles: Array.isArray(value.roles) ? value.roles.map(String) : [],
    currentUserAccess: { level: access.accessLevel, via: access.accessVia },
  };
}

export async function updateDashboardAccess(access: GuildAccess, input: AccessInput, injected?: AccessDeps): Promise<void> {
  if (!access.canManageAccess) throw new AccessManagementError(403, 'ACCESS_MANAGEMENT_FORBIDDEN');
  const users = [...new Set(input.users.map(String).filter((id) => /^\d{17,20}$/.test(id)))].sort();
  const roles = [...new Set(input.roles.map(String).filter((id) => /^\d{17,20}$/.test(id)))].sort();
  if (users.length !== new Set(input.users).size) throw new AccessManagementError(422, 'INVALID_USER_ID', 'users');
  if (roles.length !== new Set(input.roles).size) throw new AccessManagementError(422, 'INVALID_ROLE_ID', 'roles');
  const deps = injected ?? defaults();
  await deps.validateRoleIds(access.guildId, roles);
  const currentRows = await deps.sql`SELECT dashboard_access FROM guild_config WHERE guild_id=${access.guildId}`;
  const current = (currentRows[0]?.dashboard_access ?? {}) as Record<string, unknown>;
  const before = {
    users: Array.isArray(current.users) ? current.users.map(String).sort() : [],
    roles: Array.isArray(current.roles) ? current.roles.map(String).sort() : [],
  };
  const after = { users, roles };
  const json = JSON.stringify({ users, roles });
  await deps.sql`INSERT INTO guild_config (guild_id, dashboard_access, updated_by, updated_at)
    VALUES (${access.guildId}, ${json}::jsonb, ${access.userId}, now())
    ON CONFLICT (guild_id) DO UPDATE SET dashboard_access=${json}::jsonb, updated_by=${access.userId}, updated_at=now()`;
  await deps.audit({ actorUserId: access.userId, accessLevel: access.accessLevel, targetGuildId: access.guildId, method: 'PATCH', route: '/api/bot-config-access', operation: 'update-access', resourceType: 'dashboard_access', changeSummary: { before, after }, result: 'success' });
}
