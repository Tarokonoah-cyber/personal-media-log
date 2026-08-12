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
import type { CollectionLevel, PrivateCollectionLevel } from "../../shared/privateModel";
import type { PrivateStatusFilter } from "../../shared/privateStatus";

export type FavoriteLevel = "已使用" | "神作" | "收藏" | "一般" | "雷片" | "已刪";
export type MediaStatus = "待觀看" | "已觀看" | "想重看" | "已刪除";

export interface ItemInput {
  raw_title?: string;
  official_title?: string | null;
  original_title?: string | null;
  code?: string | null;
  type?: string | null;
  category?: string | null;
  platform?: string | null;
  maker?: string | null;
  series?: string | null;
  release_year?: number | null;
  release_date?: string | null;
  year?: number | null;
  watched_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  planned_at?: string | null;
  rating?: number | null;
  rewatch_score?: number | null;
  favorite?: boolean;
  favorite_level?: FavoriteLevel;
  collection_level?: CollectionLevel;
  normalized_code?: string | null;
  used?: boolean;
  is_private?: boolean;
  status?: ItemStatus;
  media_status?: MediaStatus;
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

export interface BatchUpdateOperation {
  id: string;
  input: ItemInput;
}

export interface BatchUpdateResult {
  outcome: "updated" | "already_applied";
  requested: number;
  updatedIds: string[];
  unchangedIds: string[];
  atomic: true;
}

export interface PublicAggregateResponse {
  generatedAt: string;
  summary: {
    total: number;
    today: number;
    thisWeek: number;
    inbox: number;
    currentYear: number;
    averageRating: number;
  };
  facets: {
    types: Array<{ name: string; count: number }>;
    categories: Array<{ name: string; count: number }>;
    platforms: Array<{ name: string; count: number }>;
    tags: Array<{ name: string; count: number }>;
    watchStatuses: Array<{ name: WatchStatus; label: string; count: number }>;
  };
  stats: {
    total: number;
    currentYear: number;
    averageRating: number;
    inbox: number;
    top: ItemRecord[];
    recent: ItemRecord[];
    watching: ItemRecord[];
    plan: ItemRecord[];
    monthly: Array<{ month: string; count: number }>;
    watchStatuses: Array<{ name: WatchStatus; label: string; count: number }>;
    types: Array<{ name: string; count: number }>;
    categories: Array<{ name: string; count: number }>;
    platforms: Array<{ name: string; count: number }>;
    tags: Array<{ name: string; count: number }>;
  };
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
  unrated?: boolean;
  usedFilter?: "all" | "used" | "unused";
  privateStatus?: PrivateStatusFilter;
  collectionLevel?: string;
  favoriteLevel?: FavoriteLevel | "all";
  mediaStatus?: MediaStatus | "all";
  includePrivate?: boolean;
  privateOnly?: boolean;
  includeFacets?: boolean;
  platformFilters?: string[];
  makerFilters?: string[];
  favoriteLevelFilters?: PrivateCollectionLevel[];
  personFilters?: string[];
  missingPeople?: boolean;
  qualityView?: "missing_tags" | "incomplete_metadata" | "suspected_duplicate";
  hasNote?: "all" | "yes" | "no";
  hasCover?: "all" | "yes" | "no";
  watchStatus?: WatchStatus | "all";
  type?: string;
  category?: string;
  tag?: string;
  excludeTag?: string;
  year?: number;
  platform?: string;
  maker?: string;
  series?: string;
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
  sort?: "displayName" | "rating" | "releaseDate";
  order?: "asc" | "desc";
  page: number;
  pageSize: number;
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
