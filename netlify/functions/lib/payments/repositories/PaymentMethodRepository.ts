/**
 * Meios de pagamento salvos.
 *
 * NUNCA armazena PAN completo nem CVV - só bandeira, últimos 4, validade e a
 * referência opaca do provider.
 */

import type { StoredPaymentMethod } from '../domain/types';
import { num, optionalNum, optionalStr, paymentsSql, str } from '../infrastructure/db';
import type { SqlRow } from '../infrastructure/db';

function rowToMethod(row: SqlRow): StoredPaymentMethod {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    provider: str(row.provider),
    providerCustomerId: optionalStr(row.provider_customer_id),
    providerMethodId: optionalStr(row.provider_method_id),
    kind: str(row.kind) || 'card',
    brand: optionalStr(row.brand),
    lastFour: optionalStr(row.last_four),
    expMonth: optionalNum(row.exp_month),
    expYear: optionalNum(row.exp_year),
    holderName: optionalStr(row.holder_name),
  };
}

export type SaveMethodInput = {
  userId: string;
  provider: string;
  providerCustomerId: string | null;
  providerMethodId: string | null;
  brand: string | null;
  lastFour: string | null;
  expMonth: number | null;
  expYear: number | null;
  holderName: string | null;
};

export async function savePaymentMethod(input: SaveMethodInput): Promise<StoredPaymentMethod> {
  const rows = await paymentsSql`
    INSERT INTO payment_methods (
      user_id, provider, provider_customer_id, provider_method_id, kind,
      brand, last_four, exp_month, exp_year, holder_name
    ) VALUES (
      ${input.userId}, ${input.provider}, ${input.providerCustomerId},
      ${input.providerMethodId}, 'card', ${input.brand}, ${input.lastFour},
      ${input.expMonth}, ${input.expYear}, ${input.holderName}
    )
    RETURNING id, user_id, provider, provider_customer_id, provider_method_id, kind,
              brand, last_four, exp_month, exp_year, holder_name`;
  return rowToMethod(rows[0]);
}

export async function findMethodById(id: string): Promise<StoredPaymentMethod | null> {
  const rows = await paymentsSql`
    SELECT id, user_id, provider, provider_customer_id, provider_method_id, kind,
           brand, last_four, exp_month, exp_year, holder_name
      FROM payment_methods WHERE id = ${id} AND deleted_at IS NULL LIMIT 1`;
  return rows[0] ? rowToMethod(rows[0]) : null;
}

export async function listMethodsByUser(userId: string): Promise<StoredPaymentMethod[]> {
  const rows = await paymentsSql`
    SELECT id, user_id, provider, provider_customer_id, provider_method_id, kind,
           brand, last_four, exp_month, exp_year, holder_name
      FROM payment_methods
     WHERE user_id = ${userId} AND deleted_at IS NULL
     ORDER BY created_at DESC`;
  return rows.map(rowToMethod);
}

export async function findCustomerIdForUser(userId: string, provider: string): Promise<string | null> {
  const rows = await paymentsSql`
    SELECT provider_customer_id FROM payment_methods
     WHERE user_id = ${userId} AND provider = ${provider}
       AND provider_customer_id IS NOT NULL AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1`;
  return rows[0] ? optionalStr(rows[0].provider_customer_id) : null;
}

export async function softDeleteMethod(id: string, userId: string): Promise<boolean> {
  const rows = await paymentsSql`
    UPDATE payment_methods SET deleted_at = now()
     WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
    RETURNING id`;
  return rows.length > 0;
}

export { num };
