PRAGMA foreign_keys = ON;

-- Generated only into an isolated local D1 store by seed-benchmark.ps1.
-- __ITEM_COUNT__ is replaced with one of 1200, 10000, or 50000.
WITH RECURSIVE seq(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < __ITEM_COUNT__
)
INSERT INTO items (
  id, raw_title, official_title, code, type, category, platform, maker, series,
  release_year, release_date, year, rating, favorite, favorite_level,
  collection_level, normalized_code, used, is_private, status, media_status,
  quick_note, long_note, source_url, cover_url, metadata_json, search_text,
  created_at, updated_at
)
SELECT
  'benchmark-item-' || printf('%06d', n),
  CASE
    WHEN n % 150 IN (0, 149) THEN '相同作品標題 ' || CAST((n + 1) / 150 AS INTEGER)
    WHEN n % 41 = 0 THEN 'Untitled ' || n
    ELSE '大量整理測試作品 ' || n
  END,
  CASE
    WHEN n % 5 = 0 THEN NULL
    WHEN n % 150 IN (0, 149) THEN '相同作品標題 ' || CAST((n + 1) / 150 AS INTEGER)
    ELSE '正式標題 ' || n
  END,
  CASE WHEN n % 100 IN (0, 99) THEN 'DUP-' || CAST((n + 1) / 100 AS INTEGER) ELSE 'ABW-' || printf('%06d', n) END,
  CASE WHEN n % 10 = 1 THEN '電影' ELSE '私密資料庫' END,
  CASE WHEN n % 2 = 0 THEN '企劃' ELSE '單體' END,
  CASE WHEN n % 150 IN (0, 149) THEN 'JAV' WHEN n % 7 = 0 THEN 'unknown' WHEN n % 2 = 0 THEN 'FC2' ELSE 'JAV' END,
  CASE WHEN n % 150 IN (0, 149) THEN '重複測試片商' WHEN n % 6 = 0 THEN NULL ELSE '片商 ' || (n % 24) END,
  CASE WHEN n % 13 = 0 THEN NULL ELSE 'ABW' END,
  CASE WHEN n % 150 IN (0, 149) THEN 2024 WHEN n % 4 = 0 THEN NULL ELSE 2020 + (n % 7) END,
  CASE WHEN n % 150 IN (0, 149) THEN '2024-01-01' WHEN n % 4 = 0 THEN NULL ELSE printf('%04d-%02d-%02d', 2020 + (n % 7), 1 + (n % 12), 1 + (n % 28)) END,
  CASE WHEN n % 150 IN (0, 149) THEN 2024 WHEN n % 4 = 0 THEN NULL ELSE 2020 + (n % 7) END,
  CASE WHEN n % 3 = 0 THEN NULL ELSE 2 * (1 + (n % 5)) END,
  CASE WHEN n % 10 = 0 THEN 1 ELSE 0 END,
  CASE WHEN n % 10 = 0 THEN '神作' ELSE '一般' END,
  CASE WHEN n % 4 = 0 THEN 'unset' WHEN n % 10 = 0 THEN 'masterpiece' ELSE 'normal' END,
  CASE WHEN n % 100 IN (0, 99) THEN 'DUP-' || CAST((n + 1) / 100 AS INTEGER) ELSE 'ABW-' || printf('%06d', n) END,
  CASE WHEN n % 5 = 0 THEN 1 ELSE 0 END,
  CASE WHEN n % 10 = 1 THEN 0 ELSE 1 END,
  CASE WHEN n % 10 = 1 THEN 'complete' ELSE 'raw' END,
  CASE WHEN n % 5 = 0 THEN '已觀看' ELSE '待觀看' END,
  CASE WHEN n % 11 = 0 THEN 'benchmark quick note ' || n ELSE NULL END,
  CASE WHEN n % 37 = 0 THEN 'benchmark long note ' || n ELSE NULL END,
  CASE WHEN n % 100 IN (0, 99) THEN 'https://benchmark.invalid/duplicate/' || CAST((n + 1) / 100 AS INTEGER) ELSE NULL END,
  CASE WHEN n % 8 = 0 THEN 'https://benchmark.invalid/cover/' || n || '.jpg' ELSE NULL END,
  json_object(
    'benchmark', 1,
    'batch', CAST((n - 1) / 200 AS INTEGER),
    'source', CASE WHEN n % 2 = 0 THEN 'catalog-a' ELSE 'catalog-b' END,
    'conflict_marker', CASE WHEN n % 9 = 0 THEN 'review' ELSE NULL END
  ),
  lower('大量整理測試作品 ' || n || ' ABW-' || printf('%06d', n) || ' 片商 ' || (n % 24)),
  datetime('2026-08-13 00:00:00', '-' || n || ' minutes'),
  datetime('2026-08-13 00:00:00', '-' || n || ' minutes')
FROM seq;

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 50)
INSERT OR IGNORE INTO tags (id, name)
SELECT 'benchmark-tag-' || n,
  CASE WHEN n > 25 THEN '測試_標籤_' || (n - 25) ELSE '測試標籤 ' || n END
FROM seq;

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 100)
INSERT OR IGNORE INTO people (id, name, role_hint)
SELECT 'benchmark-person-' || n,
  CASE WHEN n > 50 THEN '測試_人物_' || (n - 50) ELSE '測試人物 ' || n END,
  'performer'
FROM seq;

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 8)
INSERT OR IGNORE INTO collections (id, name, description)
SELECT 'benchmark-collection-' || n, '測試收藏 ' || n, 'isolated benchmark data' FROM seq;

-- Registered aliases exercise canonical lookup without changing item display values.
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 24)
INSERT OR IGNORE INTO entity_canonicals (id, entity_type, canonical_value, normalized_key)
SELECT 'benchmark-canonical-maker-' || n, 'maker', 'Studio ' || n, 'studio ' || n FROM seq;

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 24)
INSERT OR IGNORE INTO entity_aliases (id, canonical_id, alias_value, normalized_key)
SELECT 'benchmark-alias-maker-' || n, 'benchmark-canonical-maker-' || n, 'studio-' || n, 'studio-' || n FROM seq;

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < __ITEM_COUNT__)
INSERT OR IGNORE INTO item_tags (item_id, tag_id)
SELECT 'benchmark-item-' || printf('%06d', n), 'benchmark-tag-' || (1 + (n % 50))
FROM seq WHERE n % 3 != 0;

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < __ITEM_COUNT__)
INSERT OR IGNORE INTO item_tags (item_id, tag_id)
SELECT 'benchmark-item-' || printf('%06d', n), 'benchmark-tag-' || (1 + ((n + 7) % 50))
FROM seq WHERE n % 11 = 0;

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < __ITEM_COUNT__)
INSERT OR IGNORE INTO item_people (item_id, person_id, role)
SELECT 'benchmark-item-' || printf('%06d', n), 'benchmark-person-' || (1 + (n % 100)), 'performer'
FROM seq WHERE n % 4 != 0;

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < __ITEM_COUNT__)
INSERT OR IGNORE INTO collection_items (collection_id, item_id, position)
SELECT 'benchmark-collection-' || (1 + (n % 8)), 'benchmark-item-' || printf('%06d', n), n
FROM seq WHERE n % 17 = 0;
