PRAGMA foreign_keys = ON;

-- Partial indexes match the high-frequency private library browse scope and keep
-- public/default item queries unchanged.
CREATE INDEX IF NOT EXISTS idx_private_sort_code
  ON items(
    lower(rtrim(coalesce(nullif(trim(normalized_code), ''), nullif(trim(code), ''), ''), '0123456789')),
    CAST(nullif(substr(coalesce(nullif(trim(normalized_code), ''), nullif(trim(code), ''), ''), length(rtrim(coalesce(nullif(trim(normalized_code), ''), nullif(trim(code), ''), ''), '0123456789')) + 1), '') AS INTEGER),
    id
  ) WHERE is_private = 1 AND status != 'deleted';

CREATE INDEX IF NOT EXISTS idx_private_sort_title
  ON items(lower(coalesce(nullif(trim(official_title), ''), nullif(trim(raw_title), ''), '')), id)
  WHERE is_private = 1 AND status != 'deleted';

CREATE INDEX IF NOT EXISTS idx_private_sort_rating
  ON items(rating, updated_at, id)
  WHERE is_private = 1 AND status != 'deleted';

CREATE INDEX IF NOT EXISTS idx_private_sort_source
  ON items(lower(coalesce(nullif(trim(platform), ''), nullif(trim(source_url), ''), '')), id)
  WHERE is_private = 1 AND status != 'deleted';

CREATE INDEX IF NOT EXISTS idx_private_sort_favorite
  ON items(used, collection_level, rating, id)
  WHERE is_private = 1 AND status != 'deleted';

CREATE INDEX IF NOT EXISTS idx_private_sort_release_date
  ON items(release_date, id)
  WHERE is_private = 1 AND status != 'deleted';
