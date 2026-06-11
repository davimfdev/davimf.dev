-- db/001_tickets.sql — run once in the Neon SQL console for the tickets database.
CREATE TABLE IF NOT EXISTS tickets (
  id            TEXT PRIMARY KEY,
  source        TEXT        NOT NULL,
  guild_name    TEXT        NOT NULL,
  channel_name  TEXT        NOT NULL,
  salt_key      TEXT        NOT NULL,
  salt_hash     TEXT        NOT NULL,
  iv            TEXT        NOT NULL,
  ciphertext    TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  iterations    INTEGER     NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tickets_created_at_idx ON tickets (created_at DESC);
