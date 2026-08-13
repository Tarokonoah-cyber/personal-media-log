PRAGMA foreign_keys = ON;

-- Suggestions are advisory until an authenticated user explicitly applies them.
CREATE TABLE IF NOT EXISTS metadata_suggestions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  field TEXT NOT NULL CHECK (field IN ('official_title', 'platform', 'maker')),
  current_value TEXT,
  suggested_value TEXT NOT NULL,
  source TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'ignored')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT,
  actor_email TEXT,
  UNIQUE(item_id, field, suggested_value),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_metadata_suggestions_status_item
  ON metadata_suggestions(status, item_id, created_at DESC);

-- Canonical display values and comparison identities are intentionally separate.
CREATE TABLE IF NOT EXISTS entity_canonicals (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('tag', 'person', 'maker', 'platform')),
  canonical_value TEXT NOT NULL,
  normalized_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(entity_type, normalized_key)
);

CREATE TABLE IF NOT EXISTS entity_aliases (
  id TEXT PRIMARY KEY,
  canonical_id TEXT NOT NULL,
  alias_value TEXT NOT NULL,
  normalized_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(canonical_id, normalized_key),
  FOREIGN KEY (canonical_id) REFERENCES entity_canonicals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entity_aliases_lookup
  ON entity_aliases(normalized_key, canonical_id);

-- Merge snapshots make explicit tag/person merges recoverable.
CREATE TABLE IF NOT EXISTS entity_merge_jobs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('tag', 'person')),
  source_value TEXT NOT NULL,
  target_value TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'applied'
    CHECK (status IN ('applied', 'rolled_back')),
  actor_email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  rolled_back_at TEXT
);

-- Inbox decisions never remove or rewrite the underlying item.
CREATE TABLE IF NOT EXISTS organization_inbox_state (
  item_id TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'skipped', 'ready')),
  actor_email TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_organization_inbox_state_state
  ON organization_inbox_state(state, updated_at DESC);

-- Duplicate review decisions suppress already-reviewed pairs without deleting data.
CREATE TABLE IF NOT EXISTS duplicate_decisions (
  pair_key TEXT PRIMARY KEY,
  item_a_id TEXT NOT NULL,
  item_b_id TEXT NOT NULL,
  decision TEXT NOT NULL
    CHECK (decision IN ('not_duplicate', 'ignored', 'keep_both', 'merged')),
  actor_email TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (item_a_id) REFERENCES items(id),
  FOREIGN KEY (item_b_id) REFERENCES items(id)
);

CREATE INDEX IF NOT EXISTS idx_duplicate_decisions_items
  ON duplicate_decisions(item_a_id, item_b_id, decision);

CREATE TABLE IF NOT EXISTS duplicate_merge_snapshots (
  id TEXT PRIMARY KEY,
  pair_key TEXT NOT NULL,
  target_item_id TEXT NOT NULL,
  source_item_id TEXT NOT NULL,
  target_before_json TEXT NOT NULL,
  source_before_json TEXT NOT NULL,
  actor_email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  rolled_back_at TEXT,
  UNIQUE(pair_key, created_at)
);

CREATE INDEX IF NOT EXISTS idx_duplicate_merge_snapshots_pair
  ON duplicate_merge_snapshots(pair_key, created_at DESC);

-- Additive indexes for the new queue, duplicate blocking, and stable private sorting paths.
CREATE INDEX IF NOT EXISTS idx_items_private_status_normalized_code
  ON items(is_private, status, normalized_code);
CREATE INDEX IF NOT EXISTS idx_items_private_platform_maker_year
  ON items(is_private, status, platform, maker, year, id);
CREATE INDEX IF NOT EXISTS idx_items_private_updated
  ON items(is_private, status, updated_at DESC, id DESC);

