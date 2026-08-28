-- Pedidos de reembolso feitos PELO CLIENTE. Separado de payment_events, que
-- deduplica notificação do provider: são fatos diferentes e não podem
-- compartilhar chave de dedup.
CREATE TABLE IF NOT EXISTS refund_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES orders(id),
  user_id        text NOT NULL,
  requested_at   timestamptz NOT NULL DEFAULT now(),
  outcome        text NOT NULL,
  reason_code    text,
  description    text,
  provider_error text,
  CONSTRAINT refund_requests_outcome_ck CHECK (
    outcome IN ('refunded', 'manual', 'reconciliation_required', 'rejected')
  )
);

CREATE INDEX IF NOT EXISTS refund_requests_order_idx ON refund_requests (order_id);
CREATE INDEX IF NOT EXISTS refund_requests_user_idx  ON refund_requests (user_id, requested_at DESC);
