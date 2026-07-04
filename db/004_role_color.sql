-- Adds the Discord role color (0xRRGGBB integer) to the role snapshot.
-- Written by the BaseBot role publisher (separate repo); read by the dashboard
-- to render colored role chips. Null until the bot publishes a value.
ALTER TABLE guild_roles_snapshot ADD COLUMN IF NOT EXISTS color integer;
