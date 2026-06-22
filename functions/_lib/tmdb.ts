import { HttpError } from "./http";
import { getItem, updateItem } from "./items";
import type { Actor, Env, ItemInput, ItemRecord } from "./types";

const tmdbBase = "https://api.themoviedb.org/3";
const imageBase = "https://image.tmdb.org/t/p/w500";

type MediaType = "movie" | "tv";

interface TmdbSearchResult {
  id: number;
  media_type: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  origin_country?: string[];
  genre_ids?: number[];
  poster_path?: string | null;
}

interface TmdbGenre {
  id: number;
  name: string;
}

interface TmdbDetail {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  origin_country?: string[];
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  genres?: TmdbGenre[];
  networks?: Array<{ id: number; name: string }>;
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: Array<{ season_number: number; episode_count: number }>;
}

export interface TmdbCandidate {
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  original_title: string;
  year: number | null;
  country: string[];
  genres: string[];
  poster_path: string | null;
  poster_url: string | null;
}

export async function searchTmdb(env: Env, itemId?: string, query?: string) {
  const sourceItem = itemId ? await getItem(env, itemId) : null;
  const searchQuery = clean(query || sourceItem?.official_title || sourceItem?.raw_title);
  if (!searchQuery) throw new HttpError(400, "query or itemId is required");

  const [search, genres] = await Promise.all([
    tmdbFetch<{ results: TmdbSearchResult[] }>(env, "/search/multi", { query: searchQuery, include_adult: "false", language: "zh-TW", page: "1" }),
    getGenreMap(env)
  ]);

  const candidates = (search.results || [])
    .filter((result) => result.media_type === "movie" || result.media_type === "tv")
    .slice(0, 12)
    .map((result) => toCandidate(result, genres));

  return { query: searchQuery, candidates };
}

export async function applyTmdbMetadata(env: Env, actor: Actor, itemId: string, tmdbId: number, mediaType: MediaType) {
  const item = await getItem(env, itemId);
  const detail = await tmdbFetch<TmdbDetail>(env, `/${mediaType}/${tmdbId}`, { language: "zh-TW" });
  const metadata = detailToMetadata(detail, mediaType);
  const update = mergeMetadata(item, metadata);
  return updateItem(env, actor, itemId, update);
}

function detailToMetadata(detail: TmdbDetail, mediaType: MediaType) {
  const title = detail.title || detail.name || "";
  const originalTitle = detail.original_title || detail.original_name || "";
  const date = detail.release_date || detail.first_air_date || "";
  const countries = detail.origin_country?.length
    ? detail.origin_country
    : (detail.production_countries || []).map((country) => country.iso_3166_1).filter(Boolean);
  const genres = (detail.genres || []).map((genre) => genre.name).filter(Boolean);
  const networks = (detail.networks || []).map((network) => network.name).filter(Boolean);
  const seasonCount = mediaType === "tv" ? detail.number_of_seasons ?? countSeasons(detail) : null;
  const episodeCount = mediaType === "tv" ? detail.number_of_episodes ?? sumEpisodes(detail) : null;

  return {
    tmdb_id: detail.id,
    media_type: mediaType,
    title,
    original_title: originalTitle,
    release_year: yearFromDate(date),
    country: countries,
    origin_country: detail.origin_country || [],
    genres,
    poster_path: detail.poster_path || null,
    poster_url: detail.poster_path ? `${imageBase}${detail.poster_path}` : null,
    season_count: seasonCount,
    episode_count: episodeCount,
    networks,
    tmdb_source: `https://www.themoviedb.org/${mediaType}/${detail.id}`
  };
}

function mergeMetadata(item: ItemRecord, metadata: ReturnType<typeof detailToMetadata>): ItemInput {
  const existingTags = new Set(item.tags);
  for (const genre of metadata.genres) existingTags.add(genre);
  if (metadata.media_type === "movie") existingTags.add("TMDb Movie");
  if (metadata.media_type === "tv") existingTags.add("TMDb TV");

  const previousMetadata = parseMetadata(item.metadata_json);
  const mergedMetadata = {
    ...previousMetadata,
    tmdb_id: metadata.tmdb_id,
    media_type: metadata.media_type,
    country: metadata.country,
    origin_country: metadata.origin_country,
    genres: metadata.genres,
    poster_path: metadata.poster_path,
    poster_url: metadata.poster_url,
    season_count: metadata.season_count,
    episode_count: metadata.episode_count,
    networks: metadata.networks,
    tmdb_source: metadata.tmdb_source,
    updated_from_tmdb_at: new Date().toISOString()
  };

  return {
    raw_title: item.raw_title,
    official_title: metadata.title || item.official_title,
    original_title: metadata.original_title || item.original_title,
    code: item.code,
    type: metadata.media_type === "movie" ? "Movie" : "Series",
    category: metadata.country[0] || item.category,
    platform: metadata.networks[0] || item.platform,
    release_year: metadata.release_year ?? item.release_year,
    watched_at: item.watched_at,
    started_at: item.started_at,
    completed_at: item.completed_at,
    planned_at: item.planned_at,
    rating: item.rating,
    rewatch_score: item.rewatch_score,
    favorite: item.favorite,
    is_private: item.is_private,
    status: item.status === "raw" ? "partial" : item.status,
    quick_note: item.quick_note,
    long_note: item.long_note,
    source_url: metadata.tmdb_source || item.source_url,
    cover_url: metadata.poster_url || item.cover_url,
    metadata_json: JSON.stringify(mergedMetadata),
    progress_json: item.progress_json,
    tags: Array.from(existingTags),
    people: item.people,
    collections: item.collections
  };
}

function toCandidate(result: TmdbSearchResult, genres: Map<number, string>): TmdbCandidate {
  const title = result.title || result.name || "";
  const originalTitle = result.original_title || result.original_name || "";
  const date = result.release_date || result.first_air_date || "";
  return {
    tmdb_id: result.id,
    media_type: result.media_type as MediaType,
    title,
    original_title: originalTitle,
    year: yearFromDate(date),
    country: result.origin_country || [],
    genres: (result.genre_ids || []).map((id) => genres.get(id)).filter((name): name is string => Boolean(name)),
    poster_path: result.poster_path || null,
    poster_url: result.poster_path ? `${imageBase}${result.poster_path}` : null
  };
}

async function getGenreMap(env: Env) {
  const [movie, tv] = await Promise.all([
    tmdbFetch<{ genres: TmdbGenre[] }>(env, "/genre/movie/list", { language: "zh-TW" }),
    tmdbFetch<{ genres: TmdbGenre[] }>(env, "/genre/tv/list", { language: "zh-TW" })
  ]);
  const map = new Map<number, string>();
  for (const genre of [...(movie.genres || []), ...(tv.genres || [])]) map.set(genre.id, genre.name);
  return map;
}

async function tmdbFetch<T>(env: Env, path: string, params: Record<string, string>) {
  const url = new URL(`${tmdbBase}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const headers: HeadersInit = { accept: "application/json" };
  if (env.TMDB_READ_TOKEN) {
    headers.authorization = `Bearer ${env.TMDB_READ_TOKEN}`;
  } else if (env.TMDB_API_KEY) {
    url.searchParams.set("api_key", env.TMDB_API_KEY);
  } else {
    throw new HttpError(503, "TMDB_READ_TOKEN is not configured");
  }

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    throw new HttpError(response.status, "TMDb request failed", await response.text());
  }
  return response.json() as Promise<T>;
}

function yearFromDate(date: string) {
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : null;
}

function countSeasons(detail: TmdbDetail) {
  return (detail.seasons || []).filter((season) => season.season_number > 0).length;
}

function sumEpisodes(detail: TmdbDetail) {
  const total = (detail.seasons || []).reduce((sum, season) => season.season_number > 0 ? sum + (season.episode_count || 0) : sum, 0);
  return total || null;
}

function parseMetadata(value: string | null) {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || "";
}
