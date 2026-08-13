PRAGMA foreign_keys = ON;

-- Each blocking predicate gets a left-prefix index. Keeping predicates separate
-- avoids OR joins that force nested scans as the library grows.
CREATE INDEX IF NOT EXISTS idx_duplicate_signatures_title_people
  ON duplicate_item_signatures(normalized_title, platform_key, people_key, item_id);

CREATE INDEX IF NOT EXISTS idx_duplicate_signatures_block_platform
  ON duplicate_item_signatures(title_block, platform_key, item_id);

CREATE INDEX IF NOT EXISTS idx_duplicate_signatures_block_maker
  ON duplicate_item_signatures(title_block, maker_key, item_id);

CREATE INDEX IF NOT EXISTS idx_duplicate_signatures_block_people
  ON duplicate_item_signatures(title_block, people_key, item_id);
