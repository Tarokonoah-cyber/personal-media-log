import {
  PRIVATE_DEFAULT_ACTRESS,
  isPrivateCollectionLevel,
  type PrivateCollectionLevel
} from "../../shared/privateModel";
import { normalizeTags } from "./tags";

export const PRIVATE_SIMPLE_ADD_DRAFT_KEY = "private-simple-add-draft-v1";

export type PrivateSimpleAddDraft = {
  code: string;
  title: string;
  rating: string;
  collection: PrivateCollectionLevel;
  actress: string;
  platform: string;
  maker: string;
  summary: string;
  tags: string[];
  release_date: string;
  watched_at: string;
};

export type PrivateSimpleAddDraftEnvelope = {
  schemaVersion: 1;
  savedAt: string;
  draft: PrivateSimpleAddDraft;
};

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function emptyPrivateSimpleAddDraft(watchedAt = ""): PrivateSimpleAddDraft {
  return {
    code: "",
    title: "",
    rating: "",
    collection: "unset",
    actress: PRIVATE_DEFAULT_ACTRESS,
    platform: "",
    maker: "",
    summary: "",
    tags: [],
    release_date: "",
    watched_at: watchedAt
  };
}

export function hasMeaningfulPrivateDraft(draft: PrivateSimpleAddDraft) {
  return Boolean(
    draft.code.trim()
    || draft.title.trim()
    || draft.rating.trim()
    || draft.collection !== "unset"
    || (draft.actress.trim() && draft.actress.trim() !== PRIVATE_DEFAULT_ACTRESS)
    || draft.platform.trim()
    || draft.maker.trim()
    || draft.summary.trim()
    || draft.tags.length
    || draft.release_date.trim()
  );
}

export function readPrivateSimpleAddDraft(
  storage: DraftStorage | undefined = browserStorage()
): PrivateSimpleAddDraftEnvelope | null {
  if (!storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(PRIVATE_SIMPLE_ADD_DRAFT_KEY) || "null") as unknown;
    if (!isDraftEnvelope(parsed)) return null;
    const draft = normalizeDraft(parsed.draft);
    if (!hasMeaningfulPrivateDraft(draft)) return null;
    return {
      schemaVersion: 1,
      savedAt: parsed.savedAt,
      draft
    };
  } catch {
    return null;
  }
}

export function savePrivateSimpleAddDraft(
  draft: PrivateSimpleAddDraft,
  storage: DraftStorage | undefined = browserStorage(),
  savedAt = new Date().toISOString()
): PrivateSimpleAddDraftEnvelope | null {
  if (!storage) return null;
  try {
    if (!hasMeaningfulPrivateDraft(draft)) {
      storage.removeItem(PRIVATE_SIMPLE_ADD_DRAFT_KEY);
      return {
        schemaVersion: 1,
        savedAt,
        draft: normalizeDraft(draft)
      };
    }
    const envelope: PrivateSimpleAddDraftEnvelope = {
      schemaVersion: 1,
      savedAt,
      draft: normalizeDraft(draft)
    };
    storage.setItem(PRIVATE_SIMPLE_ADD_DRAFT_KEY, JSON.stringify(envelope));
    return envelope;
  } catch {
    return null;
  }
}

export function clearPrivateSimpleAddDraft(
  storage: DraftStorage | undefined = browserStorage()
) {
  if (!storage) return false;
  try {
    storage.removeItem(PRIVATE_SIMPLE_ADD_DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}

function normalizeDraft(value: unknown): PrivateSimpleAddDraft {
  const fallback = emptyPrivateSimpleAddDraft();
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const draft = value as Record<string, unknown>;
  return {
    code: stringValue(draft.code),
    title: stringValue(draft.title),
    rating: stringValue(draft.rating),
    collection: isPrivateCollectionLevel(draft.collection) ? draft.collection : "unset",
    actress: stringValue(draft.actress, PRIVATE_DEFAULT_ACTRESS),
    platform: stringValue(draft.platform),
    maker: stringValue(draft.maker),
    summary: stringValue(draft.summary),
    tags: normalizeTags(Array.isArray(draft.tags) ? draft.tags.filter((tag): tag is string => typeof tag === "string") : []),
    release_date: stringValue(draft.release_date),
    watched_at: stringValue(draft.watched_at)
  };
}

function isDraftEnvelope(value: unknown): value is {
  schemaVersion: 1;
  savedAt: string;
  draft: unknown;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const envelope = value as Record<string, unknown>;
  return envelope.schemaVersion === 1
    && typeof envelope.savedAt === "string"
    && Boolean(envelope.draft && typeof envelope.draft === "object" && !Array.isArray(envelope.draft));
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function browserStorage(): DraftStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
