PRAGMA foreign_keys = ON;

-- Keep duplicate signatures incremental. This queue is derived bookkeeping only;
-- it never rewrites item metadata and can be safely rebuilt.
CREATE TABLE IF NOT EXISTS duplicate_signature_dirty (
  item_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_duplicate_signature_dirty_changed
  ON duplicate_signature_dirty(changed_at, item_id);

CREATE TRIGGER IF NOT EXISTS trg_duplicate_signature_items_ai
AFTER INSERT ON items
WHEN NEW.is_private = 1
BEGIN
  INSERT INTO duplicate_signature_dirty (item_id, reason, changed_at)
  VALUES (NEW.id, 'item_insert', datetime('now'))
  ON CONFLICT(item_id) DO UPDATE SET reason = excluded.reason, changed_at = excluded.changed_at;
END;

CREATE TRIGGER IF NOT EXISTS trg_duplicate_signature_items_au
AFTER UPDATE ON items
BEGIN
  INSERT INTO duplicate_signature_dirty (item_id, reason, changed_at)
  VALUES (NEW.id, 'item_update', datetime('now'))
  ON CONFLICT(item_id) DO UPDATE SET reason = excluded.reason, changed_at = excluded.changed_at;
END;

CREATE TRIGGER IF NOT EXISTS trg_duplicate_signature_people_ai
AFTER INSERT ON item_people
BEGIN
  INSERT INTO duplicate_signature_dirty (item_id, reason, changed_at)
  VALUES (NEW.item_id, 'people_insert', datetime('now'))
  ON CONFLICT(item_id) DO UPDATE SET reason = excluded.reason, changed_at = excluded.changed_at;
END;

CREATE TRIGGER IF NOT EXISTS trg_duplicate_signature_people_ad
AFTER DELETE ON item_people
BEGIN
  INSERT INTO duplicate_signature_dirty (item_id, reason, changed_at)
  VALUES (OLD.item_id, 'people_delete', datetime('now'))
  ON CONFLICT(item_id) DO UPDATE SET reason = excluded.reason, changed_at = excluded.changed_at;
END;
