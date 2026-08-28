/**
 * Catálogo. O BANCO é a fonte de verdade de preço — o frontend nunca envia
 * valor, só o código do produto.
 */

import type { Product } from '../domain/types';
import { bool, num, optionalNum, optionalStr, paymentsSql, str } from '../infrastructure/db';
import type { SqlRow } from '../infrastructure/db';

export function rowToProduct(row: SqlRow): Product {
  return {
    id: num(row.id),
    code: str(row.code),
    family: str(row.family),
    name: str(row.name),
    description: optionalStr(row.description),
    priceCents: num(row.price_cents),
    currency: str(row.currency) || 'BRL',
    isLifetime: bool(row.is_lifetime),
    recurringEligible: bool(row.recurring_eligible),
    recurringInterval: optionalStr(row.recurring_interval),
    recurringFrequency: optionalNum(row.recurring_frequency),
    durationDays: optionalNum(row.duration_days),
    fulfillmentKind: str(row.fulfillment_kind) || 'none',
    fulfillmentRef: optionalStr(row.fulfillment_ref),
    active: bool(row.active),
  };
}

const COLUMNS = `id, code, family, name, description, price_cents, currency,
                 is_lifetime, recurring_eligible, recurring_interval, recurring_frequency,
                 duration_days, fulfillment_kind, fulfillment_ref, active`;

export async function findProductByCode(code: string): Promise<Product | null> {
  const rows = await paymentsSql`
    SELECT id, code, family, name, description, price_cents, currency,
           is_lifetime, recurring_eligible, recurring_interval, recurring_frequency,
           duration_days, fulfillment_kind, fulfillment_ref, active
      FROM products
     WHERE code = ${code}
     LIMIT 1`;
  return rows[0] ? rowToProduct(rows[0]) : null;
}

export async function listActiveProducts(family?: string): Promise<Product[]> {
  const rows = family
    ? await paymentsSql`
        SELECT id, code, family, name, description, price_cents, currency,
               is_lifetime, recurring_eligible, recurring_interval, recurring_frequency,
               duration_days, fulfillment_kind, fulfillment_ref, active
          FROM products
         WHERE active = true AND family = ${family}
         ORDER BY price_cents ASC`
    : await paymentsSql`
        SELECT id, code, family, name, description, price_cents, currency,
               is_lifetime, recurring_eligible, recurring_interval, recurring_frequency,
               duration_days, fulfillment_kind, fulfillment_ref, active
          FROM products
         WHERE active = true
         ORDER BY family ASC, price_cents ASC`;
  return rows.map(rowToProduct);
}

export { COLUMNS as PRODUCT_COLUMNS };
