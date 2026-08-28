-- Perfil reutilizável do pagador. Nome e e-mail são os únicos PII consultáveis;
-- CPF/CNPJ, telefone e endereço ficam exclusivamente no envelope AES-256-GCM.
CREATE TABLE IF NOT EXISTS payer_profiles (
  user_id              text PRIMARY KEY,
  first_name           text NOT NULL,
  last_name            text NOT NULL,
  email                text NOT NULL,
  sensitive_ciphertext text NOT NULL,
  cipher_version       integer NOT NULL DEFAULT 1,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
