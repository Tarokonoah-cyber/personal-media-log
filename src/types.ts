export type ItemStatus = "raw" | "partial" | "complete" | "archived" | "deleted";

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
  rating: number | null;
  rewatch_score: number | null;
  favorite: boolean;
  status: ItemStatus;
  quick_note: string | null;
  long_note: string | null;
  source_url: string | null;
  cover_url: string | null;
  metadata_json: string | null;
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
}

export interface ListFilters {
  query: string;
  status: "all" | "inbox" | "organized" | ItemStatus;
  favorite: boolean;
  highRated: boolean;
  type: string;
  tag: string;
  year: string;
  platform: string;
  watchedFrom: string;
  watchedTo: string;
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
  monthly: Array<{ month: string; count: number }>;
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
