ALTER TABLE items ADD COLUMN collection_level TEXT NOT NULL DEFAULT 'unset'
  CHECK (collection_level IN ('unset', 'masterpiece', 'normal', 'discard'));
ALTER TABLE items ADD COLUMN normalized_code TEXT;

UPDATE items
SET collection_level = CASE
  WHEN favorite_level = '神作' THEN 'masterpiece'
  WHEN favorite_level IN ('收藏', '一般') OR favorite = 1 THEN 'normal'
  WHEN favorite_level IN ('雷片', '已刪') THEN 'discard'
  ELSE 'unset'
END;

UPDATE items
SET normalized_code = upper(trim(replace(replace(replace(replace(coalesce(code, ''), '—', '-'), '–', '-'), '－', '-'), '　', ' ')))
WHERE code IS NOT NULL AND trim(code) != '';

CREATE INDEX IF NOT EXISTS idx_items_collection_level ON items(collection_level);
CREATE INDEX IF NOT EXISTS idx_items_normalized_code ON items(normalized_code);
