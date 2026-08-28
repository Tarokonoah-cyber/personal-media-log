import type { ListFilters } from "../types";

export const privateSidebarFilterKeys = [
  "platformFilters",
  "makerFilters",
  "favoriteLevelFilters",
  "personFilters",
  "missingPeople",
  "tag"
] as const;

export function mergePrivateFilters(current: ListFilters, patch: Partial<ListFilters>): ListFilters {
  return { ...current, ...patch, page: 1 };
}

export function clearPrivateSidebarFilters(current: ListFilters): ListFilters {
  return {
    ...current,
    platformFilters: "",
    makerFilters: "",
    favoriteLevelFilters: "",
    personFilters: "",
    missingPeople: false,
    platform: "",
    maker: "",
    person: "",
    tag: "",
    excludeTag: "",
    page: 1
  };
}

export function resetFiltersPreservingTableState(current: ListFilters, next: ListFilters): ListFilters {
  return {
    ...next,
    page: 1,
    pageSize: current.pageSize,
    sort: current.sort,
    order: current.order
  };
}

export function privateFilterValues(value?: string) {
  const seen = new Set<string>();
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => {
      const key = entry.toLocaleLowerCase();
      if (!entry || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function mergePrivateFilterValues(...values: Array<string | undefined>) {
  return privateFilterValues(values.filter(Boolean).join(",")).join(",");
}

export function reconcilePrivateTagFilters(includeTags: string, excludeTags: string, changed: "include" | "exclude") {
  const included = privateFilterValues(includeTags);
  const excluded = privateFilterValues(excludeTags);
  if (changed === "include") {
    const includedKeys = new Set(included.map((value) => value.toLocaleLowerCase()));
    return { includeTags: included.join(","), excludeTags: excluded.filter((value) => !includedKeys.has(value.toLocaleLowerCase())).join(",") };
  }
  const excludedKeys = new Set(excluded.map((value) => value.toLocaleLowerCase()));
  return { includeTags: included.filter((value) => !excludedKeys.has(value.toLocaleLowerCase())).join(","), excludeTags: excluded.join(",") };
}
