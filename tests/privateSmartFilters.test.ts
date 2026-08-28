import { describe, expect, it } from "vitest";
import { getListParams } from "../functions/api/[[path]]";
import { buildItemWhere, metadataCompletenessScoreSql } from "../functions/_lib/items";
import { privateFilterChips } from "../src/lib/privateFilterChips";
import { mergePrivateFilterValues, reconcilePrivateTagFilters } from "../src/lib/privateFilters";
import {
  buildPrivateFilterUrl,
  privateFilterHistoryState,
  readPrivateFilterNavigation,
  writePrivateFilterNavigation
} from "../src/lib/privateFilterNavigation";
import type { ListFilters } from "../src/types";

const defaults = (): ListFilters => ({
  query: "", status: "all", favorite: false, highRated: false, ratingMin: "", ratingMax: "", unrated: false,
  usedFilter: "all", privateStatus: "all", collectionLevel: "", favoriteLevel: "all", mediaStatus: "all",
  platformFilters: "", makerFilters: "", favoriteLevelFilters: "", personFilters: "", missingPeople: false, qualityView: "",
  includeTags: "", excludeTags: "", metadataQualityBelow: "", missingTags: false, incompleteMetadata: false, duplicateCandidate: false,
  hasNote: "all", hasCover: "all", watchStatus: "all", type: "", category: "", tag: "", excludeTag: "", year: "",
  platform: "", maker: "", series: "", codeQuery: "", titleQuery: "", person: "", studio: "", watchedFrom: "",
  watchedTo: "", viewedFrom: "", viewedTo: "", updatedFrom: "", updatedTo: "", sort: "", order: "", page: 1, pageSize: 100
});

describe("Smart Filter API and SQL", () => {
  it("combines different fields with AND while keeping same-field people values as the existing OR facet", () => {
    const params = getListParams(new URL("https://example.test/api/private/items?platformFilters=FC2&ratingMin=8&ratingMax=10&favorite=true&usedFilter=unused&personFilters=A,B"));
    const query = buildItemWhere({ ...params, privateOnly: true });
    expect(query.whereSql).toContain("items.platform IN (?)");
    expect(query.whereSql).toContain("items.rating >= ?");
    expect(query.whereSql).toContain("items.rating <= ?");
    expect(query.whereSql).toContain("items.favorite = 1");
    expect(query.whereSql).toContain("items.used = 0");
    expect(query.whereSql).toContain("selected_people.name IN (?, ?)");
    expect(query.bind).toEqual(expect.arrayContaining([8, 10, "FC2", "A", "B"]));
  });

  it("requires every included Tag and rejects every excluded Tag", () => {
    const params = getListParams(new URL("https://example.test/api/private/items?includeTags=Tag%20A,Tag%20B&excludeTags=Tag%20C,Tag%20D"));
    const query = buildItemWhere({ ...params, privateOnly: true });
    expect(params.includeTags).toEqual(["Tag A", "Tag B"]);
    expect(params.excludeTags).toEqual(["Tag C", "Tag D"]);
    expect(query.whereSql.match(/included_it\.item_id/g)).toHaveLength(2);
    expect(query.whereSql.match(/excluded_smart_it\.item_id/g)).toHaveLength(2);
    expect(query.bind).toEqual(expect.arrayContaining(["Tag A", "Tag B", "Tag C", "Tag D"]));
  });

  it("keeps include/exclude conflicts deterministic with the last-edited side winning", () => {
    expect(reconcilePrivateTagFilters("Tag A,Tag B", "Tag B,Tag C", "include")).toEqual({ includeTags: "Tag A,Tag B", excludeTags: "Tag C" });
    expect(reconcilePrivateTagFilters("Tag A,Tag B", "tag b,Tag C", "exclude")).toEqual({ includeTags: "Tag A", excludeTags: "tag b,Tag C" });
    expect(mergePrivateFilterValues("Tag A", "tag a,Tag B")).toBe("Tag A,Tag B");
  });

  it("supports composable quality, missing-data, and duplicate filters", () => {
    const params = getListParams(new URL("https://example.test/api/private/items?metadataQualityBelow=60&missingTags=true&incompleteMetadata=true&duplicateCandidate=true"));
    const query = buildItemWhere({ ...params, privateOnly: true });
    expect(query.whereSql).toContain("round((max(0.0");
    expect(query.whereSql).toContain("NOT EXISTS (\n      SELECT 1 FROM item_tags missing_tag");
    expect(query.whereSql).toContain("GROUP BY grouped_items.normalized_code HAVING COUNT(*) > 1");
    expect(query.bind).toContain(60);
    expect(metadataCompletenessScoreSql("items")).toContain("quality_second_tag");
  });
});

describe("Smart Filter chips and navigation state", () => {
  it("creates individually removable include/exclude and quality chips", () => {
    const chips = privateFilterChips({ ...defaults(), includeTags: "Tag A,Tag B", excludeTags: "Tag C", favorite: true, usedFilter: "unused", metadataQualityBelow: "60" });
    expect(chips.find((chip) => chip.key === "includeTags:Tag A")?.patch).toEqual({ includeTags: "Tag B", page: 1 });
    expect(chips.find((chip) => chip.key === "excludeTags:Tag C")?.label).toBe("排除：#Tag C");
    expect(chips.map((chip) => chip.label)).toEqual(expect.arrayContaining(["收藏：是", "已使用：否", "Metadata < 60"]));
  });

  it("keeps sensitive values out of the URL while restoring refresh and sort state", () => {
    const filters = { ...defaults(), query: "private title", includeTags: "敏感 Tag", personFilters: "某人", platformFilters: "FC2", ratingMin: "8", sort: "rating", order: "desc" as const };
    const url = buildPrivateFilterUrl("https://example.test/library?keep=1", filters);
    expect(url.searchParams.get("smartFilters")).toBe("1");
    expect(url.searchParams.get("sf_platformFilters")).toBe("FC2");
    expect(url.searchParams.get("sf_ratingMin")).toBe("8");
    expect(url.toString()).not.toContain("private%20title");
    expect(url.toString()).not.toContain(encodeURIComponent("敏感 Tag"));
    expect(url.toString()).not.toContain(encodeURIComponent("某人"));

    const state = privateFilterHistoryState({}, filters);
    const restored = readPrivateFilterNavigation(defaults(), url, state, undefined);
    expect(restored).toMatchObject({ query: "private title", includeTags: "敏感 Tag", personFilters: "某人", platformFilters: "FC2", ratingMin: "8", sort: "rating", order: "desc" });
  });

  it("recovers the full filter state from versioned browser storage after refresh", () => {
    let stored = "";
    const storage = { setItem: (_key: string, value: string) => { stored = value; }, getItem: () => stored };
    const filters = { ...defaults(), includeTags: "Tag A,Tag B", excludeTags: "Tag C", page: 3 };
    expect(writePrivateFilterNavigation(filters, storage)).toBe(true);
    const url = buildPrivateFilterUrl("https://example.test/library", filters);
    expect(readPrivateFilterNavigation(defaults(), url, undefined, storage)).toMatchObject({ includeTags: "Tag A,Tag B", excludeTags: "Tag C", page: 3 });
  });
});
