import Papa from "papaparse";
import type { ItemInput } from "../types";

export const importFields = [
  "raw_title",
  "official_title",
  "original_title",
  "code",
  "type",
  "category",
  "platform",
  "release_year",
  "watched_at",
  "started_at",
  "completed_at",
  "planned_at",
  "rating",
  "rewatch_score",
  "favorite",
  "status",
  "quick_note",
  "long_note",
  "source_url",
  "cover_url",
  "metadata_json",
  "progress_json",
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
    release_year: numberValue(row.release_year),
    watched_at: nullableString(row.watched_at),
    started_at: nullableString(row.started_at),
    completed_at: nullableString(row.completed_at),
    planned_at: nullableString(row.planned_at),
    rating: numberValue(row.rating),
    rewatch_score: numberValue(row.rewatch_score),
    favorite: booleanValue(row.favorite),
    status: statusValue(row.status),
    quick_note: nullableString(row.quick_note),
    long_note: nullableString(row.long_note),
    source_url: nullableString(row.source_url),
    cover_url: nullableString(row.cover_url),
    metadata_json: nullableString(row.metadata_json),
    progress_json: nullableString(row.progress_json),
    tags: listValue(row.tags),
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
  return ["true", "1", "yes", "y", "收藏", "favorite"].includes(text);
}

function listValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((entry) => entry.trim()).filter(Boolean);
  return stringValue(value).split(/[|,#]/).map((entry) => entry.trim()).filter(Boolean);
}

function statusValue(value: unknown) {
  const text = stringValue(value);
  return text === "raw" || text === "partial" || text === "complete" || text === "archived" || text === "deleted" ? text : "raw";
}
