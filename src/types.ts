export type ItemStatus = "raw" | "partial" | "complete" | "archived" | "deleted";
export type WatchStatus = "plan_to_watch" | "watching" | "completed" | "paused" | "dropped" | "rewatching";
import type { CollectionLevel } from "../shared/privateModel";

export type FavoriteLevel = "神作" | "收藏" | "一般" | "雷片" | "已刪";
export type MediaStatus = "待觀看" | "已觀看" | "想重看" | "已刪除";

export interface MediaItem {
  id: string;
  raw_title: string;
  official_title: string | null;
  original_title: string | null;
  code: string | null;
  type: string | null;
  category: string | null;
  platform: string | null;
  maker: string | null;
  series: string | null;
  release_year: number | null;
  year: number | null;
  watched_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  planned_at: string | null;
  rating: number | null;
  rewatch_score: number | null;
  favorite: boolean;
  favorite_level: FavoriteLevel;
  collection_level: CollectionLevel;
  normalized_code: string | null;
  used: boolean;
  is_private: boolean;
  status: ItemStatus;
  media_status: MediaStatus;
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
  privateFacets?: PrivateFacets;
}

export interface PrivateSummary {
  total: number;
  used: number;
  unused: number;
  averageRating: number | null;
  collectionCounts: Array<{ level: string; count: number }>;
}

export interface PrivateFacetItem {
  value: string;
  label?: string;
  count: number;
}

export interface PrivateFacetSearchResponse {
  facet: "actress" | "tag" | "studio";
  items: PrivateFacetItem[];
}

export type PrivateIssueType = "duplicate_code" | "unknown_platform" | "missing_title" | "missing_people" | "missing_tags" | "unrated" | "unset_collection" | "invalid_collection" | "invalid_code";
export interface PrivateQualitySummaryItem { type: PrivateIssueType; label: string; count: number; }
export interface PrivateQualityIssue {
  item_id: string; code: string; title: string; platform: string | null; collection_level: string;
  original_value: string; suggestion: string; issue_key: string;
}
export interface PrivateQualityResponse {
  summary?: PrivateQualitySummaryItem[]; ignoredCount?: number; issueType?: PrivateIssueType; label?: string;
  page?: number; pageSize?: number; total?: number; issues?: PrivateQualityIssue[];
}

export interface PrivateFacets {
  source: PrivateFacetItem[];
  maker: PrivateFacetItem[];
  series: PrivateFacetItem[];
  actress: PrivateFacetItem[];
  javMaker: PrivateFacetItem[];
  tags: PrivateFacetItem[];
  ratingBuckets: PrivateFacetItem[];
  favoriteLevel: PrivateFacetItem[];
  used: PrivateFacetItem[];
  status: PrivateFacetItem[];
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
  favoriteLevel: FavoriteLevel | "all" | "";
  mediaStatus: MediaStatus | "all" | "";
  includePrivate?: boolean;
  privateOnly?: boolean;
  includeFacets?: boolean;
  platformFilters?: string;
  makerFilters?: string;
  favoriteLevelFilters?: string;
  personFilters?: string;
  missingPeople?: boolean;
  hasNote?: "all" | "yes" | "no";
  hasCover?: "all" | "yes" | "no";
  watchStatus?: WatchStatus | "all";
  type: string;
  category?: string;
  tag: string;
  excludeTag?: string;
  year: string;
  platform: string;
  maker: string;
  series: string;
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
  sort?: "displayName" | "";
  order?: "asc" | "desc" | "";
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
