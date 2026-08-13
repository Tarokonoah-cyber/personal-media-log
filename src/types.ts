export type ItemStatus = "raw" | "partial" | "complete" | "archived" | "deleted";
export type WatchStatus = "plan_to_watch" | "watching" | "completed" | "paused" | "dropped" | "rewatching";
import type { CollectionLevel } from "../shared/privateModel";
import type { PrivateStatusFilter } from "../shared/privateStatus";

export type FavoriteLevel = "已使用" | "神作" | "收藏" | "一般" | "雷片" | "已刪";
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
  release_date: string | null;
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

export interface PrivateCodeConflict {
  id: string;
  code: string;
  title: string;
}

export interface PrivateCodeConflictResponse {
  conflict: PrivateCodeConflict | null;
}

export type PrivateIssueType = "duplicate_code" | "duplicate_metadata" | "metadata_conflict" | "normalization_needed" | "unknown_platform" | "missing_title" | "suspicious_title" | "missing_maker" | "incomplete_metadata" | "missing_people" | "missing_tags" | "too_few_tags" | "missing_cover" | "unrated" | "unset_collection" | "invalid_collection" | "invalid_code";
export interface PrivateQualitySummaryItem { type: PrivateIssueType; label: string; count: number; }
export interface CompletenessReason {
  code: string; label: string; field: string; weight: number; severity: "high" | "medium" | "low";
}
export interface PrivateQualityIssue {
  item_id: string; code: string; title: string; platform: string | null; collection_level: string;
  original_value: string; suggestion: string; issue_key: string;
  completeness_score: number; completeness_profile: "fc2" | "jav" | "private"; reasons: CompletenessReason[];
}
export interface PrivateQualityResponse {
  summary?: PrivateQualitySummaryItem[]; ignoredCount?: number; issueType?: PrivateIssueType; label?: string;
  page?: number; pageSize?: number; total?: number; issues?: PrivateQualityIssue[];
}

export type MetadataSuggestionStatus = "pending" | "accepted" | "rejected" | "ignored";
export type MetadataSuggestionField = "official_title" | "platform" | "maker";
export interface MetadataSuggestion {
  id: string; item_id: string; field: MetadataSuggestionField; current_value: string | null; suggested_value: string;
  source: string; reason: string; status: MetadataSuggestionStatus; created_at: string; code: string | null; title: string | null;
}
export interface MetadataSuggestionListResponse {
  page: number; pageSize: number; total: number; suggestions: MetadataSuggestion[];
}
export interface MetadataSuggestionPreviewChange {
  suggestionId: string; itemId: string; field: MetadataSuggestionField; before: string | null; after: string; source: string; reason: string;
}
export interface MetadataSuggestionPreviewResponse { atomic: true; changes: MetadataSuggestionPreviewChange[]; }

export type NormalizationEntityType = "tag" | "person" | "maker" | "platform";
export interface NormalizationCluster {
  normalizedKey: string; canonical: string; canonicalId: string | null; aliases: string[];
  variants: Array<{ value: string; count: number }>; affectedItems: number; needsReview: boolean;
}
export interface NormalizationOverview {
  entityType: NormalizationEntityType; scanned: number; clusters: NormalizationCluster[];
}
export interface EntityMergePreview {
  entityType: "tag" | "person"; source: { id: string; name: string }; target: { id: string; name: string };
  affectedItems: number; sourceRelations: number; targetRelations: number; duplicateRelationsAvoided: number;
  before: { source: string; target: string }; after: { canonical: string; aliasAdded: string }; requiresConfirmation: true;
  mergeId?: string; applied?: boolean; recoveryAvailable?: boolean;
}

export type OrganizationInboxCategory = "new" | "missing_metadata" | "missing_tags" | "missing_people" | "duplicate_suspected" | "normalization_needed" | "metadata_conflict" | "ready" | "skipped";
export type OrganizationInboxState = "active" | "skipped" | "ready";
export interface OrganizationInboxSummary {
  needsAttention: number;
  categories: Record<OrganizationInboxCategory, number>;
}
export interface OrganizationInboxEntry {
  item: MediaItem;
  state: OrganizationInboxState;
  reasons: Array<{ code: Exclude<OrganizationInboxCategory, "ready" | "skipped">; label: string }>;
}
export interface OrganizationInboxResponse {
  category: OrganizationInboxCategory; page: number; pageSize: number; total: number; items: OrganizationInboxEntry[];
}

export type DuplicateDecision = "not_duplicate" | "ignored" | "keep_both";
export type DuplicateConfidence = "high" | "medium" | "low";
export interface DuplicateEvidence { code: string; label: string; weight: number; }
export interface DuplicateCandidate {
  pairKey: string; itemA: MediaItem; itemB: MediaItem; score: number; confidence: DuplicateConfidence; evidence: DuplicateEvidence[];
}
export interface DuplicateCandidateResponse {
  page: number; pageSize: number; total: number; truncated: boolean; candidates: DuplicateCandidate[];
}
export interface DuplicateMergeConflict {
  field: string; label: string; targetValue: unknown; sourceValue: unknown;
}
export interface DuplicateMergePreview {
  target: MediaItem; source: MediaItem; suggestedInput: ItemInput; conflicts: DuplicateMergeConflict[];
  expectedTargetUpdatedAt: string; expectedSourceUpdatedAt: string;
  union: { tags: string[]; people: string[]; collections: string[] }; requiresConfirmation: true;
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
  privateStatus: PrivateStatusFilter;
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
  qualityView?: "" | "missing_tags" | "incomplete_metadata" | "suspected_duplicate";
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
  sort?: "displayName" | "rating" | "releaseDate" | "";
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

export interface BatchUpdateOperation {
  id: string;
  input: ItemInput;
}

export interface BatchUpdateResponse {
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
    types: StatsResponse["types"];
    categories: StatsResponse["categories"];
    platforms: StatsResponse["platforms"];
    tags: StatsResponse["tags"];
    watchStatuses: StatsResponse["watchStatuses"];
  };
  stats: StatsResponse;
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
