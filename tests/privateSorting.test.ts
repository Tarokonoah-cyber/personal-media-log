import { describe, expect, it } from "vitest";
import { listOrderSql } from "../functions/_lib/items";
import { nextPrivateSort, privateSortFieldForColumn } from "../src/lib/privateSorting";
import type { ListFilters } from "../src/types";

const filters = { sort: "", order: "", page: 4, pageSize: 200 } as ListFilters;

describe("private table sorting", () => {
  it("cycles names ascending first and numeric/date columns descending first", () => {
    expect(nextPrivateSort(filters, "identity")).toEqual({ sort: "displayName", order: "asc", page: 1 });
    expect(nextPrivateSort({ ...filters, sort: "displayName", order: "asc" }, "identity")).toEqual({ sort: "displayName", order: "desc", page: 1 });
    expect(nextPrivateSort(filters, "rating")).toEqual({ sort: "rating", order: "desc", page: 1 });
    expect(nextPrivateSort(filters, "releaseDate")).toEqual({ sort: "releaseDate", order: "desc", page: 1 });
    expect(nextPrivateSort({ ...filters, sort: "rating", order: "asc" }, "rating")).toEqual({ sort: "", order: "", page: 1 });
    expect(privateSortFieldForColumn("tags")).toBeNull();
  });

  it("keeps missing ratings and dates last in both directions", () => {
    const ratingSql = listOrderSql({ page: 1, pageSize: 200, sort: "rating", order: "desc" });
    const dateSql = listOrderSql({ page: 1, pageSize: 200, sort: "releaseDate", order: "asc" });
    expect(ratingSql).toContain("items.rating IS NULL ASC");
    expect(ratingSql).toContain("items.rating DESC");
    expect(dateSql).toContain("nullif(trim(items.release_date), '') IS NULL ASC");
    expect(dateSql).toContain("date(items.release_date) ASC");
  });
});
