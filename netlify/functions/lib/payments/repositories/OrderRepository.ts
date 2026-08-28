import type { Cents } from '../domain/money';
import type { Order, PaymentStatus } from '../domain/types';
import { isPaymentStatus } from '../domain/types';
import {
  bool,
  isoDate,
  json,
  num,
  optionalStr,
  paymentsSql,
  requiredIsoDate,
  str,
} from '../infrastructure/db';
import type { SqlRow } from '../infrastructure/db';

export function rowToOrder(row: SqlRow): Order {
  const status = str(row.status);
  return {
    id: str(row.id),
    reference: str(row.reference),
    userId: str(row.user_id),
    userEmail: str(row.user_email),
    productId: num(row.product_id),
    productCode: str(row.product_code),
    quantity: num(row.quantity, 1),
    amountCents: num(row.amount_cents),
    currency: str(row.currency) || 'BRL',
    status: isPaymentStatus(status) ? status : 'PENDING',
    autoRenew: bool(row.auto_renew),
    idempotencyKey: optionalStr(row.idempotency_key),
    metadata: json(row.metadata),
    createdAt: requiredIsoDate(row.created_at),
    paidAt: isoDate(row.paid_at),
    fulfilledAt: isoDate(row.fulfilled_at),
  };
}

const SELECT = `id, reference, user_id, user_email, product_id, product_code, quantity,
                amount_cents, currency, status, auto_renew, idempotency_key, metadata,
                created_at, paid_at, fulfilled_at`;

export type CreateOrderInput = {
  reference: string;
  userId: string;
  userEmail: string;
  productId: number;
  productCode: string;
  quantity: number;
  amountCents: Cents;
  currency: string;
  autoRenew: boolean;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

/**
 * Cria o pedido de forma idempotente: um duplo clique com a mesma chave devolve
 * o pedido já existente em vez de abrir outro (índice único user_id+chave).
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const metadata = JSON.stringify(input.metadata ?? {});
  const rows = await paymentsSql`
    INSERT INTO orders (
      reference, user_id, user_email, product_id, product_code, quantity,
      amount_cents, currency, status, auto_renew, idempotency_key, metadata
    ) VALUES (
      ${input.reference}, ${input.userId}, ${input.userEmail}, ${input.productId},
      ${input.productCode}, ${input.quantity}, ${input.amountCents}, ${input.currency},
      'PENDING', ${input.autoRenew}, ${input.idempotencyKey}, ${metadata}::jsonb
    )
    ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL
    DO UPDATE SET updated_at = now()
    RETURNING id, reference, user_id, user_email, product_id, product_code, quantity,
              amount_cents, currency, status, auto_renew, idempotency_key, metadata,
              created_at, paid_at, fulfilled_at`;
  return rowToOrder(rows[0]);
}

export async function findOrderById(id: string): Promise<Order | null> {
  const rows = await paymentsSql`
    SELECT id, reference, user_id, user_email, product_id, product_code, quantity,
           amount_cents, currency, status, auto_renew, idempotency_key, metadata,
           created_at, paid_at, fulfilled_at
      FROM orders WHERE id = ${id} LIMIT 1`;
  return rows[0] ? rowToOrder(rows[0]) : null;
}

export async function findOrderByReference(reference: string): Promise<Order | null> {
  const rows = await paymentsSql`
    SELECT id, reference, user_id, user_email, product_id, product_code, quantity,
           amount_cents, currency, status, auto_renew, idempotency_key, metadata,
           created_at, paid_at, fulfilled_at
      FROM orders WHERE reference = ${reference} LIMIT 1`;
  return rows[0] ? rowToOrder(rows[0]) : null;
}

export async function listOrdersByUser(userId: string, limit = 50): Promise<Order[]> {
  const rows = await paymentsSql`
    SELECT id, reference, user_id, user_email, product_id, product_code, quantity,
           amount_cents, currency, status, auto_renew, idempotency_key, metadata,
           created_at, paid_at, fulfilled_at
      FROM orders WHERE user_id = ${userId}
     ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map(rowToOrder);
}

/**
 * Marca o pedido como pago SOMENTE se ele ainda não estava pago.
 * `RETURNING` vazio = já estava PAID, e o caller trata como "nada a fazer" —
 * é essa condição que impede um webhook repetido de reentregar a licença.
 */
export async function markOrderPaid(orderId: string, paidAt: string): Promise<Order | null> {
  const rows = await paymentsSql`
    UPDATE orders
       SET status = 'PAID', paid_at = COALESCE(paid_at, ${paidAt}::timestamptz), updated_at = now()
     WHERE id = ${orderId} AND status <> 'PAID'
    RETURNING id, reference, user_id, user_email, product_id, product_code, quantity,
              amount_cents, currency, status, auto_renew, idempotency_key, metadata,
              created_at, paid_at, fulfilled_at`;
  return rows[0] ? rowToOrder(rows[0]) : null;
}

export async function updateOrderStatus(orderId: string, status: PaymentStatus): Promise<Order | null> {
  const rows = await paymentsSql`
    UPDATE orders SET status = ${status}, updated_at = now()
     WHERE id = ${orderId} AND status <> ${status}
    RETURNING id, reference, user_id, user_email, product_id, product_code, quantity,
              amount_cents, currency, status, auto_renew, idempotency_key, metadata,
              created_at, paid_at, fulfilled_at`;
  return rows[0] ? rowToOrder(rows[0]) : null;
}

export async function markOrderFulfilled(orderId: string): Promise<void> {
  await paymentsSql`
    UPDATE orders SET fulfilled_at = COALESCE(fulfilled_at, now()), updated_at = now()
     WHERE id = ${orderId}`;
}

export { SELECT as ORDER_COLUMNS };
