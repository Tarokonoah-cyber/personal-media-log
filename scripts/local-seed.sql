WITH RECURSIVE seq(n) AS (
  SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 40
)
INSERT OR IGNORE INTO items (
  id, raw_title, official_title, code, normalized_code, type, category, platform, maker, series,
  release_year, year, rating, favorite, favorite_level, collection_level, used, is_private,
  status, media_status, quick_note, long_note, search_text, created_at, updated_at
)
SELECT
  printf('local-private-%03d', n),
  printf('本機合成測試作品 %03d', n),
  CASE WHEN n % 4 = 0 THEN NULL ELSE printf('Synthetic Title %03d', n) END,
  CASE WHEN n % 3 = 0 THEN printf('FC2-PPV-%07d', 4907000 + n) ELSE printf('TEST-%03d', n) END,
  CASE WHEN n % 3 = 0 THEN printf('FC2-PPV-%07d', 4907000 + n) ELSE printf('TEST-%03d', n) END,
  '私密', '測試',
  CASE WHEN n % 3 = 0 THEN 'FC2' WHEN n % 3 = 1 THEN 'JAV' ELSE '其他' END,
  CASE WHEN n % 3 = 1 THEN CASE n % 5 WHEN 0 THEN 'S1' WHEN 1 THEN 'SOD' WHEN 2 THEN 'Prestige' WHEN 3 THEN 'Moodyz' ELSE 'FALENO' END ELSE '' END,
  CASE WHEN n % 3 = 0 THEN 'FC2PPV' ELSE 'TEST' END,
  2020 + (n % 7), 2020 + (n % 7), CASE WHEN n % 6 = 0 THEN NULL ELSE 5 + (n % 6) END,
  0, '一般', CASE n % 4 WHEN 0 THEN 'unset' WHEN 1 THEN 'masterpiece' WHEN 2 THEN 'normal' ELSE 'discard' END,
  n % 2, 1, 'raw', CASE WHEN n % 2 = 0 THEN '已觀看' ELSE '待觀看' END,
  printf('合成摘要 %03d', n), printf('僅供本機測試的合成完整心得 %03d', n),
  lower(printf('本機合成測試作品 %03d TEST-%03d', n, n)), datetime('now'), datetime('now')
FROM seq;

INSERT OR IGNORE INTO people (id, name) VALUES
  ('local-person-a', '測試女優 A'), ('local-person-b', '測試女優 B'), ('local-person-c', '測試創作者 C');
INSERT OR IGNORE INTO tags (id, name) VALUES
  ('local-tag-hq', '高畫質'), ('local-tag-story', '劇情好'), ('local-tag-amateur', '素人感');

INSERT OR IGNORE INTO item_people (item_id, person_id, role)
SELECT id, CASE CAST(substr(id, -3) AS INTEGER) % 3 WHEN 0 THEN 'local-person-a' WHEN 1 THEN 'local-person-b' ELSE 'local-person-c' END, 'performer'
FROM items WHERE id LIKE 'local-private-%';
INSERT OR IGNORE INTO item_tags (item_id, tag_id)
SELECT id, CASE CAST(substr(id, -3) AS INTEGER) % 3 WHEN 0 THEN 'local-tag-hq' WHEN 1 THEN 'local-tag-story' ELSE 'local-tag-amateur' END
FROM items WHERE id LIKE 'local-private-%';
