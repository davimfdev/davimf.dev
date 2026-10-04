-- $elfControl: idempotência e rate limit. Aplicar no banco `selfcontrol`.

-- A linha só existe quando a operação TERMINOU: é gravada na mesma transação da
-- escrita, sob pg_advisory_xact_lock. Não há estado intermediário.
CREATE TABLE idempotency_keys (
    key             TEXT NOT NULL,
    user_id         UUID NOT NULL REFERENCES users(id),
    endpoint        TEXT NOT NULL,
    request_hash    TEXT NOT NULL,
    response_status INTEGER NOT NULL,
    response_body   JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, endpoint, key)
);

-- Janela fixa: o início da janela faz parte do bucket, então o contador expira sozinho.
CREATE TABLE rate_limits (
    bucket       TEXT PRIMARY KEY,
    hits         INTEGER NOT NULL DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_idempotency_created ON idempotency_keys(created_at);
CREATE INDEX idx_rate_limits_window  ON rate_limits(window_start);
