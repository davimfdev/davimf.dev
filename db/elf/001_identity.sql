-- $elfControl: identidade. Aplicar no banco `selfcontrol` (ELF_DATABASE_URL), nunca no davimf_dev.
--
-- As FKs compostas com user_id fazem o banco recusar referência cruzada entre
-- usuários: sem elas, o isolamento dependeria só da disciplina do código.

CREATE TABLE users (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_user_id  TEXT NOT NULL UNIQUE,
    display_name     TEXT,
    avatar_url       TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE devices (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id),
    name         TEXT NOT NULL,
    platform     VARCHAR(16) NOT NULL CHECK (platform IN ('web','desktop','android')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at   TIMESTAMPTZ,

    CONSTRAINT devices_id_user_unique UNIQUE (id, user_id)
);

CREATE TABLE elf_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id_hash TEXT NOT NULL UNIQUE,
    user_id         UUID NOT NULL REFERENCES users(id),
    device_id       UUID NOT NULL,
    platform        VARCHAR(16) NOT NULL CHECK (platform IN ('web','desktop','android')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,

    FOREIGN KEY (device_id, user_id) REFERENCES devices(id, user_id)
);

CREATE TABLE device_pairings (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash          TEXT NOT NULL UNIQUE,
    poll_token_hash    TEXT NOT NULL UNIQUE,
    device_name        TEXT NOT NULL,
    platform           VARCHAR(16) NOT NULL CHECK (platform IN ('desktop','android')),
    approved_user_id   UUID REFERENCES users(id),
    session_ciphertext TEXT,
    approve_attempts   INTEGER NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at         TIMESTAMPTZ NOT NULL,
    consumed_at        TIMESTAMPTZ
);

CREATE TABLE audit_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id),
    -- Único device_id nullable: a auditoria também registra eventos sem dispositivo de origem.
    device_id      UUID,
    entity         VARCHAR(32) NOT NULL,
    entity_id      UUID NOT NULL,
    action         VARCHAR(32) NOT NULL,
    before         JSONB,
    after          JSONB,
    version_before INTEGER,
    version_after  INTEGER,
    origin         VARCHAR(32) NOT NULL,
    request_id     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (device_id, user_id) REFERENCES devices(id, user_id)
);
