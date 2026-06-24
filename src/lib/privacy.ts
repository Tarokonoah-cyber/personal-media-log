import type { MediaItem } from "../types";

export const PRIVATE_LIBRARY_LABEL = "\u79c1\u5bc6";

const PRIVATE_CONTAINS_TERMS = [
  "adult",
  "nsfw",
  "private",
  "porn",
  "porno",
  "pornography",
  "jav",
  "r18",
  "18+",
  "xxx",
  "\u6210\u4eba",
  "\u79c1\u5bc6"
];

const PRIVATE_TOKEN_TERMS = ["av"];

const CODE_KEYS = ["code", "product_code", "productCode", "productCodeText", "dvd_id", "dvdId", "content_id", "contentId", "cid", "number"];
const PERFORMER_KEYS = ["cast", "actors", "actor", "actresses", "actress", "performers", "performer", "stars", "star"];
const STUDIO_KEYS = ["studio", "maker", "label", "publisher", "manufacturer", "production_company", "productionCompany"];
const YEAR_KEYS = ["release_date", "released_at", "release_year", "released_year", "year", "date"];
const TITLE_KEYS = ["title", "name", "movie_title", "movieTitle"];

type MetadataRecord = Record<string, unknown>;

export interface PrivateItemDetails {
  code: string;
  title: string;
  performers: string;
  studio: string;
  releaseYear: string;
  type: string;
}

export function isPrivateLibraryLabel(label: string) {
  return normalize(label) === normalize(PRIVATE_LIBRARY_LABEL);
}

export function isPrivateItem(item: MediaItem) {
  if (item.is_private) return true;
  return hasPrivateSignal([item.type, item.category, item.platform, item.metadata_json, ...item.tags]);
}

export function hasPrivateSignal(values: unknown[]) {
  const text = values.flatMap(flattenValue).filter(Boolean).join(" ");
  return hasPrivateSignalText(text);
}

export function isPrivateMarker(value: string) {
  const normalized = normalize(value);
  return PRIVATE_CONTAINS_TERMS.includes(normalized) || PRIVATE_TOKEN_TERMS.includes(normalized);
}

export function privateItemDetails(item: MediaItem): PrivateItemDetails {
  const metadata = parseMetadata(item.metadata_json);
  const code = firstValue([item.code, metadataValue(metadata, CODE_KEYS), codeFromTitle(item.original_title), codeFromTitle(item.raw_title)]) || "-";
  return {
    code,
    title: privateTitle(item, metadata, code),
    performers: firstValue([metadataValue(metadata, PERFORMER_KEYS), item.people.join(", ")]) || "-",
    studio: metadataValue(metadata, STUDIO_KEYS) || "-",
    releaseYear: firstValue([item.release_year?.toString(), yearFromValue(metadataValue(metadata, YEAR_KEYS))]) || "-",
    type: firstValue([item.category, item.type !== PRIVATE_LIBRARY_LABEL ? item.type : null, PRIVATE_LIBRARY_LABEL]) || PRIVATE_LIBRARY_LABEL
  };
}

function privateTitle(item: MediaItem, metadata: MetadataRecord, code: string) {
  const title = firstValue([metadataValue(metadata, TITLE_KEYS), item.official_title, titleIfNotCode(item.raw_title, code), titleIfNotCode(item.original_title, code)]);
  return title || "-";
}

function titleIfNotCode(value: string | null, code: string) {
  if (!value) return null;
  if (code !== "-" && normalize(value).replace(/[-_\s]+/g, "") === normalize(code).replace(/[-_\s]+/g, "")) return null;
  return value;
}

function hasPrivateSignalText(value: string) {
  const normalized = normalize(value);
  const padded = ` ${normalized.replace(/[^a-z0-9\u4e00-\u9fff+]+/g, " ")} `;
  return PRIVATE_CONTAINS_TERMS.some((term) => normalized.includes(term)) || PRIVATE_TOKEN_TERMS.some((term) => padded.includes(` ${term} `));
}

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function flattenValue(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(flattenValue);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(flattenValue);
  return [String(value)];
}

function parseMetadata(value: string | null): MetadataRecord {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as MetadataRecord : {};
  } catch {
    return {};
  }
}

function metadataValue(metadata: MetadataRecord, keys: string[]) {
  const match = findMetadataValue(metadata, new Set(keys.map((key) => key.toLowerCase())));
  return valueToText(match);
}

function findMetadataValue(value: unknown, keys: Set<string>): unknown {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findMetadataValue(entry, keys);
      if (found !== null && found !== undefined && found !== "") return found;
    }
    return null;
  }
  for (const [key, entry] of Object.entries(value as MetadataRecord)) {
    if (keys.has(key.toLowerCase())) return entry;
  }
  for (const entry of Object.values(value as MetadataRecord)) {
    const found = findMetadataValue(entry, keys);
    if (found !== null && found !== undefined && found !== "") return found;
  }
  return null;
}

function valueToText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    const text = value.map(valueToText).filter(Boolean).join(", ");
    return text || null;
  }
  if (typeof value === "object") {
    const record = value as MetadataRecord;
    return valueToText(record.name ?? record.title ?? record.value ?? Object.values(record));
  }
  const text = String(value).trim();
  return text || null;
}

function codeFromTitle(value: string | null) {
  const match = value?.match(/\b[A-Z]{2,10}[-_ ]?\d{2,6}\b/i);
  return match ? match[0].replace(/\s+/, "-").toUpperCase() : null;
}

function yearFromValue(value: string | null) {
  const match = value?.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

function firstValue(values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || null;
}
