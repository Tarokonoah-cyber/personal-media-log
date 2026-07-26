import { PRIVATE_DEFAULT_ACTRESS, privateCollectionPatch, privateRatingFromStars, type PrivateCollectionLevel } from "../../shared/privateModel";
import { privateItemDetails, PRIVATE_LIBRARY_LABEL } from "./privacy";
import { normalizeTags, parseTagInput } from "./tags";
import type { ItemInput, MediaItem } from "../types";

export type PrivateEditableColumn = "actress" | "maker" | "tags" | "releaseDate" | "summary";

export type PrivateIdentityDraft = {
  code: string;
  title: string;
};

export type PrivateRowDraft = {
  code: string;
  title: string;
  rating: string;
  collection: PrivateCollectionLevel;
  actress: string;
  platform: string;
  maker: string;
  tags: string;
  releaseDate: string;
  watchedAt: string;
  summary: string;
};

export function emptyPrivateRowDraft(date = new Date().toISOString().slice(0, 10)): PrivateRowDraft {
  return {
    code: "",
    title: "",
    rating: "",
    collection: "unset",
    actress: PRIVATE_DEFAULT_ACTRESS,
    platform: "",
    maker: "",
    tags: "",
    releaseDate: "",
    watchedAt: date,
    summary: ""
  };
}

export function privateRowDraftToInput(draft: PrivateRowDraft): ItemInput {
  const code = draft.code.trim();
  const title = draft.title.trim();
  const rating = privateRatingFromStars(draft.rating);
  const collection = privateCollectionPatch(draft.collection);
  const people = splitPeople(draft.actress);
  return {
    raw_title: title || code,
    official_title: title || null,
    code: code || null,
    type: PRIVATE_LIBRARY_LABEL,
    is_private: true,
    platform: cleanNullable(draft.platform),
    maker: cleanNullable(draft.maker),
    release_date: cleanNullable(draft.releaseDate),
    release_year: yearFromDate(draft.releaseDate),
    watched_at: cleanNullable(draft.watchedAt),
    rating,
    ...collection,
    media_status: "已觀看",
    quick_note: cleanNullable(draft.summary),
    tags: normalizeTags(parseTagInput(draft.tags)),
    people: people.length ? people : [PRIVATE_DEFAULT_ACTRESS],
    metadata_json: JSON.stringify({ ...(code ? { code } : {}), ...(title ? { title } : {}), used: collection.used }),
    status: "raw"
  };
}

export function privateCellValue(item: MediaItem, column: PrivateEditableColumn) {
  const details = privateItemDetails(item);
  if (column === "actress") return details.performers === "-" ? PRIVATE_DEFAULT_ACTRESS : details.performers;
  if (column === "maker") return item.maker || "";
  if (column === "tags") return item.tags.join(", ");
  if (column === "releaseDate") return item.release_date?.slice(0, 10) || "";
  return item.quick_note || "";
}

export function privateCellPatch(_item: MediaItem, column: PrivateEditableColumn, value: string): Partial<ItemInput> {
  const clean = value.trim();
  if (column === "actress") {
    const people = splitPeople(value);
    return { people: people.length ? people : [PRIVATE_DEFAULT_ACTRESS] };
  }
  if (column === "maker") return { maker: clean || null };
  if (column === "tags") return { tags: normalizeTags(parseTagInput(value)) };
  if (column === "releaseDate") return { release_date: clean || null, release_year: yearFromDate(clean) };
  return { quick_note: clean || null };
}

export function privateIdentityValue(item: MediaItem): PrivateIdentityDraft {
  const details = privateItemDetails(item);
  const code = details.code === "-" ? "" : details.code.trim();
  const rawTitle = details.title === "-" ? "" : details.title.trim();
  const title = rawTitle && rawTitle.toLocaleLowerCase() !== code.toLocaleLowerCase() ? rawTitle : "";
  return { code, title };
}

export function privateIdentityLabel(item: MediaItem) {
  const identity = privateIdentityValue(item);
  return identity.title ? `${identity.code} — ${identity.title}` : identity.code;
}

export function privateIdentityPatch(draft: PrivateIdentityDraft): Partial<ItemInput> {
  const code = draft.code.trim();
  const title = draft.title.trim();
  if (!code) throw new Error("番號不能空白");
  return {
    code,
    official_title: title || null,
    raw_title: title || code
  };
}

function cleanNullable(value: string) {
  return value.trim() || null;
}

function yearFromDate(value: string) {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(value.trim());
  return match ? Number(match[1]) : null;
}

function splitPeople(value: string) {
  return normalizeTags(value.split(/[，,、;；\n]+/g));
}
