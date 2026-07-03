CREATE TABLE IF NOT EXISTS dashboard_sessions (
  session_id_hash text PRIMARY KEY,
  discord_user_id text NOT NULL,
  access_token_ciphertext text NOT NULL,
  refresh_token_ciphertext text,
  granted_scopes text[] NOT NULL DEFAULT '{}',
  token_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS dashboard_sessions_user_idx
  ON dashboard_sessions(discord_user_id, revoked_at);

CREATE INDEX IF NOT EXISTS dashboard_sessions_expiry_idx
  ON dashboard_sessions(token_expires_at)
  WHERE revoked_at IS NULL;
