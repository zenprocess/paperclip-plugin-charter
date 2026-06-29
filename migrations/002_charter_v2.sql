-- charter plugin v2: add workspace_url to charter
-- namespace: plugin_charter_8399e57405 (sha256("charter").hex[:10])

ALTER TABLE plugin_charter_8399e57405.charter ADD COLUMN IF NOT EXISTS workspace_url text;
