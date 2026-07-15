import { describe, expect, it } from "vitest";
import { clearPrivateSidebarFilters, mergePrivateFilters } from "../src/lib/privateFilters";
import type { ListFilters } from "../src/types";

const base = (): ListFilters => ({
  query: "needle", status: "all", favorite: false, highRated: false, ratingMin: "8", ratingMax: "", unrated: false,
  usedFilter: "all", privateStatus: "all", collectionLevel: "", favoriteLevel: "all", mediaStatus: "all", platformFilters: "", makerFilters: "",
  favoriteLevelFilters: "", personFilters: "", missingPeople: false, hasNote: "yes", hasCover: "all", watchStatus: "all",
  type: "", category: "", tag: "", excludeTag: "", year: "", platform: "", maker: "", series: "", codeQuery: "",
  titleQuery: "", person: "", studio: "", watchedFrom: "", watchedTo: "", viewedFrom: "", viewedTo: "", updatedFrom: "",
  updatedTo: "", page: 4, pageSize: 100
});

describe("private filter state", () => {
  it("combines categories with AND while preserving search and advanced filters", () => {
    let state = mergePrivateFilters(base(), { platformFilters: "FC2" });
    state = mergePrivateFilters(state, { favoriteLevelFilters: "normal" });
    state = mergePrivateFilters(state, { personFilters: "女優 A" });
    expect(state).toMatchObject({ platformFilters: "FC2", favoriteLevelFilters: "normal", personFilters: "女優 A", query: "needle", ratingMin: "8", hasNote: "yes", page: 1 });
  });

  it("supports same-category OR serialization and cancellation", () => {
    expect(mergePrivateFilters(base(), { platformFilters: "FC2,JAV" }).platformFilters).toBe("FC2,JAV");
    expect(mergePrivateFilters(base(), { platformFilters: "JAV" }).platformFilters).toBe("JAV");
  });

  it("clears only sidebar facets for All", () => {
    const state = clearPrivateSidebarFilters({ ...base(), platformFilters: "FC2", favoriteLevelFilters: "normal", personFilters: "A" });
    expect(state).toMatchObject({ platformFilters: "", favoriteLevelFilters: "", personFilters: "", query: "needle", ratingMin: "8", hasNote: "yes", page: 1 });
  });
});
