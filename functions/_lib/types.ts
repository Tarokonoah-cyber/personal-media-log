export interface Env {
  MEDIA_LOG_DB: D1Database;
  MEDIA_LOG_BACKUPS?: R2Bucket;
  ACCESS_ALLOWED_EMAILS?: string;
  DEV_AUTH_EMAIL?: string;
  BACKUP_ENCRYPTION_KEY_B64?: string;
  TMDB_READ_TOKEN?: string;
  TMDB_API_KEY?: string;
  OPENAI_API_KEY?: string;
  SMART_ADD_MODEL?: string;
}

export interface Actor {
  email: string;
}

export type ItemStatus = "raw" | "partial" | "complete" | "archived" | "deleted";
export type WatchStatus = "plan_to_watch" | "watching" | "completed" | "paused" | "dropped" | "rewatching";

export interface ItemInput {
  raw_title?: string;
  official_title?: string | null;
  original_title?: string | null;
  code?: string | null;
  type?: string | null;
  category?: string | null;
  platform?: string | null;
  release_year?: number | null;
  watched_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  planned_at?: string | null;
  rating?: number | null;
  rewatch_score?: number | null;
  favorite?: boolean;
  is_private?: boolean;
  status?: ItemStatus;
  quick_note?: string | null;
  long_note?: string | null;
  source_url?: string | null;
  cover_url?: string | null;
  metadata_json?: string | null;
  progress_json?: string | null;
  tags?: string[];
  people?: string[];
  collections?: string[];
}

export interface ItemRecord extends Required<Omit<ItemInput, "tags" | "people" | "collections">> {
  id: string;
  favorite: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  tags: string[];
  people: string[];
  collections: string[];
}

export interface ItemListParams {
  query?: string;
  status?: ItemStatus | "all" | "inbox" | "organized";
  favorite?: boolean;
  highRated?: boolean;
  ratingMin?: number;
  ratingMax?: number;
  usedFilter?: "all" | "used" | "unused";
  collectionLevel?: string;
  includePrivate?: boolean;
  privateOnly?: boolean;
  watchStatus?: WatchStatus | "all";
  type?: string;
  category?: string;
  tag?: string;
  year?: number;
  platform?: string;
  codeQuery?: string;
  titleQuery?: string;
  person?: string;
  studio?: string;
  watchedFrom?: string;
  watchedTo?: string;
  viewedFrom?: string;
  viewedTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  page: number;
  pageSize: number;
}
