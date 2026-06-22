ALTER TABLE items ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0;

UPDATE items
SET is_private = 1
WHERE is_private = 0
  AND (
    lower(
      coalesce(type, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(platform, '') || ' ' ||
      coalesce(metadata_json, '')
    ) GLOB '*adult*'
    OR lower(
      coalesce(type, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(platform, '') || ' ' ||
      coalesce(metadata_json, '')
    ) GLOB '*nsfw*'
    OR lower(
      coalesce(type, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(platform, '') || ' ' ||
      coalesce(metadata_json, '')
    ) GLOB '*private*'
    OR (
      coalesce(type, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(platform, '') || ' ' ||
      coalesce(metadata_json, '')
    ) LIKE '%成人%'
    OR (
      coalesce(type, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(platform, '') || ' ' ||
      coalesce(metadata_json, '')
    ) LIKE '%私密%'
    OR EXISTS (
      SELECT 1
      FROM item_tags
      JOIN tags ON tags.id = item_tags.tag_id
      WHERE item_tags.item_id = items.id
        AND (
          lower(tags.name) IN ('adult', 'nsfw', 'private')
          OR tags.name IN ('成人', '私密')
        )
    )
  );
