import { describe, expect, it } from "vitest";
import { buildItemWhere, filtersExcludingFacet } from "../functions/_lib/items";
import type { ItemListParams } from "../functions/_lib/types";

const base: ItemListParams = {
  query: "FC2",
  privateOnly: true,
  includePrivate: true,
  platformFilters: ["FC2"],
  favoriteLevelFilters: ["normal"],
  personFilters: ["Actor"],
  tag: "劇情",
  usedFilter: "used",
  privateStatus: "rewatch",
  page: 3,
  pageSize: 50
};

describe("private facet filter exclusion", () => {
  it("ignores platform filters only for platform counts", () => {
    const next = filtersExcludingFacet(base, "source");
    expect(next.platformFilters).toEqual([]);
    expect(next.favoriteLevelFilters).toEqual(["normal"]);
    expect(next.personFilters).toEqual(["Actor"]);
    expect(next.tag).toBe("劇情");
  });

  it("ignores collection filters only for collection counts", () => {
    const next = filtersExcludingFacet(base, "favoriteLevel");
    expect(next.favoriteLevelFilters).toEqual([]);
    expect(next.platformFilters).toEqual(["FC2"]);
    expect(next.personFilters).toEqual(["Actor"]);
  });

  it("ignores actress filters only for actress counts", () => {
    const next = filtersExcludingFacet(base, "actress");
    expect(next.personFilters).toEqual([]);
    expect(next.missingPeople).toBe(false);
    expect(next.platformFilters).toEqual(["FC2"]);
  });

  it("ignores tag filters only for tag counts", () => {
    const next = filtersExcludingFacet(base, "tags");
    expect(next.tag).toBeUndefined();
    expect(next.platformFilters).toEqual(["FC2"]);
    expect(next.favoriteLevelFilters).toEqual(["normal"]);
  });

  it("keeps unified status for other facets and removes it from status facets", () => {
    expect(filtersExcludingFacet(base, "source").privateStatus).toBe("rewatch");
    expect(filtersExcludingFacet(base, "used").privateStatus).toBe("all");
    expect(filtersExcludingFacet(base, "status").privateStatus).toBe("all");
  });

  it("lets unified status take precedence over legacy status filters", () => {
    const unified = buildItemWhere({ ...base, privateStatus: "rewatch", usedFilter: "unused", mediaStatus: "待觀看" });
    expect(unified.whereSql).toContain("THEN 'rewatch'");
    expect(unified.whereSql.match(/items\.used = 0/g)).toHaveLength(1);
    expect(unified.whereSql).not.toContain("items.media_status = ?");
    expect(unified.bind).toContain("rewatch");
    expect(unified.bind).not.toContain("待觀看");

    const legacy = buildItemWhere({ ...base, privateStatus: "all", usedFilter: "unused", mediaStatus: "待觀看" });
    expect(legacy.whereSql.match(/items\.used = 0/g)).toHaveLength(1);
    expect(legacy.whereSql).toContain("items.media_status = ?");
    expect(legacy.bind).toContain("待觀看");
  });
});
