import type { ElfSql } from './db';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'archive'
  | 'unarchive'
  | 'revoke'
  | 'approve';

export type AuditEntry = {
  userId: string;
  deviceId: string | null;
  entity: string;
  entityId: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
  versionBefore?: number | null;
  versionAfter?: number | null;
  origin?: string;
  requestId?: string;
};

/**
 * Grava usando o `tx` da escrita auditada, nunca depois dela: auditar fora da
 * transação produziria log de uma escrita que sofreu rollback.
 *
 * Este é log interno de auditoria, não log de aplicação: aqui os valores
 * financeiros podem estar. A proibição vale para console.log e respostas de erro.
 */
export async function writeAudit(tx: ElfSql, entry: AuditEntry): Promise<void> {
  // Objetos vão crus: o postgres.js serializa para jsonb. JSON.stringify antes
  // gravaria uma string JSON escalar, e after->>'campo' viraria NULL.
  const before = entry.before === undefined ? null : entry.before;
  const after = entry.after === undefined ? null : entry.after;
  await tx`
    INSERT INTO audit_logs
      (user_id, device_id, entity, entity_id, action, before, after,
       version_before, version_after, origin, request_id)
    VALUES
      (${entry.userId}, ${entry.deviceId}, ${entry.entity}, ${entry.entityId}, ${entry.action},
       ${before}::jsonb, ${after}::jsonb, ${entry.versionBefore ?? null},
       ${entry.versionAfter ?? null}, ${entry.origin ?? 'manual'}, ${entry.requestId ?? null})`;
}
