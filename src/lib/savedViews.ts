import type { ListFilters } from "../types";

export const SAVED_VIEWS_KEY = "private-library-saved-views-v1";
export interface SavedPrivateView<TPreferences = unknown> {
  schemaVersion: 1; id: string; name: string; createdAt: string; updatedAt: string;
  filters: Partial<ListFilters>; sorting: { field: string; direction: "asc" | "desc" }; tablePreferences: TPreferences;
}

export function readSavedViews<TPreferences = unknown>(storage: Pick<Storage, "getItem"> | undefined = browserStorage()): SavedPrivateView<TPreferences>[] {
  if (!storage) return [];
  try {
    const value = JSON.parse(storage.getItem(SAVED_VIEWS_KEY) || "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is SavedPrivateView<TPreferences> => Boolean(entry && typeof entry === "object" && (entry as SavedPrivateView).schemaVersion === 1 && typeof (entry as SavedPrivateView).id === "string" && typeof (entry as SavedPrivateView).name === "string"));
  } catch { return []; }
}

export function writeSavedViews<TPreferences>(views: SavedPrivateView<TPreferences>[], storage: Pick<Storage, "setItem"> | undefined = browserStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
    return true;
  } catch {
    return false;
  }
}

export function createSavedView<TPreferences>(name: string, filters: ListFilters, tablePreferences: TPreferences, existing: SavedPrivateView<TPreferences>[]) {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("檢視名稱不可為空");
  if (existing.some((view) => view.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) throw new Error("已有同名檢視");
  const now = new Date().toISOString();
  return {
    schemaVersion: 1 as const,
    id: crypto.randomUUID(),
    name: cleanName,
    createdAt: now,
    updatedAt: now,
    filters: { ...filters, page: 1 },
    sorting: { field: filters.sort || "updated_at", direction: filters.order === "asc" ? "asc" as const : "desc" as const },
    tablePreferences
  };
}

export function savedViewSignature(filters: Partial<ListFilters>, tablePreferences: unknown) {
  return JSON.stringify({ filters: { ...filters, page: 1 }, tablePreferences });
}

function browserStorage() {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
