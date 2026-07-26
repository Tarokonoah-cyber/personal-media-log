import { PRIVATE_DEFAULT_ACTRESS } from "../../shared/privateModel";
import { normalizeTags } from "./tags";
import type { PrivateSimpleAddDraft } from "./privateSimpleAddDraft";

export const PRIVATE_ADD_RECENTS_KEY = "private-add-recents-v1";

export type PrivateAddRecents = {
  schemaVersion: 1;
  tags: string[];
  actresses: string[];
  makers: string[];
};

type RecentsStorage = Pick<Storage, "getItem" | "setItem">;

const emptyRecents: PrivateAddRecents = {
  schemaVersion: 1,
  tags: [],
  actresses: [],
  makers: []
};

export function readPrivateAddRecents(
  storage: RecentsStorage | undefined = browserStorage()
): PrivateAddRecents {
  if (!storage) return emptyRecents;
  try {
    const parsed = JSON.parse(storage.getItem(PRIVATE_ADD_RECENTS_KEY) || "null") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return emptyRecents;
    const value = parsed as Record<string, unknown>;
    if (value.schemaVersion !== 1) return emptyRecents;
    return {
      schemaVersion: 1,
      tags: cleanList(value.tags, 12),
      actresses: cleanList(value.actresses, 8).filter((entry) => entry !== PRIVATE_DEFAULT_ACTRESS),
      makers: cleanList(value.makers, 8)
    };
  } catch {
    return emptyRecents;
  }
}

export function updatePrivateAddRecents(
  draft: PrivateSimpleAddDraft,
  storage: RecentsStorage | undefined = browserStorage()
): PrivateAddRecents | null {
  if (!storage) return null;
  try {
    const current = readPrivateAddRecents(storage);
    const next: PrivateAddRecents = {
      schemaVersion: 1,
      tags: prepend(current.tags, draft.tags, 12),
      actresses: prepend(
        current.actresses,
        draft.actress === PRIVATE_DEFAULT_ACTRESS ? [] : splitValues(draft.actress),
        8
      ),
      makers: prepend(current.makers, draft.maker ? [draft.maker] : [], 8)
    };
    storage.setItem(PRIVATE_ADD_RECENTS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

function prepend(current: string[], newest: string[], limit: number) {
  return normalizeTags([...newest, ...current]).slice(0, limit);
}

function cleanList(value: unknown, limit: number) {
  return normalizeTags(Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []).slice(0, limit);
}

function splitValues(value: string) {
  return value.split(/[,，、\n]+/g).map((entry) => entry.trim()).filter(Boolean);
}

function browserStorage(): RecentsStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
