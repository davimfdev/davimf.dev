-- $elfControl: índices da identidade, separados do schema para rollback independente.

CREATE INDEX idx_sessions_user      ON elf_sessions(user_id, revoked_at);
CREATE INDEX idx_sessions_device    ON elf_sessions(device_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_devices_user       ON devices(user_id, revoked_at);
CREATE INDEX idx_audit_user_created ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_pairings_expiry    ON device_pairings(expires_at) WHERE consumed_at IS NULL;
