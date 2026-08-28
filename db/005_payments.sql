-- db/005_payments.sql — Módulo de pagamentos (Mercado Pago) + licenças FMM.
--
-- Aplicar no BANCO DO SITE (NETLIFY_DATABASE_URL / DATABASE_URL), que é o mesmo
-- usado por lib/fmm-license.ts e lib/dashboard/siteDb.ts.
--
--   psql "$NETLIFY_DATABASE_URL" -f db/005_payments.sql
--
-- A migração é idempotente: pode ser reaplicada sem efeito colateral.

-- ---------------------------------------------------------------- catálogo --
-- O BANCO é a fonte de verdade de preço. O frontend nunca envia valor.
CREATE TABLE IF NOT EXISTS products (
  id                 bigserial PRIMARY KEY,
  code               text NOT NULL UNIQUE,          -- 'fmm-basic-monthly'
  family             text NOT NULL,                 -- 'fmm'
  name               text NOT NULL,
  description        text,
  -- Preço SEMPRE em centavos inteiros. Nunca float.
  price_cents        bigint NOT NULL CHECK (price_cents >= 0),
  currency           text NOT NULL DEFAULT 'BRL',
  -- 'lifetime' nunca oferece recorrência; 'subscription_eligible' decide o resto.
  is_lifetime        boolean NOT NULL DEFAULT false,
  recurring_eligible boolean NOT NULL DEFAULT false,
  recurring_interval text,                          -- 'months' | 'days'
  recurring_frequency integer,                      -- 1, 3, ...
  duration_days      integer,                       -- validade da licença entregue
  -- Como o pedido é entregue. 'fmm_license' aciona o FmmLicenseService.
  fulfillment_kind   text NOT NULL DEFAULT 'none',
  fulfillment_ref    text,                          -- ex.: nível da licença ('basic'|'pro')
  active             boolean NOT NULL DEFAULT true,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_lifetime_not_recurring
    CHECK (NOT (is_lifetime AND recurring_eligible))
);

CREATE INDEX IF NOT EXISTS products_family_idx ON products(family, active);

-- ----------------------------------------------------------------- pedidos --
CREATE TABLE IF NOT EXISTS orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference        text NOT NULL UNIQUE,            -- external_reference do provider
  user_id          text NOT NULL,                   -- discord_user_id (sessão)
  user_email       text NOT NULL,
  product_id       bigint NOT NULL REFERENCES products(id),
  product_code     text NOT NULL,
  quantity         integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  amount_cents     bigint NOT NULL CHECK (amount_cents >= 0),
  currency         text NOT NULL DEFAULT 'BRL',
  status           text NOT NULL DEFAULT 'PENDING',
  auto_renew       boolean NOT NULL DEFAULT false,
  -- Impede pedido duplicado por duplo clique/refresh (mesma chave = mesmo pedido).
  idempotency_key  text,
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  paid_at          timestamptz,
  fulfilled_at     timestamptz,
  CONSTRAINT orders_status_check CHECK (status IN (
    'PENDING','PROCESSING','PAID','DECLINED','FAILED','CANCELLED',
    'EXPIRED','REFUNDED','PARTIALLY_REFUNDED','CHARGEBACK'
  ))
);

CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_uq
  ON orders(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id, created_at DESC);

-- -------------------------------------------------------------- pagamentos --
CREATE TABLE IF NOT EXISTS payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  user_id             text NOT NULL,
  provider            text NOT NULL,                -- 'mercadopago'
  provider_payment_id text,                         -- id da Order/preapproval no provider
  provider_txn_id     text,                         -- id do payment dentro da Order
  method              text NOT NULL,                -- 'pix'|'card'|'boleto'|'subscription'
  amount_cents        bigint NOT NULL CHECK (amount_cents >= 0),
  currency            text NOT NULL DEFAULT 'BRL',
  status              text NOT NULL DEFAULT 'PENDING',
  status_detail       text,
  installments        integer NOT NULL DEFAULT 1 CHECK (installments >= 1),
  refunded_cents      bigint NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0),
  idempotency_key     text NOT NULL,
  -- Dados NÃO sensíveis do meio de pagamento + payload de exibição (QR, boleto).
  details             jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  paid_at             timestamptz,
  CONSTRAINT payments_status_check CHECK (status IN (
    'PENDING','PROCESSING','PAID','DECLINED','FAILED','CANCELLED',
    'EXPIRED','REFUNDED','PARTIALLY_REFUNDED','CHARGEBACK'
  ))
);

-- Chave de idempotência da tentativa: um duplo clique reaproveita o mesmo registro.
CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_key_uq
  ON payments(idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_uq
  ON payments(provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments(user_id, created_at DESC);

-- ------------------------------------------------------- meios de pagamento --
-- NUNCA guarda PAN completo nem CVV. Só bandeira, últimos 4, validade e a
-- referência opaca do provider (customer/card id).
CREATE TABLE IF NOT EXISTS payment_methods (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            text NOT NULL,
  provider           text NOT NULL,
  provider_customer_id text,
  provider_method_id text,
  kind               text NOT NULL DEFAULT 'card',
  brand              text,
  last_four          text CHECK (last_four IS NULL OR last_four ~ '^[0-9]{4}$'),
  exp_month          integer CHECK (exp_month IS NULL OR (exp_month BETWEEN 1 AND 12)),
  exp_year           integer CHECK (exp_year IS NULL OR exp_year BETWEEN 2000 AND 2100),
  holder_name        text,
  is_default         boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

CREATE INDEX IF NOT EXISTS payment_methods_user_idx ON payment_methods(user_id) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------- assinaturas ----
CREATE TABLE IF NOT EXISTS subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  text NOT NULL,
  product_id               bigint NOT NULL REFERENCES products(id),
  order_id                 uuid REFERENCES orders(id),
  provider                 text NOT NULL,
  provider_subscription_id text,
  payment_method_id        uuid REFERENCES payment_methods(id),
  amount_cents             bigint NOT NULL CHECK (amount_cents >= 0),
  currency                 text NOT NULL DEFAULT 'BRL',
  interval_unit            text NOT NULL DEFAULT 'months',
  interval_count           integer NOT NULL DEFAULT 1 CHECK (interval_count >= 1),
  status                   text NOT NULL DEFAULT 'PENDING',
  auto_renew               boolean NOT NULL DEFAULT true,
  next_billing_date        timestamptz,
  license_id               bigint,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  cancelled_at             timestamptz,
  CONSTRAINT subscriptions_status_check CHECK (status IN (
    'PENDING','ACTIVE','PAUSED','PAST_DUE','CANCELLED','EXPIRED'
  ))
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_uq
  ON subscriptions(provider, provider_subscription_id) WHERE provider_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions(user_id, created_at DESC);

-- ------------------------------------------------------ eventos/auditoria ---
-- Serve para (a) auditoria e (b) deduplicação de webhooks e renovações.
CREATE TABLE IF NOT EXISTS payment_events (
  id            bigserial PRIMARY KEY,
  provider      text NOT NULL,
  -- Identidade do evento no provider. UNIQUE = webhook repetido não reprocessa.
  event_key     text NOT NULL,
  event_type    text NOT NULL,
  payment_id    uuid REFERENCES payments(id),
  order_id      uuid REFERENCES orders(id),
  subscription_id uuid REFERENCES subscriptions(id),
  status        text NOT NULL DEFAULT 'RECEIVED',
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_events_provider_key_uq
  ON payment_events(provider, event_key);
CREATE INDEX IF NOT EXISTS payment_events_order_idx ON payment_events(order_id, created_at DESC);

-- ------------------------------------------------------- e-mails enviados ---
-- Deduplicação de e-mail financeiro: um evento nunca gera dois envios.
CREATE TABLE IF NOT EXISTS email_dispatches (
  id           bigserial PRIMARY KEY,
  dedupe_key   text NOT NULL UNIQUE,
  template     text NOT NULL,
  recipient    text NOT NULL,
  order_id     uuid REFERENCES orders(id),
  status       text NOT NULL DEFAULT 'PENDING',   -- PENDING|SENT|FAILED
  provider_id  text,
  error        text,
  attempts     integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_dispatches_status_idx ON email_dispatches(status, created_at);

-- ------------------------------------------------- licenças FMM (reuso) -----
-- A tabela já existe em produção (criada pelo fluxo antigo). Aqui só somamos o
-- que o módulo de pagamentos precisa, sem quebrar fmm-activate/validate/revoke.
CREATE TABLE IF NOT EXISTS fmm_license_keys (
  id            bigserial PRIMARY KEY,
  key_hash      text NOT NULL,
  key_prefix    text NOT NULL,
  level         text NOT NULL,
  duration_days integer NOT NULL,
  expires_at    timestamptz,
  notes         text,
  discord_user_id text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fmm_license_keys
  ADD COLUMN IF NOT EXISTS order_id       uuid,
  ADD COLUMN IF NOT EXISTS product_id     bigint,
  ADD COLUMN IF NOT EXISTS status         text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS activated_at   timestamptz,
  -- Cópia cifrada (AES-256-GCM) da chave, para o cliente reexibi-la no painel.
  -- O e-mail nunca é o único lugar onde a licença existe.
  ADD COLUMN IF NOT EXISTS key_ciphertext text,
  ADD COLUMN IF NOT EXISTS metadata       jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE fmm_license_keys
    ADD CONSTRAINT fmm_license_keys_status_check
    CHECK (status IN ('ACTIVE','EXPIRED','SUSPENDED','REVOKED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE fmm_license_keys
    ADD CONSTRAINT fmm_license_keys_order_fk
    FOREIGN KEY (order_id) REFERENCES orders(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- key UNIQUE (via hash: a chave crua nunca é indexada em claro).
CREATE UNIQUE INDEX IF NOT EXISTS fmm_license_keys_key_hash_uq
  ON fmm_license_keys(key_hash);

-- REGRA CENTRAL: uma compra que entrega uma licença NUNCA recebe duas chaves.
CREATE UNIQUE INDEX IF NOT EXISTS fmm_license_keys_order_uq
  ON fmm_license_keys(order_id) WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS fmm_license_keys_user_idx
  ON fmm_license_keys(discord_user_id, created_at DESC);

-- ------------------------------------------------------------- catálogo -----
-- Preços em centavos, espelhando os planos já anunciados em FmmPlans.tsx.
-- ON CONFLICT DO NOTHING: reaplicar a migração não sobrescreve preço ajustado
-- depois no banco (o banco é a fonte de verdade, não este arquivo).
INSERT INTO products (
  code, family, name, price_cents, currency, is_lifetime, recurring_eligible,
  recurring_interval, recurring_frequency, duration_days, fulfillment_kind, fulfillment_ref
) VALUES
  ('fmm-basic-monthly',   'fmm', 'FMM Básico — Mensal',      1500,  'BRL', false, true,  'months', 1,  30,    'fmm_license', 'basic'),
  ('fmm-basic-quarterly', 'fmm', 'FMM Básico — Trimestral',  4000,  'BRL', false, true,  'months', 3,  90,    'fmm_license', 'basic'),
  ('fmm-basic-lifetime',  'fmm', 'FMM Básico — Vitalício',   8000,  'BRL', true,  false, NULL,     NULL, 36500, 'fmm_license', 'basic'),
  ('fmm-pro-monthly',     'fmm', 'FMM Pro — Mensal',         3500,  'BRL', false, true,  'months', 1,  30,    'fmm_license', 'pro'),
  ('fmm-pro-quarterly',   'fmm', 'FMM Pro — Trimestral',     10000, 'BRL', false, true,  'months', 3,  90,    'fmm_license', 'pro'),
  ('fmm-pro-lifetime',    'fmm', 'FMM Pro — Vitalício',      20000, 'BRL', true,  false, NULL,     NULL, 36500, 'fmm_license', 'pro')
ON CONFLICT (code) DO NOTHING;
