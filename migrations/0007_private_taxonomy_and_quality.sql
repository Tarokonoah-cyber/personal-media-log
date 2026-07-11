-- Repair only values that can be proven from the retained code/favorite fields.
UPDATE items
SET collection_level = CASE WHEN favorite = 1 THEN 'normal' ELSE 'unset' END
WHERE is_private = 1
  AND collection_level = 'normal'
  AND favorite_level = '一般';

UPDATE items
SET platform = 'FC2', normalized_code = upper(replace(trim(code), 'FC2PPV-', 'FC2-PPV-'))
WHERE is_private = 1
  AND code IS NOT NULL
  AND (upper(code) GLOB 'FC2-[0-9]*' OR upper(code) GLOB 'FC2PPV-*' OR upper(code) GLOB 'FC2-PPV-*');

UPDATE items SET platform = 'JAV', normalized_code = 'DAVJ-746' WHERE id = 'item_1b669e215dee654779d05237' AND code = '𝙳𝙰𝚅𝙹-𝟽𝟺𝟼';
UPDATE items SET platform = 'JAV', normalized_code = 'MIDA-662' WHERE id = 'item_768f8f587f419338c07d8151' AND code = '𝙼𝙸𝙳𝙰-𝟼𝟼𝟸';
UPDATE items SET platform = 'JAV', normalized_code = 'MNGS-060' WHERE id = 'item_2e99114e3c1deb046dc76e07' AND code = '𝙼𝙽𝙶𝚂-𝟶𝟼𝟶';
UPDATE items SET platform = 'JAV', normalized_code = 'NACT-145' WHERE id = 'item_5a8354dfa2cbf87e0fccad46' AND code = '𝙽𝙰𝙲𝚃-𝟷𝟺𝟻';
UPDATE items SET platform = 'JAV', normalized_code = 'SNOS-206' WHERE id = 'item_c8f507397929b18843d3d7d0' AND code = '𝚂𝙽𝙾𝚂-𝟸𝟶𝟼';
UPDATE items SET platform = 'JAV', normalized_code = 'SSNI-575' WHERE id = 'item_38a623e4fed7c410029b8db2' AND code = '𝚂𝚂𝙽𝙸-𝟻𝟽𝟻';
UPDATE items SET platform = 'JAV', normalized_code = 'START-583' WHERE id = 'item_d946f279ffc73235192a4d9f' AND code = '𝚂𝚃𝙰𝚁𝚃-𝟻𝟾𝟹';
UPDATE items SET platform = 'JAV', normalized_code = 'WAAA-464' WHERE id = 'item_4cf56d987d20fe5dc549e7d1' AND code = '𝚆𝙰𝙰𝙰-𝟺𝟼𝟺';
UPDATE items SET platform = 'JAV', normalized_code = 'MVSD-630' WHERE id = 'item_78f0dd1a6371b2321b94545f' AND raw_title = 'MVSD-630';
UPDATE items SET platform = 'unknown' WHERE id = 'item_32af89a16acaafbd069bc022' AND code = 'FCVPPV-4615888';

CREATE TABLE IF NOT EXISTS private_data_quality_ignores (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  issue_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(item_id, issue_type, issue_key),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_private_quality_ignores_lookup
  ON private_data_quality_ignores(item_id, issue_type, issue_key);
