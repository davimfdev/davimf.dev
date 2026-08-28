import type { Cents } from '../domain/money';
import type { Subscription, SubscriptionStatus } from '../domain/types';
import { SUBSCRIPTION_STATUSES } from '../domain/types';
import {
  bool,
  isoDate,
  num,
  optionalNum,
  optionalStr,
  paymentsSql,
  requiredIsoDate,
  str,
} from '../infrastructure/db';
import type { SqlRow } from '../infrastructure/db';

function toStatus(value: unknown): SubscriptionStatus {
  const raw = str(value);
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(raw)
    ? (raw as SubscriptionStatus)
    : 'PENDING';
}

export function rowToSubscription(row: SqlRow): Subscription {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    productId: num(row.product_id),
    orderId: optionalStr(row.order_id),
    provider: str(row.provider),
    providerSubscriptionId: optionalStr(row.provider_subscription_id),
    paymentMethodId: optionalStr(row.payment_method_id),
    amountCents: num(row.amount_cents),
    currency: str(row.currency) || 'BRL',
    intervalUnit: str(row.interval_unit) || 'months',
    intervalCount: num(row.interval_count, 1),
    status: toStatus(row.status),
    autoRenew: bool(row.auto_renew),
    nextBillingDate: isoDate(row.next_billing_date),
    licenseId: optionalNum(row.license_id),
    createdAt: requiredIsoDate(row.created_at),
    cancelledAt: isoDate(row.cancelled_at),
  };
}

const COLUMNS = `id, user_id, product_id, order_id, provider, provider_subscription_id,
                 payment_method_id, amount_cents, currency, interval_unit, interval_count,
                 status, auto_renew, next_billing_date, license_id, created_at, cancelled_at`;

export type CreateSubscriptionRowInput = {
  userId: string;
  productId: number;
  orderId: string | null;
  provider: string;
  providerSubscriptionId: string | null;
  paymentMethodId: string | null;
  amountCents: Cents;
  currency: string;
  intervalUnit: string;
  intervalCount: number;
  status: SubscriptionStatus;
  autoRenew: boolean;
  nextBillingDate: string | null;
  licenseId: number | null;
};

export async function createSubscription(input: CreateSubscriptionRowInput): Promise<Subscription> {
  const rows = await paymentsSql`
    INSERT INTO subscriptions (
      user_id, product_id, order_id, provider, provider_subscription_id,
      payment_method_id, amount_cents, currency, interval_unit, interval_count,
      status, auto_renew, next_billing_date, license_id
    ) VALUES (
      ${input.userId}, ${input.productId}, ${input.orderId}::uuid, ${input.provider},
      ${input.providerSubscriptionId}, ${input.paymentMethodId}::uuid, ${input.amountCents},
      ${input.currency}, ${input.intervalUnit}, ${input.intervalCount}, ${input.status},
      ${input.autoRenew}, ${input.nextBillingDate}::timestamptz, ${input.licenseId}
    )
    ON CONFLICT (provider, provider_subscription_id)
      WHERE provider_subscription_id IS NOT NULL
      DO UPDATE SET status = EXCLUDED.status, updated_at = now()
    RETURNING id, user_id, product_id, order_id, provider, provider_subscription_id,
              payment_method_id, amount_cents, currency, interval_unit, interval_count,
              status, auto_renew, next_billing_date, license_id, created_at, cancelled_at`;
  return rowToSubscription(rows[0]);
}

export async function findSubscriptionByProviderId(
  provider: string,
  providerSubscriptionId: string,
): Promise<Subscription | null> {
  const rows = await paymentsSql`
    SELECT id, user_id, product_id, order_id, provider, provider_subscription_id,
           payment_method_id, amount_cents, currency, interval_unit, interval_count,
           status, auto_renew, next_billing_date, license_id, created_at, cancelled_at
      FROM subscriptions
     WHERE provider = ${provider} AND provider_subscription_id = ${providerSubscriptionId}
     LIMIT 1`;
  return rows[0] ? rowToSubscription(rows[0]) : null;
}

export async function findSubscriptionById(id: string): Promise<Subscription | null> {
  const rows = await paymentsSql`
    SELECT id, user_id, product_id, order_id, provider, provider_subscription_id,
           payment_method_id, amount_cents, currency, interval_unit, interval_count,
           status, auto_renew, next_billing_date, license_id, created_at, cancelled_at
      FROM subscriptions WHERE id = ${id} LIMIT 1`;
  return rows[0] ? rowToSubscription(rows[0]) : null;
}

export async function listSubscriptionsByUser(userId: string): Promise<Subscription[]> {
  const rows = await paymentsSql`
    SELECT id, user_id, product_id, order_id, provider, provider_subscription_id,
           payment_method_id, amount_cents, currency, interval_unit, interval_count,
           status, auto_renew, next_billing_date, license_id, created_at, cancelled_at
      FROM subscriptions WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return rows.map(rowToSubscription);
}

export async function updateSubscriptionStatus(
  id: string,
  status: SubscriptionStatus,
  nextBillingDate?: string | null,
): Promise<Subscription | null> {
  const rows = await paymentsSql`
    UPDATE subscriptions
       SET status = ${status},
           next_billing_date = COALESCE(${nextBillingDate ?? null}::timestamptz, next_billing_date),
           updated_at = now()
     WHERE id = ${id}
    RETURNING id, user_id, product_id, order_id, provider, provider_subscription_id,
              payment_method_id, amount_cents, currency, interval_unit, interval_count,
              status, auto_renew, next_billing_date, license_id, created_at, cancelled_at`;
  return rows[0] ? rowToSubscription(rows[0]) : null;
}

/**
 * Cancelamento PRESERVA histórico: só desliga auto_renew e carimba a data.
 * Nenhuma linha é apagada — nem a assinatura, nem os pagamentos, nem a licença.
 */
export async function cancelSubscription(id: string): Promise<Subscription | null> {
  const rows = await paymentsSql`
    UPDATE subscriptions
       SET status = 'CANCELLED', auto_renew = false,
           cancelled_at = COALESCE(cancelled_at, now()), updated_at = now()
     WHERE id = ${id} AND status <> 'CANCELLED'
    RETURNING id, user_id, product_id, order_id, provider, provider_subscription_id,
              payment_method_id, amount_cents, currency, interval_unit, interval_count,
              status, auto_renew, next_billing_date, license_id, created_at, cancelled_at`;
  return rows[0] ? rowToSubscription(rows[0]) : null;
}

export { COLUMNS as SUBSCRIPTION_COLUMNS };
