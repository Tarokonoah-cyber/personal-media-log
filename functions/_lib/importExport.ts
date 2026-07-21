import type { ItemInput } from "./types";
import { hasPrivateSignalValues, isPrivateMarker as isPrivateMarkerValue } from "./privacy";

export function parseJsonItems(content: string): ItemInput[] {
  const parsed = JSON.parse(content) as unknown;
  if (Array.isArray(parsed)) return parsed.map(normalizeExternalRow);
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)) {
    return ((parsed as { items: unknown[] }).items).map(normalizeExternalRow);
  }
  throw new Error("JSON must be an array or an object with an items array");
}

export function parseCsv(content: string) {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);

  const [headerRow = [], ...dataRows] = rows.filter((entry) => entry.some((cellValue) => cellValue.trim()));
  const columns = headerRow.map((entry) => entry.trim());
  const records = dataRows.map((entry) => Object.fromEntries(columns.map((column, index) => [column, entry[index] || ""])));
  return { columns, records };
}

export function toCsv(rows: Record<string, unknown>[]) {
  const headers = [
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
    "tags",
    "people",
    "collections",
    "created_at",
    "updated_at"
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(","));
  }
  return lines.join("\n");
}

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join("|") : value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function normalizeExternalRow(value: unknown): ItemInput {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  return {
    raw_title: asString(row.raw_title ?? row.title ?? row.name),
    official_title: asString(row.official_title),
    original_title: asString(row.original_title),
    code: asString(row.code),
    type: asString(row.type),
    category: asString(row.category),
    platform: asString(row.platform),
    maker: asString(row.maker ?? row.studio),
    series: asString(row.series),
    release_year: asNumber(row.release_year ?? row.year),
    release_date: asString(row.release_date ?? row.released_at),
    year: asNumber(row.year ?? row.release_year),
    watched_at: asString(row.watched_at),
    started_at: asString(row.started_at),
    completed_at: asString(row.completed_at),
    planned_at: asString(row.planned_at),
    rating: asNumber(row.rating),
    rewatch_score: asNumber(row.rewatch_score),
    favorite: asBoolean(row.favorite),
    favorite_level: asFavoriteLevel(row.favorite_level ?? row.collection_level),
    used: asBoolean(row.used),
    is_private: asBoolean(row.is_private) || hasPrivateSignalValues([row.type, row.category, row.platform, row.metadata_json, row.genres, row.tags]),
    status: asStatus(row.status),
    media_status: asMediaStatus(row.media_status),
    quick_note: asString(row.quick_note ?? row.note),
    long_note: asString(row.long_note),
    source_url: asString(row.source_url),
    cover_url: asString(row.cover_url),
    metadata_json: asString(row.metadata_json),
    progress_json: asString(row.progress_json),
    tags: asList(row.tags).filter((tag) => !isPrivateMarkerValue(tag)),
    people: asList(row.people),
    collections: asList(row.collections)
  };
}

function hasPrivateSignal(row: Record<string, unknown>) {
  const text = [
    row.type,
    row.category,
    row.platform,
    row.metadata_json,
    row.genres,
    row.tags
  ].flatMap((value) => Array.isArray(value) ? value : [value]).filter(Boolean).join(" ").toLowerCase();
  return ["adult", "nsfw", "private", "成人", "私密"].some((term) => text.includes(term.toLowerCase()));
}

function isPrivateMarker(value: string) {
  const text = value.trim().toLowerCase();
  return text === "adult" || text === "nsfw" || text === "private" || text === "成人" || text === "私密";
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;
  return ["true", "1", "yes", "y", "favorite", "收藏", "private", "私密"].includes(value.trim().toLowerCase());
}

function asList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((entry) => entry.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/[|,#]/).map((entry) => entry.trim()).filter(Boolean);
  return [];
}

function asStatus(value: unknown) {
  return value === "raw" || value === "partial" || value === "complete" || value === "archived" || value === "deleted" ? value : undefined;
}

function asFavoriteLevel(value: unknown) {
  return value === "神作" || value === "收藏" || value === "一般" || value === "雷片" || value === "已刪" ? value : undefined;
}

function asMediaStatus(value: unknown) {
  return value === "待觀看" || value === "已觀看" || value === "想重看" || value === "已刪除" ? value : undefined;
}
