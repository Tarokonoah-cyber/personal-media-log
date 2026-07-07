export type ItemStatus = "raw" | "partial" | "complete" | "archived" | "deleted";
export type WatchStatus = "plan_to_watch" | "watching" | "completed" | "paused" | "dropped" | "rewatching";

export interface MediaItem {
  id: string;
  raw_title: string;
  official_title: string | null;
  original_title: string | null;
  code: string | null;
  type: string | null;
  category: string | null;
  platform: string | null;
  release_year: number | null;
  watched_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  planned_at: string | null;
  rating: number | null;
  rewatch_score: number | null;
  favorite: boolean;
  is_private: boolean;
  status: ItemStatus;
  quick_note: string | null;
  long_note: string | null;
  source_url: string | null;
  cover_url: string | null;
  metadata_json: string | null;
  progress_json: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  tags: string[];
  people: string[];
  collections: string[];
}

export type ItemInput = Partial<Omit<MediaItem, "id" | "created_at" | "updated_at" | "deleted_at">> & {
  raw_title: string;
};

export interface ItemListResponse {
  items: MediaItem[];
  page: number;
  pageSize: number;
  total: number;
  privateSummary?: PrivateSummary;
}

export interface PrivateSummary {
  total: number;
  used: number;
  unused: number;
  averageRating: number | null;
  collectionCounts: Array<{ level: string; count: number }>;
}

export interface ListFilters {
  query: string;
  status: "all" | "inbox" | "organized" | ItemStatus;
  favorite: boolean;
  highRated: boolean;
  ratingMin: string;
  ratingMax: string;
  unrated?: boolean;
  usedFilter: "all" | "used" | "unused";
  collectionLevel: string;
  includePrivate?: boolean;
  privateOnly?: boolean;
  watchStatus?: WatchStatus | "all";
  type: string;
  category?: string;
  tag: string;
  excludeTag?: string;
  year: string;
  platform: string;
  codeQuery: string;
  titleQuery: string;
  person: string;
  studio: string;
  watchedFrom: string;
  watchedTo: string;
  viewedFrom?: string;
  viewedTo?: string;
  updatedFrom: string;
  updatedTo: string;
  page: number;
  pageSize: number;
}

export interface StatsResponse {
  total: number;
  currentYear: number;
  averageRating: number;
  inbox: number;
  top: MediaItem[];
  recent: MediaItem[];
  watching: MediaItem[];
  plan: MediaItem[];
  monthly: Array<{ month: string; count: number }>;
  watchStatuses: Array<{ name: WatchStatus; label: string; count: number }>;
  types: Array<{ name: string; count: number }>;
  categories: Array<{ name: string; count: number }>;
  platforms: Array<{ name: string; count: number }>;
  tags: Array<{ name: string; count: number }>;
}

export interface ImportPreview {
  sourceName: string;
  sourceType: "csv" | "json";
  columns: string[];
  sampleRows: Array<Record<string, unknown>>;
  duplicatePreview: Array<{ index: number; raw_title?: string; duplicate: boolean }>;
  suggestedMapping: Record<string, string>;
}

export interface BackupJob {
  id: string;
  r2_key: string;
  kind: "manual" | "scheduled";
  encrypted: number;
  item_count: number;
  created_at: string;
  restored_at: string | null;
  status: string;
}

export interface TmdbCandidate {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  original_title: string;
  year: number | null;
  country: string[];
  genres: string[];
  poster_path: string | null;
  poster_url: string | null;
}

export interface TmdbSearchResponse {
  query: string;
  candidates: TmdbCandidate[];
}

export interface SmartAddResponse {
  input: ItemInput;
  summary: string;
  parsed: {
    date?: string | null;
    is_sports: boolean;
    is_plain_record: boolean;
    sport?: string | null;
    league?: string | null;
    teams?: string[];
    tags?: string[];
    note?: string | null;
    confidence?: number;
  };
  source: "ai" | "rule";
}

export interface WatchProgress {
  watch_status?: WatchStatus;
  current_season?: number | null;
  current_episode?: number | null;
  total_seasons?: number | null;
  total_episodes?: number | null;
  episode_runtime?: number | null;
  progress_note?: string;
}
