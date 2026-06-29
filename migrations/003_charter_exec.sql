-- charter plugin v3: add execution columns to charter
-- namespace: plugin_charter_8399e57405 (sha256("charter").hex[:10])

ALTER TABLE plugin_charter_8399e57405.charter
  ADD COLUMN IF NOT EXISTS execution_provider text,
  ADD COLUMN IF NOT EXISTS execution_ref text,
  ADD COLUMN IF NOT EXISTS execution_env text;
