PRAGMA foreign_keys = ON;

-- Version derived signatures so a safer blocking algorithm can rebuild lazily.
ALTER TABLE duplicate_item_signatures ADD COLUMN signature_version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_duplicate_signatures_version
  ON duplicate_item_signatures(signature_version, item_id);
