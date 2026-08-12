PRAGMA foreign_keys = ON;

DELETE FROM items WHERE id LIKE 'benchmark-item-%';

WITH RECURSIVE seq(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 1200
)
INSERT INTO items (
  id, raw_title, official_title, code, type, category, platform, maker, series,
  release_year, release_date, year, rating, favorite, favorite_level,
  collection_level, normalized_code, used, is_private, status, media_status,
  quick_note, metadata_json, search_text, created_at, updated_at
)
SELECT
  'benchmark-item-' || printf('%04d', n),
  CASE WHEN n % 150 IN (0, 149) THEN '相同作品標題 ' || CAST((n + 1) / 150 AS INTEGER) ELSE '大量整理測試作品 ' || n END,
  CASE WHEN n % 5 = 0 THEN NULL WHEN n % 150 IN (0, 149) THEN '相同作品標題 ' || CAST((n + 1) / 150 AS INTEGER) ELSE '正式標題 ' || n END,
  CASE WHEN n % 100 IN (0, 99) THEN 'DUP-' || CAST((n + 1) / 100 AS INTEGER) ELSE 'ABW-' || printf('%03d', n) END,
  '私密資料庫',
  CASE WHEN n % 2 = 0 THEN '企劃' ELSE '單體' END,
  CASE WHEN n % 150 IN (0, 149) THEN 'JAV' WHEN n % 7 = 0 THEN 'unknown' WHEN n % 2 = 0 THEN 'FC2' ELSE 'JAV' END,
  CASE WHEN n % 150 IN (0, 149) THEN '重複測試片商' WHEN n % 6 = 0 THEN NULL ELSE '片商 ' || (n % 8) END,
  'ABW',
  CASE WHEN n % 150 IN (0, 149) THEN 2024 WHEN n % 4 = 0 THEN NULL ELSE 2020 + (n % 7) END,
  CASE WHEN n % 150 IN (0, 149) THEN '2024-01-01' WHEN n % 4 = 0 THEN NULL ELSE printf('%04d-%02d-%02d', 2020 + (n % 7), 1 + (n % 12), 1 + (n % 28)) END,
  CASE WHEN n % 150 IN (0, 149) THEN 2024 WHEN n % 4 = 0 THEN NULL ELSE 2020 + (n % 7) END,
  CASE WHEN n % 3 = 0 THEN NULL ELSE 2 * (1 + (n % 5)) END,
  CASE WHEN n % 10 = 0 THEN 1 ELSE 0 END,
  CASE WHEN n % 10 = 0 THEN '神作' ELSE '一般' END,
  CASE WHEN n % 4 = 0 THEN 'unset' WHEN n % 10 = 0 THEN 'masterpiece' ELSE 'normal' END,
  CASE WHEN n % 100 IN (0, 99) THEN 'DUP-' || CAST((n + 1) / 100 AS INTEGER) ELSE 'ABW-' || printf('%03d', n) END,
  CASE WHEN n % 5 = 0 THEN 1 ELSE 0 END,
  1,
  'raw',
  CASE WHEN n % 5 = 0 THEN '已觀看' ELSE '待觀看' END,
  NULL,
  json_object('benchmark', 1, 'batch', CAST((n - 1) / 200 AS INTEGER)),
  lower('大量整理測試作品 ' || n || ' ABW-' || printf('%03d', n)),
  datetime('now', '-' || n || ' minutes'),
  datetime('now', '-' || n || ' minutes')
FROM seq;

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 10)
INSERT OR IGNORE INTO tags (id, name)
SELECT 'benchmark-tag-' || n, '測試標籤 ' || n FROM seq;

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 20)
INSERT OR IGNORE INTO people (id, name, role_hint)
SELECT 'benchmark-person-' || n, '測試人物 ' || n, 'performer' FROM seq;

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 1200)
INSERT OR IGNORE INTO item_tags (item_id, tag_id)
SELECT 'benchmark-item-' || printf('%04d', n), 'benchmark-tag-' || (1 + (n % 10))
FROM seq WHERE n % 3 != 0;

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 1200)
INSERT OR IGNORE INTO item_people (item_id, person_id, role)
SELECT 'benchmark-item-' || printf('%04d', n), 'benchmark-person-' || (1 + (n % 20)), 'performer'
FROM seq WHERE n % 4 != 0;
