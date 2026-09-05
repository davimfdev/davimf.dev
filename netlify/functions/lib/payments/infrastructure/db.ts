/**
 * Acesso ao banco do módulo de pagamentos.
 *
 * Usa o MESMO banco do site (NETLIFY_DATABASE_URL/DATABASE_URL) que
 * lib/fmm-license.ts e lib/dashboard/siteDb.ts já usam - orders/payments e
 * fmm_license_keys precisam viver juntos para a entrega ser transacional.
 *
 * Conexão TCP com pool via lib/db.ts. A inicialização segue PREGUIÇOSA (mesmo
 * motivo de botDb.ts): criar o cliente no escopo do módulo faria o import
 * explodir sem env var e derrubaria os testes.
 */

import { authDbSql } from '../../db';

export type SqlRow = Record<string, unknown>;
export type PaymentsSql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<SqlRow[]>;

let override: PaymentsSql | null = null;

export const paymentsSql: PaymentsSql = (strings, ...values) =>
  override ? override(strings, ...values) : authDbSql(strings, ...values);

/** Injeção de um SQL falso nos testes. */
export function setPaymentsSqlForTesting(sql: PaymentsSql | null): void {
  override = sql;
}

// ------------------------------------------------------------ conversores --

export function str(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

export function optionalStr(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

export function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function optionalNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function bool(value: unknown): boolean {
  return value === true || value === 't' || value === 'true' || value === 1;
}

export function json(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* valor não-JSON no banco: trata como vazio em vez de derrubar a leitura */
    }
  }
  return {};
}

/** Datas voltam como Date do driver; a API sempre expõe ISO string. */
export function isoDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function requiredIsoDate(value: unknown): string {
  return isoDate(value) ?? new Date(0).toISOString();
}
