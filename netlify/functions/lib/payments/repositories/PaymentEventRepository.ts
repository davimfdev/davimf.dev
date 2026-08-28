/**
 * Trilha de eventos: auditoria + deduplicação.
 *
 * A dedup é feita pelo INSERT: o índice único (provider, event_key) faz o
 * segundo INSERT do MESMO evento não retornar linha nenhuma. Nenhuma leitura
 * prévia — duas requisições simultâneas com o mesmo evento não passam as duas.
 */

import { json, paymentsSql, requiredIsoDate, str } from '../infrastructure/db';

export type PaymentEvent = {
  id: number;
  provider: string;
  eventKey: string;
  eventType: string;
  status: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type RecordEventInput = {
  provider: string;
  eventKey: string;
  eventType: string;
  orderId?: string | null;
  paymentId?: string | null;
  subscriptionId?: string | null;
  payload?: Record<string, unknown>;
};

/**
 * Registra o evento. Retorna `null` quando ele JÁ existia — o caller deve
 * então parar: não liberar produto, não gerar licença, não renovar, não
 * reembolsar e não mandar e-mail de novo.
 */
export async function claimEvent(input: RecordEventInput): Promise<PaymentEvent | null> {
  const payload = JSON.stringify(input.payload ?? {});
  const rows = await paymentsSql`
    INSERT INTO payment_events (
      provider, event_key, event_type, order_id, payment_id, subscription_id, payload
    ) VALUES (
      ${input.provider}, ${input.eventKey}, ${input.eventType},
      ${input.orderId ?? null}::uuid, ${input.paymentId ?? null}::uuid,
      ${input.subscriptionId ?? null}::uuid, ${payload}::jsonb
    )
    ON CONFLICT (provider, event_key) DO NOTHING
    RETURNING id, provider, event_key, event_type, status, payload, created_at`;

  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    provider: str(row.provider),
    eventKey: str(row.event_key),
    eventType: str(row.event_type),
    status: str(row.status),
    payload: json(row.payload),
    createdAt: requiredIsoDate(row.created_at),
  };
}

export async function markEventProcessed(id: number, orderId?: string | null): Promise<void> {
  await paymentsSql`
    UPDATE payment_events
       SET status = 'PROCESSED', processed_at = now(),
           order_id = COALESCE(order_id, ${orderId ?? null}::uuid)
     WHERE id = ${id}`;
}

export async function markEventFailed(id: number, error: string): Promise<void> {
  // Trunca: mensagem de provider pode ser longa e não deve inflar a auditoria.
  await paymentsSql`
    UPDATE payment_events
       SET status = 'FAILED', processed_at = now(), error = ${error.slice(0, 2000)}
     WHERE id = ${id}`;
}

/**
 * Libera o evento para reprocessamento. Usado quando o handler falhou por
 * causa transitória — sem isso o retry do provider cairia na dedup e o
 * pagamento ficaria sem entrega.
 */
export async function releaseEvent(id: number): Promise<void> {
  await paymentsSql`DELETE FROM payment_events WHERE id = ${id} AND status <> 'PROCESSED'`;
}
