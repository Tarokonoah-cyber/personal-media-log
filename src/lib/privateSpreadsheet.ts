import { collectionLevels, type CollectionLevel } from "../../shared/privateModel";
import { privateStatusToFields } from "../../shared/privateStatus";
import { privateItemDetails, PRIVATE_LIBRARY_LABEL } from "./privacy";
import { normalizeTags, parseTagInput } from "./tags";
import type { ItemInput, MediaItem } from "../types";

export type PrivateEditableColumn = "code" | "title" | "actress" | "platform" | "maker" | "tags" | "watchedAt" | "summary";

export type PrivateRowDraft = {
  code: string;
  title: string;
  rating: string;
  collection: CollectionLevel;
  actress: string;
  platform: string;
  maker: string;
  tags: string;
  watchedAt: string;
  summary: string;
};

export function emptyPrivateRowDraft(date = new Date().toISOString().slice(0, 10)): PrivateRowDraft {
  return {
    code: "",
    title: "",
    rating: "",
    collection: "unset",
    actress: "",
    platform: "",
    maker: "",
    tags: "",
    watchedAt: date,
    summary: ""
  };
}

export function privateRowDraftToInput(draft: PrivateRowDraft): ItemInput {
  const code = draft.code.trim();
  const title = draft.title.trim();
  const ratingValue = draft.rating.trim() ? Number(draft.rating) : null;
  const rating = ratingValue !== null && Number.isFinite(ratingValue) ? Math.min(10, Math.max(0, ratingValue)) : null;
  const statusFields = privateStatusToFields("done");
  return {
    raw_title: title || code,
    official_title: title || null,
    code: code || null,
    type: PRIVATE_LIBRARY_LABEL,
    is_private: true,
    platform: cleanNullable(draft.platform),
    maker: cleanNullable(draft.maker),
    watched_at: cleanNullable(draft.watchedAt),
    rating,
    favorite_level: draft.collection === "masterpiece" ? "神作" : draft.collection === "discard" ? "已刪" : "一般",
    collection_level: collectionLevels.includes(draft.collection) ? draft.collection : "unset",
    used: statusFields.used,
    media_status: statusFields.media_status,
    quick_note: cleanNullable(draft.summary),
    tags: normalizeTags(parseTagInput(draft.tags)),
    people: splitPeople(draft.actress),
    metadata_json: JSON.stringify({ ...(code ? { code } : {}), ...(title ? { title } : {}), used: true }),
    status: "raw"
  };
}

export function privateCellValue(item: MediaItem, column: PrivateEditableColumn) {
  const details = privateItemDetails(item);
  if (column === "code") return details.code === "-" ? "" : details.code;
  if (column === "title") return details.title === "-" ? "" : details.title;
  if (column === "actress") return details.performers === "-" ? "" : details.performers;
  if (column === "platform") return item.platform || "";
  if (column === "maker") return item.maker || "";
  if (column === "tags") return item.tags.join(", ");
  if (column === "watchedAt") return item.watched_at?.slice(0, 10) || "";
  return item.quick_note || "";
}

export function privateCellPatch(item: MediaItem, column: PrivateEditableColumn, value: string): Partial<ItemInput> {
  const clean = value.trim();
  if (column === "code") return { code: clean || null };
  if (column === "title") return { official_title: clean || null, raw_title: clean || item.code || item.raw_title };
  if (column === "actress") return { people: splitPeople(value) };
  if (column === "platform") return { platform: clean || null };
  if (column === "maker") return { maker: clean || null };
  if (column === "tags") return { tags: normalizeTags(parseTagInput(value)) };
  if (column === "watchedAt") return { watched_at: clean || null };
  return { quick_note: clean || null };
}

function cleanNullable(value: string) {
  return value.trim() || null;
}

function splitPeople(value: string) {
  return normalizeTags(value.split(/[，,、;；\n]+/g));
}
