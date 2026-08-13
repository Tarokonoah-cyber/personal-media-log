import { describe, expect, it } from "vitest";
import { listOrderSql } from "../functions/_lib/items";
import { nextPrivateSort, privateSortFieldForColumn } from "../src/lib/privateSorting";
import type { ListFilters } from "../src/types";

const filters = { sort: "", order: "", page: 4, pageSize: 200 } as ListFilters;

describe("private table sorting", () => {
  it("cycles names ascending first and numeric/date columns descending first", () => {
    expect(nextPrivateSort(filters, "identity")).toEqual({ sort: "code", order: "asc", page: 1 });
    expect(nextPrivateSort({ ...filters, sort: "code", order: "asc" }, "identity")).toEqual({ sort: "code", order: "desc", page: 1 });
    expect(nextPrivateSort(filters, "rating")).toEqual({ sort: "rating", order: "desc", page: 1 });
    expect(nextPrivateSort(filters, "actress")).toEqual({ sort: "people", order: "asc", page: 1 });
    expect(nextPrivateSort(filters, "source")).toEqual({ sort: "source", order: "asc", page: 1 });
    expect(nextPrivateSort(filters, "favorite")).toEqual({ sort: "favorite", order: "desc", page: 1 });
    expect(nextPrivateSort(filters, "used")).toEqual({ sort: "used", order: "desc", page: 1 });
    expect(nextPrivateSort(filters, "updated")).toEqual({ sort: "updated", order: "desc", page: 1 });
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

  it("builds stable backend ordering for every private browse field", () => {
    for (const sort of ["code", "title", "rating", "people", "source", "favorite", "used", "updated", "releaseDate"] as const) {
      const sql = listOrderSql({ page: 1, pageSize: 100, sort, order: "asc" });
      expect(sql).toContain("ORDER BY");
      expect(sql).toContain("items.id");
    }
    expect(listOrderSql({ page: 1, pageSize: 100, sort: "people", order: "asc" })).toContain("item_people");
    expect(listOrderSql({ page: 1, pageSize: 100, sort: "favorite", order: "desc" })).toContain("collection_level");
  });
});
