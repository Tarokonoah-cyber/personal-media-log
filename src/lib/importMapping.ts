import Papa from "papaparse";
import { isPrivateMarker as isPrivateMarkerValue } from "./privacy";
import type { ItemInput } from "../types";

export const importFields = [
  "raw_title",
  "official_title",
  "original_title",
  "code",
  "type",
  "category",
  "platform",
  "maker",
  "series",
  "release_year",
  "release_date",
  "year",
  "watched_at",
  "started_at",
  "completed_at",
  "planned_at",
  "rating",
  "rewatch_score",
  "favorite",
  "favorite_level",
  "used",
  "is_private",
  "status",
  "media_status",
  "quick_note",
  "long_note",
  "source_url",
  "cover_url",
  "metadata_json",
  "progress_json",
  "genres",
  "tags",
  "people",
  "collections"
];

export function parseCsvLocally(content: string) {
  const result = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true });
  if (result.errors.length) throw new Error(result.errors[0].message);
  return result.data;
}

export function mapRows(rows: Array<Record<string, unknown>>, mapping: Record<string, string>): ItemInput[] {
  return rows
    .map((row) => {
      const item: Record<string, unknown> = {};
      for (const [source, target] of Object.entries(mapping)) {
        if (!target) continue;
        item[target] = row[source];
      }
      return normalizeItem(item);
    })
    .filter((item) => item.raw_title);
}

function normalizeItem(row: Record<string, unknown>): ItemInput {
  return {
    raw_title: stringValue(row.raw_title),
    official_title: nullableString(row.official_title),
    original_title: nullableString(row.original_title),
    code: nullableString(row.code),
    type: nullableString(row.type),
    category: nullableString(row.category),
    platform: nullableString(row.platform),
    maker: nullableString(row.maker ?? row.studio),
    series: nullableString(row.series),
    release_year: numberValue(row.release_year ?? row.year),
    release_date: nullableString(row.release_date ?? row.released_at),
    year: numberValue(row.year ?? row.release_year),
    watched_at: nullableString(row.watched_at),
    started_at: nullableString(row.started_at),
    completed_at: nullableString(row.completed_at),
    planned_at: nullableString(row.planned_at),
    rating: numberValue(row.rating),
    rewatch_score: numberValue(row.rewatch_score),
    favorite: booleanValue(row.favorite),
    favorite_level: favoriteLevelValue(row.favorite_level ?? row.collection_level),
    used: booleanValue(row.used),
    is_private: booleanValue(row.is_private),
    status: statusValue(row.status),
    media_status: mediaStatusValue(row.media_status),
    quick_note: nullableString(row.quick_note),
    long_note: nullableString(row.long_note),
    source_url: nullableString(row.source_url),
    cover_url: nullableString(row.cover_url),
    metadata_json: nullableString(row.metadata_json),
    progress_json: nullableString(row.progress_json),
    tags: listValue(row.tags).filter((tag) => !isPrivateMarkerValue(tag)),
    people: listValue(row.people),
    collections: listValue(row.collections)
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function nullableString(value: unknown) {
  const text = stringValue(value);
  return text || null;
}

function numberValue(value: unknown) {
  const text = stringValue(value);
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function booleanValue(value: unknown) {
  const text = stringValue(value).toLowerCase();
  return ["true", "1", "yes", "y", "收藏", "favorite", "private", "私密"].includes(text);
}

function listValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((entry) => entry.trim()).filter(Boolean);
  return stringValue(value).split(/[|,#]/).map((entry) => entry.trim()).filter(Boolean);
}

function statusValue(value: unknown) {
  const text = stringValue(value);
  return text === "raw" || text === "partial" || text === "complete" || text === "archived" || text === "deleted" ? text : "raw";
}

function favoriteLevelValue(value: unknown) {
  const text = stringValue(value);
  return text === "神作" || text === "收藏" || text === "一般" || text === "雷片" || text === "已刪" ? text : "一般";
}

function mediaStatusValue(value: unknown) {
  const text = stringValue(value);
  return text === "待觀看" || text === "已觀看" || text === "想重看" || text === "已刪除" ? text : "待觀看";
}
