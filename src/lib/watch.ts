import { classifyItem } from "./taxonomy";
import type { ItemInput, ItemStatus, MediaItem, WatchProgress, WatchStatus } from "../types";

export const watchStatuses: Array<{ value: WatchStatus; label: string; legacy: ItemStatus }> = [
  { value: "plan_to_watch", label: "Plan to Watch", legacy: "raw" },
  { value: "watching", label: "Watching", legacy: "partial" },
  { value: "completed", label: "Completed", legacy: "complete" },
  { value: "paused", label: "Paused", legacy: "partial" },
  { value: "dropped", label: "Dropped", legacy: "archived" },
  { value: "rewatching", label: "Rewatching", legacy: "partial" }
];

export function getWatchProgress(item: MediaItem): WatchProgress {
  const progress = parseJson<WatchProgress>(item.progress_json);
  const metadata = parseJson<Record<string, unknown>>(item.metadata_json);
  return {
    ...progress,
    watch_status: progress.watch_status || legacyToWatchStatus(item.status),
    total_seasons: numberOrNull(progress.total_seasons) ?? numberOrNull(metadata.season_count),
    total_episodes: numberOrNull(progress.total_episodes) ?? numberOrNull(metadata.episode_count)
  };
}

export function getWatchStatus(item: MediaItem): WatchStatus {
  return getWatchProgress(item).watch_status || legacyToWatchStatus(item.status);
}

export function watchToLegacyStatus(status: WatchStatus): ItemStatus {
  return watchStatuses.find((entry) => entry.value === status)?.legacy || "raw";
}

export function updateWatchProgress(item: MediaItem, patch: WatchProgress): Partial<ItemInput> {
  const current = getWatchProgress(item);
  const next = { ...current, ...patch };
  const watchStatus = next.watch_status || getWatchStatus(item);
  return {
    status: watchToLegacyStatus(watchStatus),
    progress_json: JSON.stringify(next)
  };
}

export function isSeriesLike(item: MediaItem) {
  const type = classifyItem(item).type;
  return type === "Series";
}

export function progressLabel(item: MediaItem) {
  if (!isSeriesLike(item)) return "";
  const progress = getWatchProgress(item);
  const current = progress.current_season || progress.current_episode
    ? `S${progress.current_season || 1} E${progress.current_episode || 0}`
    : "";
  const totals = [
    progress.total_seasons ? `${progress.total_seasons} seasons` : "",
    progress.total_episodes ? `${progress.total_episodes} episodes` : ""
  ].filter(Boolean).join(" · ");
  return [current, totals].filter(Boolean).join(" / ");
}

export function displayDateForItem(item: MediaItem) {
  return item.completed_at || item.started_at || item.planned_at || item.watched_at || item.created_at;
}

export function watchStatusLabel(status: WatchStatus) {
  return watchStatuses.find((entry) => entry.value === status)?.label || status;
}

function legacyToWatchStatus(status: ItemStatus): WatchStatus {
  if (status === "complete") return "completed";
  if (status === "partial") return "watching";
  if (status === "archived") return "dropped";
  return "plan_to_watch";
}

function parseJson<T>(value: string | null): T {
  if (!value) return {} as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return {} as T;
  }
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
