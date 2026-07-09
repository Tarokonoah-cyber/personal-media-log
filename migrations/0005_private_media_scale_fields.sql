PRAGMA foreign_keys = ON;

ALTER TABLE items ADD COLUMN maker TEXT;
ALTER TABLE items ADD COLUMN series TEXT;
ALTER TABLE items ADD COLUMN year INTEGER;
ALTER TABLE items ADD COLUMN favorite_level TEXT NOT NULL DEFAULT '一般'
  CHECK (favorite_level IN ('神作', '收藏', '一般', '雷片', '已刪'));
ALTER TABLE items ADD COLUMN used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN media_status TEXT NOT NULL DEFAULT '待觀看'
  CHECK (media_status IN ('待觀看', '已觀看', '想重看', '已刪除'));
ALTER TABLE items ADD COLUMN search_text TEXT;

UPDATE items
SET
  year = coalesce(release_year, CAST(json_extract(metadata_json, '$.year') AS INTEGER)),
  maker = nullif(coalesce(
    json_extract(metadata_json, '$.maker'),
    json_extract(metadata_json, '$.studio'),
    CASE WHEN is_private = 1 THEN platform END
  ), ''),
  series = nullif(coalesce(
    json_extract(metadata_json, '$.series'),
    CASE
      WHEN instr(coalesce(code, ''), '-') > 0 THEN substr(code, 1, instr(code, '-') - 1)
      WHEN upper(coalesce(code, '')) LIKE 'FC2PPV%' THEN 'FC2PPV'
      ELSE NULL
    END
  ), ''),
  favorite_level = CASE
    WHEN json_extract(metadata_json, '$.reflection.collection_level') IN ('神作', '收藏', '一般', '雷片', '已刪') THEN json_extract(metadata_json, '$.reflection.collection_level')
    WHEN json_extract(metadata_json, '$.collection_level') IN ('神作', '收藏', '一般', '雷片', '已刪') THEN json_extract(metadata_json, '$.collection_level')
    WHEN favorite = 1 AND rating >= 9 THEN '神作'
    WHEN favorite = 1 THEN '收藏'
    WHEN status = 'deleted' THEN '已刪'
    ELSE '一般'
  END,
  used = CASE
    WHEN json_extract(metadata_json, '$.used') IN (1, '1', 'true', 'yes', 'used') THEN 1
    ELSE 0
  END,
  media_status = CASE
    WHEN status = 'deleted' THEN '已刪除'
    WHEN json_extract(progress_json, '$.watch_status') = 'rewatching' THEN '想重看'
    WHEN json_extract(progress_json, '$.watch_status') = 'completed' OR status = 'complete' THEN '已觀看'
    ELSE '待觀看'
  END;

UPDATE items
SET platform = CASE
  WHEN upper(coalesce(code, '')) GLOB 'FC2PPV*' OR upper(coalesce(code, '')) GLOB 'FC2-PPV*' THEN 'FC2'
  WHEN platform IS NULL OR trim(platform) = '' THEN '其他'
  ELSE platform
END;

UPDATE items
SET maker = CASE
  WHEN upper(coalesce(code, '')) GLOB 'SSIS-*' OR upper(coalesce(code, '')) GLOB 'IPZZ-*' OR upper(coalesce(code, '')) GLOB 'SONE-*' THEN 'S1'
  WHEN upper(coalesce(code, '')) GLOB 'STARS-*' OR upper(coalesce(code, '')) GLOB 'SDAB-*' OR upper(coalesce(code, '')) GLOB 'SDDE-*' THEN 'SOD'
  WHEN upper(coalesce(code, '')) GLOB 'ABW-*' OR upper(coalesce(code, '')) GLOB 'CHN-*' THEN 'Prestige'
  WHEN maker IS NULL THEN ''
  ELSE maker
END;

UPDATE items
SET search_text = lower(
  coalesce(raw_title, '') || ' ' ||
  coalesce(official_title, '') || ' ' ||
  coalesce(original_title, '') || ' ' ||
  coalesce(code, '') || ' ' ||
  coalesce(platform, '') || ' ' ||
  coalesce(maker, '') || ' ' ||
  coalesce(series, '') || ' ' ||
  coalesce(quick_note, '') || ' ' ||
  coalesce(long_note, '') || ' ' ||
  coalesce(metadata_json, '')
);

CREATE INDEX IF NOT EXISTS idx_items_code_scale ON items(code);
CREATE INDEX IF NOT EXISTS idx_items_platform_scale ON items(platform);
CREATE INDEX IF NOT EXISTS idx_items_maker_scale ON items(maker);
CREATE INDEX IF NOT EXISTS idx_items_series_scale ON items(series);
CREATE INDEX IF NOT EXISTS idx_items_rating_scale ON items(rating);
CREATE INDEX IF NOT EXISTS idx_items_favorite_level_scale ON items(favorite_level);
CREATE INDEX IF NOT EXISTS idx_items_used_scale ON items(used);
CREATE INDEX IF NOT EXISTS idx_items_media_status_scale ON items(media_status);
CREATE INDEX IF NOT EXISTS idx_items_year_scale ON items(year);
CREATE INDEX IF NOT EXISTS idx_items_watched_at_scale ON items(watched_at);
CREATE INDEX IF NOT EXISTS idx_items_created_at_scale ON items(created_at);
CREATE INDEX IF NOT EXISTS idx_items_private_status_updated_scale ON items(is_private, media_status, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_people_name_scale ON people(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_tags_name_scale ON tags(name COLLATE NOCASE);

CREATE VIRTUAL TABLE IF NOT EXISTS items_search_fts USING fts5(
  item_id UNINDEXED,
  content,
  tokenize='unicode61'
);

INSERT INTO items_search_fts(rowid, item_id, content)
SELECT rowid, id, search_text
FROM items
WHERE search_text IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM items_search_fts WHERE items_search_fts.rowid = items.rowid);

CREATE TRIGGER IF NOT EXISTS trg_items_search_ai
AFTER INSERT ON items
BEGIN
  INSERT INTO items_search_fts(rowid, item_id, content)
  VALUES (new.rowid, new.id, coalesce(new.search_text, lower(
    coalesce(new.raw_title, '') || ' ' ||
    coalesce(new.official_title, '') || ' ' ||
    coalesce(new.original_title, '') || ' ' ||
    coalesce(new.code, '') || ' ' ||
    coalesce(new.platform, '') || ' ' ||
    coalesce(new.maker, '') || ' ' ||
    coalesce(new.series, '') || ' ' ||
    coalesce(new.quick_note, '') || ' ' ||
    coalesce(new.long_note, '') || ' ' ||
    coalesce(new.metadata_json, '')
  )));
END;

CREATE TRIGGER IF NOT EXISTS trg_items_search_ad
AFTER DELETE ON items
BEGIN
  DELETE FROM items_search_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS trg_items_search_au
AFTER UPDATE ON items
BEGIN
  DELETE FROM items_search_fts WHERE rowid = old.rowid;
  INSERT INTO items_search_fts(rowid, item_id, content)
  VALUES (new.rowid, new.id, coalesce(new.search_text, lower(
    coalesce(new.raw_title, '') || ' ' ||
    coalesce(new.official_title, '') || ' ' ||
    coalesce(new.original_title, '') || ' ' ||
    coalesce(new.code, '') || ' ' ||
    coalesce(new.platform, '') || ' ' ||
    coalesce(new.maker, '') || ' ' ||
    coalesce(new.series, '') || ' ' ||
    coalesce(new.quick_note, '') || ' ' ||
    coalesce(new.long_note, '') || ' ' ||
    coalesce(new.metadata_json, '')
  )));
END;
