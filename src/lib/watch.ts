import { classifyItem } from "./taxonomy";
import type { ItemInput, ItemStatus, MediaItem, WatchProgress, WatchStatus } from "../types";

export const watchStatuses: Array<{ value: WatchStatus; label: string; legacy: ItemStatus }> = [
  { value: "plan_to_watch", label: "待觀看", legacy: "raw" },
  { value: "watching", label: "觀看中", legacy: "partial" },
  { value: "completed", label: "看完", legacy: "complete" },
  { value: "paused", label: "暫停", legacy: "partial" },
  { value: "dropped", label: "已放棄", legacy: "archived" },
  { value: "rewatching", label: "重看中", legacy: "partial" }
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
  const progress = getWatchProgress(item);
  if (isProgressComplete(progress)) return "completed";
  return progress.watch_status || legacyToWatchStatus(item.status);
}

export function watchToLegacyStatus(status: WatchStatus): ItemStatus {
  return watchStatuses.find((entry) => entry.value === status)?.legacy || "raw";
}

export function updateWatchProgress(item: MediaItem, patch: WatchProgress): Partial<ItemInput> {
  const current = getWatchProgress(item);
  const next = { ...current, ...patch };
  const watchStatus = isProgressComplete(next) ? "completed" : next.watch_status || getWatchStatus(item);
  return {
    status: watchToLegacyStatus(watchStatus),
    progress_json: JSON.stringify({ ...next, watch_status: watchStatus })
  };
}

export function isSeriesLike(item: MediaItem) {
  return ["影集", "沙雕动画"].includes(classifyItem(item).type);
}

export function progressLabel(item: MediaItem) {
  if (!isSeriesLike(item)) return "";
  const progress = getWatchProgress(item);
  const current = progress.current_season || progress.current_episode
    ? `S${progress.current_season || 1} E${progress.current_episode || 0}`
    : "";
  const totals = [
    progress.total_seasons ? `共 ${progress.total_seasons} 季` : "",
    progress.total_episodes ? `共 ${progress.total_episodes} 集` : ""
  ].filter(Boolean).join(" · ");
  return [current, totals].filter(Boolean).join(" / ");
}

export function displayDateForItem(item: MediaItem) {
  return item.watched_at || item.planned_at || item.completed_at || item.started_at || item.created_at;
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

function isProgressComplete(progress: WatchProgress) {
  const total = numberOrNull(progress.total_episodes);
  const current = numberOrNull(progress.current_episode);
  return Boolean(total && current && current >= total);
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
