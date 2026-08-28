/**
 * Deduplicação de e-mail financeiro.
 *
 * O INSERT com `ON CONFLICT DO NOTHING` é a trava: dois caminhos concorrentes
 * (webhook + reconciliação, por exemplo) que tentem o mesmo e-mail só rendem
 * um envio, porque só um deles ganha a linha.
 */

import { paymentsSql, str } from '../infrastructure/db';

export type ClaimEmailInput = {
  dedupeKey: string;
  template: string;
  recipient: string;
  orderId?: string | null;
};

export type ClaimedEmail = { id: number; dedupeKey: string };

/** Retorna `null` quando o e-mail já foi reivindicado (não reenviar). */
export async function claimEmail(input: ClaimEmailInput): Promise<ClaimedEmail | null> {
  const rows = await paymentsSql`
    INSERT INTO email_dispatches (dedupe_key, template, recipient, order_id, status, attempts)
    VALUES (${input.dedupeKey}, ${input.template}, ${input.recipient},
            ${input.orderId ?? null}::uuid, 'PENDING', 1)
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING id, dedupe_key`;
  const row = rows[0];
  return row ? { id: Number(row.id), dedupeKey: str(row.dedupe_key) } : null;
}

export async function markEmailSent(id: number, providerId: string | null): Promise<void> {
  await paymentsSql`
    UPDATE email_dispatches
       SET status = 'SENT', provider_id = ${providerId}, updated_at = now()
     WHERE id = ${id}`;
}

/**
 * Marca a falha MANTENDO a linha: o pedido e a licença seguem válidos, e o
 * envio pode ser retentado depois por `retryEmail`.
 */
export async function markEmailFailed(id: number, error: string): Promise<void> {
  await paymentsSql`
    UPDATE email_dispatches
       SET status = 'FAILED', error = ${error.slice(0, 1000)}, updated_at = now()
     WHERE id = ${id}`;
}

/** Reabre um envio que falhou, para reenvio manual/administrativo. */
export async function reopenFailedEmail(dedupeKey: string): Promise<ClaimedEmail | null> {
  const rows = await paymentsSql`
    UPDATE email_dispatches
       SET status = 'PENDING', attempts = attempts + 1, updated_at = now()
     WHERE dedupe_key = ${dedupeKey} AND status = 'FAILED'
    RETURNING id, dedupe_key`;
  const row = rows[0];
  return row ? { id: Number(row.id), dedupeKey: str(row.dedupe_key) } : null;
}

export async function listFailedEmails(limit = 50): Promise<Array<{ id: number; dedupeKey: string; template: string; recipient: string }>> {
  const rows = await paymentsSql`
    SELECT id, dedupe_key, template, recipient FROM email_dispatches
     WHERE status = 'FAILED' ORDER BY updated_at DESC LIMIT ${limit}`;
  return rows.map((row) => ({
    id: Number(row.id),
    dedupeKey: str(row.dedupe_key),
    template: str(row.template),
    recipient: str(row.recipient),
  }));
}
