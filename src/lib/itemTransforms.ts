import type { ItemInput, MediaItem } from "../types";

export function toItemInput(item: MediaItem): ItemInput {
  return {
    raw_title: item.raw_title,
    official_title: item.official_title,
    original_title: item.original_title,
    code: item.code,
    type: item.type,
    category: item.category,
    platform: item.platform,
    release_year: item.release_year,
    watched_at: item.watched_at,
    started_at: item.started_at,
    completed_at: item.completed_at,
    planned_at: item.planned_at,
    rating: item.rating,
    rewatch_score: item.rewatch_score,
    favorite: item.favorite,
    status: item.status === "deleted" ? "raw" : item.status,
    quick_note: item.quick_note,
    long_note: item.long_note,
    source_url: item.source_url,
    cover_url: item.cover_url,
    metadata_json: item.metadata_json,
    progress_json: item.progress_json,
    tags: item.tags,
    people: item.people,
    collections: item.collections
  };
}
