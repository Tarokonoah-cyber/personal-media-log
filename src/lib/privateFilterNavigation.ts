import type { ListFilters } from "../types";

export const PRIVATE_FILTER_NAVIGATION_KEY = "private-smart-filter-navigation-v1";
export const PRIVATE_FILTER_HISTORY_KEY = "privateSmartFiltersV1";

const persistedKeys: Array<keyof ListFilters> = [
  "query", "status", "favorite", "highRated", "ratingMin", "ratingMax", "unrated", "usedFilter", "privateStatus",
  "collectionLevel", "favoriteLevel", "mediaStatus", "platformFilters", "makerFilters", "favoriteLevelFilters", "personFilters",
  "missingPeople", "qualityView", "includeTags", "excludeTags", "metadataQualityBelow", "missingTags", "incompleteMetadata",
  "duplicateCandidate", "hasNote", "hasCover", "watchStatus", "type", "category", "tag", "excludeTag", "year", "platform",
  "maker", "series", "codeQuery", "titleQuery", "person", "studio", "watchedFrom", "watchedTo", "viewedFrom", "viewedTo",
  "updatedFrom", "updatedTo", "sort", "order", "page", "pageSize"
];

const safeParams = [
  "ratingMin", "ratingMax", "usedFilter", "privateStatus", "collectionLevel", "favoriteLevel", "mediaStatus", "platformFilters",
  "favoriteLevelFilters", "qualityView", "metadataQualityBelow", "hasNote", "hasCover", "year", "sort", "order"
] as const satisfies ReadonlyArray<keyof ListFilters>;
const safeBooleans = ["favorite", "unrated", "missingPeople", "missingTags", "incompleteMetadata", "duplicateCandidate"] as const satisfies ReadonlyArray<keyof ListFilters>;

export function hasPrivateFilterNavigation(input: string | URL = currentUrl()) {
  return toUrl(input).searchParams.get("smartFilters") === "1";
}

export function privateFilterSnapshot(filters: ListFilters): Partial<ListFilters> {
  return Object.fromEntries(persistedKeys.map((key) => [key, filters[key]])) as Partial<ListFilters>;
}

export function privateFilterNavigationSignature(filters: ListFilters) {
  return JSON.stringify(privateFilterSnapshot(filters));
}

export function buildPrivateFilterUrl(input: string | URL, filters: ListFilters) {
  const url = toUrl(input);
  url.searchParams.set("smartFilters", "1");
  for (const key of safeParams) {
    const value = filters[key];
    const param = `sf_${key}`;
    if (value !== undefined && value !== null && value !== "" && value !== "all") url.searchParams.set(param, String(value));
    else url.searchParams.delete(param);
  }
  for (const key of safeBooleans) {
    const param = `sf_${key}`;
    if (filters[key]) url.searchParams.set(param, "1");
    else url.searchParams.delete(param);
  }
  if (filters.page > 1) url.searchParams.set("sf_page", String(filters.page));
  else url.searchParams.delete("sf_page");
  if (filters.pageSize > 0) url.searchParams.set("sf_pageSize", String(filters.pageSize));
  else url.searchParams.delete("sf_pageSize");
  return url;
}

export function readPrivateFilterNavigation(
  defaults: ListFilters,
  input: string | URL = currentUrl(),
  historyState: unknown = currentHistoryState(),
  storage: Pick<Storage, "getItem"> | undefined = browserStorage()
): ListFilters {
  const url = toUrl(input);
  if (!hasPrivateFilterNavigation(url)) return { ...defaults };
  const historySnapshot = readHistorySnapshot(historyState);
  const storedSnapshot = historySnapshot || readStoredSnapshot(storage);
  const restored = { ...defaults, ...storedSnapshot } as ListFilters;
  for (const key of safeParams) {
    const value = url.searchParams.get(`sf_${key}`);
    (restored as unknown as Record<string, unknown>)[key] = value === null ? defaults[key] : value;
  }
  for (const key of safeBooleans) {
    (restored as unknown as Record<string, unknown>)[key] = url.searchParams.get(`sf_${key}`) === "1";
  }
  restored.page = positiveInteger(url.searchParams.get("sf_page"), defaults.page);
  restored.pageSize = positiveInteger(url.searchParams.get("sf_pageSize"), defaults.pageSize);
  return restored;
}

export function privateFilterHistoryState(current: unknown, filters: ListFilters) {
  const base = current && typeof current === "object" ? current as Record<string, unknown> : {};
  return { ...base, [PRIVATE_FILTER_HISTORY_KEY]: privateFilterSnapshot(filters) };
}

export function writePrivateFilterNavigation(filters: ListFilters, storage: Pick<Storage, "setItem"> | undefined = browserStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(PRIVATE_FILTER_NAVIGATION_KEY, JSON.stringify(privateFilterSnapshot(filters)));
    return true;
  } catch {
    return false;
  }
}

function readHistorySnapshot(state: unknown) {
  if (!state || typeof state !== "object") return undefined;
  const value = (state as Record<string, unknown>)[PRIVATE_FILTER_HISTORY_KEY];
  return value && typeof value === "object" ? pickPersisted(value as Partial<ListFilters>) : undefined;
}

function readStoredSnapshot(storage?: Pick<Storage, "getItem">) {
  if (!storage) return undefined;
  try {
    const value = JSON.parse(storage.getItem(PRIVATE_FILTER_NAVIGATION_KEY) || "null") as unknown;
    return value && typeof value === "object" ? pickPersisted(value as Partial<ListFilters>) : undefined;
  } catch {
    return undefined;
  }
}

function pickPersisted(value: Partial<ListFilters>) {
  return Object.fromEntries(persistedKeys.filter((key) => key in value).map((key) => [key, value[key]])) as Partial<ListFilters>;
}

function positiveInteger(value: string | null, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function toUrl(input: string | URL) {
  return new URL(input.toString(), "https://smart-filter.local/");
}

function currentUrl() {
  return typeof window === "undefined" ? "https://smart-filter.local/" : window.location.href;
}

function currentHistoryState() {
  return typeof window === "undefined" ? undefined : window.history.state;
}

function browserStorage() {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
