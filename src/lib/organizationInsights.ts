import type { ItemInput, MediaItem } from "../types";
import { isPrivateItem } from "./privacy";
import { classifyItem } from "./taxonomy";
import { getWatchProgress, getWatchStatus, isSeriesLike, updateWatchProgress } from "./watch";

export type OrganizerIssueKind = "missing" | "progress" | "duplicate" | "naming" | "rating";
export type OrganizerSeverity = "high" | "medium" | "low";

export interface OrganizerSuggestion {
  label: string;
  patch?: Partial<ItemInput>;
  canonicalTag?: string;
  tagKey?: string;
}

export interface OrganizerIssue {
  id: string;
  kind: OrganizerIssueKind;
  severity: OrganizerSeverity;
  title: string;
  detail: string;
  items: MediaItem[];
  suggestions?: OrganizerSuggestion[];
  metadataAction?: boolean;
}

const canonicalTypes: Record<string, string> = {
  movie: "電影",
  film: "電影",
  tv: "影集",
  "tv show": "影集",
  series: "影集",
  anime: "動畫",
  animation: "動畫",
  youtube: "YouTube",
  yt: "YouTube"
};

const canonicalPlatforms: Record<string, string> = {
  netflix: "Netflix",
  disney: "Disney+",
  "disney+": "Disney+",
  "prime video": "Prime Video",
  prime: "Prime Video",
  "apple tv": "Apple TV+",
  "apple tv+": "Apple TV+",
  youtube: "YouTube",
  yt: "YouTube",
  bilibili: "B站",
  "b站": "B站"
};

export function buildOrganizerIssues(items: MediaItem[], ignoredIds: Set<string>, privateMode: boolean) {
  const scopedItems = privateMode ? items.filter(isPrivateItem) : items.filter((item) => !isPrivateItem(item));
  const issues = [
    ...missingDataIssues(scopedItems),
    ...progressIssues(scopedItems),
    ...ratingIssues(scopedItems),
    ...duplicateIssues(scopedItems),
    ...namingIssues(scopedItems)
  ];
  return issues.filter((issue) => !ignoredIds.has(issue.id));
}

function missingDataIssues(items: MediaItem[]): OrganizerIssue[] {
  return items.flatMap((item) => {
    const issues: OrganizerIssue[] = [];
    const title = item.official_title || item.raw_title;
    const classification = classifyItem(item);
    if (!item.cover_url && !isPrivateItem(item)) {
      issues.push({
        id: issueId("missing-cover", [item]),
        kind: "missing",
        severity: "medium",
        title: "缺少封面",
        detail: `${title} 沒有封面，海報牆和首頁會比較難掃描。`,
        items: [item],
        metadataAction: true
      });
    }
    if (!item.type || item.type === "Other" || item.type === "其他") {
      issues.push({
        id: issueId("missing-type", [item]),
        kind: "missing",
        severity: "medium",
        title: "缺少類型",
        detail: `${title} 尚未整理媒體類型。`,
        items: [item],
        suggestions: [{ label: `套用 ${classification.type}`, patch: { type: classification.type, category: classification.category || item.category } }]
      });
    }
    if (!item.platform && !isPrivateItem(item)) {
      issues.push({
        id: issueId("missing-platform", [item]),
        kind: "missing",
        severity: "low",
        title: "缺少平台",
        detail: `${title} 沒有平台 / 來源，之後篩選會比較鬆散。`,
        items: [item]
      });
    }
    if (!item.release_year && !isPrivateItem(item)) {
      issues.push({
        id: issueId("missing-year", [item]),
        kind: "missing",
        severity: "low",
        title: "缺少年份",
        detail: `${title} 沒有年份，年度回顧和排序會少一塊線索。`,
        items: [item],
        metadataAction: true
      });
    }
    if (item.rating === null && getWatchStatus(item) === "completed") {
      issues.push({
        id: issueId("missing-rating", [item]),
        kind: "missing",
        severity: "low",
        title: "看完但未評分",
        detail: `${title} 已標記看完，但還沒有評分。`,
        items: [item]
      });
    }
    return issues;
  });
}

function progressIssues(items: MediaItem[]): OrganizerIssue[] {
  const today = new Date();
  return items.flatMap((item) => {
    const issues: OrganizerIssue[] = [];
    const status = getWatchStatus(item);
    const progress = getWatchProgress(item);
    const title = item.official_title || item.raw_title;
    if (status === "watching" && isSeriesLike(item) && !progress.current_episode && !progress.current_season) {
      issues.push({
        id: issueId("missing-progress", [item]),
        kind: "progress",
        severity: "medium",
        title: "觀看中但缺進度",
        detail: `${title} 是觀看中，但沒有目前季數或集數。`,
        items: [item]
      });
    }
    if (status === "completed" && !item.watched_at && !item.completed_at) {
      issues.push({
        id: issueId("completed-no-date", [item]),
        kind: "progress",
        severity: "medium",
        title: "看完但缺日期",
        detail: `${title} 已看完，但缺少觀看日期。`,
        items: [item],
        suggestions: [{ label: "補今天為觀看日", patch: { watched_at: todayKey(today) } }]
      });
    }
    if (status === "plan_to_watch" && daysSince(item.planned_at || item.created_at, today) >= 90) {
      issues.push({
        id: issueId("stale-plan", [item]),
        kind: "progress",
        severity: "low",
        title: "待觀看停留過久",
        detail: `${title} 已在待觀看超過 90 天，可以考慮暫停或放棄。`,
        items: [item],
        suggestions: [
          { label: "改為暫停", patch: updateWatchProgress(item, { watch_status: "paused" }) },
          { label: "改為已放棄", patch: updateWatchProgress(item, { watch_status: "dropped" }) }
        ]
      });
    }
    return issues;
  });
}

function ratingIssues(items: MediaItem[]): OrganizerIssue[] {
  return items
    .filter((item) => item.rating !== null && (item.rating < 0 || item.rating > 10))
    .map((item) => ({
      id: issueId("rating-out-of-range", [item]),
      kind: "rating" as const,
      severity: "high" as const,
      title: "評分超出範圍",
      detail: `${item.official_title || item.raw_title} 的評分是 ${item.rating}，建議維持在 0-10。`,
      items: [item],
      suggestions: [{ label: "夾到 0-10", patch: { rating: Math.max(0, Math.min(10, Number(item.rating))) } }]
    }));
}

function duplicateIssues(items: MediaItem[]): OrganizerIssue[] {
  const groups = new Map<string, MediaItem[]>();
  for (const item of items) {
    for (const key of duplicateKeys(item)) {
      const list = groups.get(key) || [];
      list.push(item);
      groups.set(key, list);
    }
  }
  return Array.from(groups.entries())
    .filter(([, group]) => new Set(group.map((item) => item.id)).size > 1)
    .map(([key, group]) => {
      const uniqueGroup = Array.from(new Map(group.map((item) => [item.id, item])).values());
      return {
        id: `duplicate:${key}`,
        kind: "duplicate" as const,
        severity: "high" as const,
        title: "疑似重複紀錄",
        detail: uniqueGroup.map((item) => item.official_title || item.raw_title).join(" / "),
        items: uniqueGroup
      };
    });
}

function namingIssues(items: MediaItem[]): OrganizerIssue[] {
  const issues: OrganizerIssue[] = [];
  for (const item of items) {
    const normalizedType = canonicalTypes[normalizeText(item.type || "")];
    if (normalizedType && item.type !== normalizedType) {
      issues.push({
        id: issueId(`type-${normalizeText(item.type || "")}`, [item]),
        kind: "naming",
        severity: "low",
        title: "類型命名不一致",
        detail: `${item.official_title || item.raw_title} 使用「${item.type}」，可統一為「${normalizedType}」。`,
        items: [item],
        suggestions: [{ label: `改為 ${normalizedType}`, patch: { type: normalizedType } }]
      });
    }
    const normalizedPlatform = canonicalPlatforms[normalizeText(item.platform || "")];
    if (normalizedPlatform && item.platform !== normalizedPlatform) {
      issues.push({
        id: issueId(`platform-${normalizeText(item.platform || "")}`, [item]),
        kind: "naming",
        severity: "low",
        title: "平台命名不一致",
        detail: `${item.official_title || item.raw_title} 使用「${item.platform}」，可統一為「${normalizedPlatform}」。`,
        items: [item],
        suggestions: [{ label: `改為 ${normalizedPlatform}`, patch: { platform: normalizedPlatform } }]
      });
    }
  }
  issues.push(...tagCasingIssues(items));
  return issues;
}

function tagCasingIssues(items: MediaItem[]) {
  const tags = new Map<string, Set<string>>();
  for (const item of items) {
    for (const tag of item.tags) {
      const key = normalizeText(tag);
      if (!key) continue;
      const values = tags.get(key) || new Set<string>();
      values.add(tag);
      tags.set(key, values);
    }
  }
  return Array.from(tags.entries())
    .filter(([, variants]) => variants.size > 1)
    .map(([key, variants]) => {
      const canonical = Array.from(variants).sort((a, b) => a.length - b.length || a.localeCompare(b, "zh-Hant"))[0];
      const affected = items.filter((item) => item.tags.some((tag) => normalizeText(tag) === key && tag !== canonical));
      return {
        id: `tag:${key}`,
        kind: "naming" as const,
        severity: "low" as const,
        title: "標籤命名不一致",
        detail: `可將 ${Array.from(variants).join(" / ")} 統一為 #${canonical}。`,
        items: affected,
        suggestions: affected.length > 0 ? [{ label: `統一為 #${canonical}`, canonicalTag: canonical, tagKey: key }] : []
      };
    });
}

function duplicateKeys(item: MediaItem) {
  const keys = new Set<string>();
  const title = normalizeTitle(item.official_title || item.raw_title);
  const originalTitle = normalizeTitle(item.original_title || "");
  const code = normalizeText(item.code || "");
  if (title) keys.add(`title:${title}:${item.release_year || ""}:${normalizeText(item.platform || "")}`);
  if (originalTitle) keys.add(`title:${originalTitle}:${item.release_year || ""}:${normalizeText(item.platform || "")}`);
  if (code) keys.add(`code:${code}`);
  return Array.from(keys);
}

function issueId(prefix: string, items: MediaItem[]) {
  return `${prefix}:${items.map((item) => item.id).join(":")}`;
}

function daysSince(value: string | null, today: Date) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.floor((today.getTime() - date.getTime()) / 86400000);
}

function todayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeTitle(value: string) {
  return normalizeText(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}
