ALTER TABLE items ADD COLUMN release_date TEXT;

UPDATE items
SET release_date = coalesce(
  nullif(json_extract(metadata_json, '$.release_date'), ''),
  nullif(json_extract(metadata_json, '$.released_at'), '')
)
WHERE release_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_items_release_date ON items(release_date);
