PRAGMA foreign_keys = ON;

-- Derived comparison signatures accelerate duplicate blocking without rewriting item metadata.
CREATE TABLE IF NOT EXISTS duplicate_item_signatures (
  item_id TEXT PRIMARY KEY,
  normalized_code TEXT,
  normalized_title TEXT NOT NULL,
  title_block TEXT NOT NULL,
  maker_key TEXT NOT NULL,
  platform_key TEXT NOT NULL,
  collection_key TEXT NOT NULL,
  source_identity TEXT NOT NULL,
  people_key TEXT NOT NULL,
  item_updated_at TEXT NOT NULL,
  signature_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_duplicate_signatures_code
  ON duplicate_item_signatures(normalized_code, item_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_signatures_title_metadata
  ON duplicate_item_signatures(normalized_title, platform_key, maker_key, item_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_signatures_block
  ON duplicate_item_signatures(title_block, platform_key, maker_key, item_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_signatures_source
  ON duplicate_item_signatures(source_identity, item_id);
