import type { DashboardSql } from '../botDb';
import { botSql } from '../botDb';
import type { AccessLevel } from './types';

const SENSITIVE_KEYS = new Set(['token', 'secret', 'password', 'cookie', 'authorization']);

export type AuditEntry = {
  actorUserId: string;
  accessLevel: AccessLevel;
  targetGuildId: string;
  method: string;
  route: string;
  operation: string;
  resourceType: string;
  resourceId?: string;
  changeSummary: Record<string, unknown>;
  result: 'success' | 'rejected' | 'failed';
};

export function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [
    key,
    SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : sanitizeAuditValue(child),
  ]));
}

export async function writeAudit(entry: AuditEntry, sql: DashboardSql = botSql): Promise<void> {
  const summary = JSON.stringify(sanitizeAuditValue(entry.changeSummary));
  await sql`
    INSERT INTO dashboard_config_audit (
      actor_user_id, access_level, target_guild_id, method, route, operation,
      resource_type, resource_id, change_summary, result
    ) VALUES (
      ${entry.actorUserId}, ${entry.accessLevel}, ${entry.targetGuildId}, ${entry.method},
      ${entry.route}, ${entry.operation}, ${entry.resourceType}, ${entry.resourceId ?? null},
      ${summary}::jsonb, ${entry.result}
    )`;
}
