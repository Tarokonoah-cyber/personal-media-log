import { describe, expect, it } from "vitest";
import { filtersExcludingFacet } from "../functions/_lib/items";
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
});
