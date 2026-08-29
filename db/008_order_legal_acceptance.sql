-- Qual versão dos documentos o cliente aceitou, e o hash do texto exato.
-- Sem isto, um pedido contestado não tem como provar QUAL contrato valia.
-- Os hashes vêm sempre da nossa própria cópia; o cliente só informa a versão.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS legal_version        text,
  ADD COLUMN IF NOT EXISTS legal_accepted_at    timestamptz,
  ADD COLUMN IF NOT EXISTS terms_hash           text,
  ADD COLUMN IF NOT EXISTS privacy_policy_hash  text,
  ADD COLUMN IF NOT EXISTS refund_policy_hash   text;
