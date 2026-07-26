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
