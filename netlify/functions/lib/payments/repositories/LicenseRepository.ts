/**
 * Licenças FMM — REUSO da tabela `fmm_license_keys` que já existe.
 *
 * Nada de um segundo sistema de licenças: o formato da chave, o hash e a
 * validação por HWID continuam sendo os de lib/fmm-license.ts. Aqui só somamos
 * o vínculo com pedido/produto, o status de ciclo de vida e a cópia cifrada
 * que permite reexibir a chave no painel do cliente.
 */

import type { License, LicenseStatus } from '../domain/types';
import { LICENSE_STATUSES } from '../domain/types';
import {
  isoDate,
  num,
  optionalNum,
  optionalStr,
  paymentsSql,
  requiredIsoDate,
  str,
} from '../infrastructure/db';
import type { SqlRow } from '../infrastructure/db';

function toStatus(value: unknown): LicenseStatus {
  const raw = str(value);
  return (LICENSE_STATUSES as readonly string[]).includes(raw) ? (raw as LicenseStatus) : 'ACTIVE';
}

export function rowToLicense(row: SqlRow): License {
  return {
    id: str(row.id),
    orderId: optionalStr(row.order_id),
    productId: optionalNum(row.product_id),
    userId: optionalStr(row.discord_user_id),
    keyPrefix: str(row.key_prefix),
    level: str(row.level),
    status: toStatus(row.status),
    durationDays: num(row.duration_days),
    expiresAt: isoDate(row.expires_at),
    activatedAt: isoDate(row.activated_at),
    createdAt: requiredIsoDate(row.created_at),
  };
}

export type LicenseWithSecret = License & { keyCiphertext: string | null };

function rowToLicenseWithSecret(row: SqlRow): LicenseWithSecret {
  return { ...rowToLicense(row), keyCiphertext: optionalStr(row.key_ciphertext) };
}

const COLUMNS = `id, order_id, product_id, discord_user_id, key_prefix, level, status,
                 duration_days, expires_at, activated_at, created_at, key_ciphertext`;

export type InsertLicenseInput = {
  orderId: string;
  productId: number;
  userId: string;
  keyHash: string;
  keyPrefix: string;
  keyCiphertext: string | null;
  level: string;
  durationDays: number;
  expiresAt: string | null;
  notes: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Insere a licença do pedido de forma IDEMPOTENTE.
 *
 * O índice único parcial `fmm_license_keys(order_id)` garante uma única chave
 * por pedido: duas execuções concorrentes do fulfillment não geram duas chaves;
 * a segunda cai no `ON CONFLICT DO NOTHING` e retorna vazio.
 */
export async function insertLicenseForOrder(input: InsertLicenseInput): Promise<License | null> {
  const metadata = JSON.stringify(input.metadata ?? {});
  const rows = await paymentsSql`
    INSERT INTO fmm_license_keys (
      key_hash, key_prefix, key_ciphertext, level, duration_days, expires_at,
      notes, discord_user_id, order_id, product_id, status, metadata
    ) VALUES (
      ${input.keyHash}, ${input.keyPrefix}, ${input.keyCiphertext}, ${input.level},
      ${input.durationDays}, ${input.expiresAt}::timestamptz, ${input.notes},
      ${input.userId}, ${input.orderId}::uuid, ${input.productId}, 'ACTIVE', ${metadata}::jsonb
    )
    ON CONFLICT (order_id) WHERE order_id IS NOT NULL DO NOTHING
    RETURNING id, order_id, product_id, discord_user_id, key_prefix, level, status,
              duration_days, expires_at, activated_at, created_at, key_ciphertext`;
  return rows[0] ? rowToLicense(rows[0]) : null;
}

export async function findLicenseByOrder(orderId: string): Promise<LicenseWithSecret | null> {
  const rows = await paymentsSql`
    SELECT id, order_id, product_id, discord_user_id, key_prefix, level, status,
           duration_days, expires_at, activated_at, created_at, key_ciphertext
      FROM fmm_license_keys WHERE order_id = ${orderId}::uuid LIMIT 1`;
  return rows[0] ? rowToLicenseWithSecret(rows[0]) : null;
}

export async function findLicenseById(id: string): Promise<LicenseWithSecret | null> {
  const rows = await paymentsSql`
    SELECT id, order_id, product_id, discord_user_id, key_prefix, level, status,
           duration_days, expires_at, activated_at, created_at, key_ciphertext
      FROM fmm_license_keys WHERE id = ${id} LIMIT 1`;
  return rows[0] ? rowToLicenseWithSecret(rows[0]) : null;
}

export async function listLicensesByUser(userId: string): Promise<LicenseWithSecret[]> {
  const rows = await paymentsSql`
    SELECT id, order_id, product_id, discord_user_id, key_prefix, level, status,
           duration_days, expires_at, activated_at, created_at, key_ciphertext
      FROM fmm_license_keys
     WHERE discord_user_id = ${userId}
     ORDER BY created_at DESC`;
  return rows.map(rowToLicenseWithSecret);
}

/**
 * Reembolso/chargeback NUNCA apaga licença — só muda o estado.
 * `is_active` acompanha para que fmm-activate/fmm-validate (que leem a coluna
 * antiga) continuem coerentes com o novo `status`.
 */
export async function setLicenseStatus(id: string, status: LicenseStatus): Promise<License | null> {
  const active = status === 'ACTIVE';
  const rows = await paymentsSql`
    UPDATE fmm_license_keys
       SET status = ${status}, is_active = ${active}
     WHERE id = ${id} AND status <> ${status}
    RETURNING id, order_id, product_id, discord_user_id, key_prefix, level, status,
              duration_days, expires_at, activated_at, created_at, key_ciphertext`;
  return rows[0] ? rowToLicense(rows[0]) : null;
}

/** Renovação aprovada ESTENDE a validade a partir da maior data entre hoje e a atual. */
export async function extendLicense(id: string, days: number): Promise<License | null> {
  const rows = await paymentsSql`
    UPDATE fmm_license_keys
       SET expires_at = GREATEST(COALESCE(expires_at, now()), now()) + (${days} || ' days')::interval,
           status = CASE WHEN status = 'EXPIRED' THEN 'ACTIVE' ELSE status END,
           is_active = CASE WHEN status IN ('REVOKED','SUSPENDED') THEN is_active ELSE true END
     WHERE id = ${id}
    RETURNING id, order_id, product_id, discord_user_id, key_prefix, level, status,
              duration_days, expires_at, activated_at, created_at, key_ciphertext`;
  return rows[0] ? rowToLicense(rows[0]) : null;
}

export { COLUMNS as LICENSE_COLUMNS };
