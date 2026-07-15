import { describe, expect, it } from "vitest";
import { createSavedView, readSavedViews, SAVED_VIEWS_KEY } from "../src/lib/savedViews";
import type { ListFilters } from "../src/types";

const filters = { query: "FC2", page: 7, pageSize: 100, platformFilters: "FC2", favoriteLevelFilters: "normal" } as ListFilters;

describe("saved private views", () => {
  it("creates a versioned view and resets its saved page", () => {
    const view = createSavedView("常用", filters, { order: ["title"] }, []);
    expect(view.schemaVersion).toBe(1); expect(view.filters.page).toBe(1); expect(view.name).toBe("常用");
  });
  it("persists current display-name sorting", () => {
    const view = createSavedView("名稱排序", { ...filters, sort: "displayName", order: "asc" }, { order: ["title"] }, []);
    expect(view.filters.sort).toBe("displayName");
    expect(view.filters.order).toBe("asc");
    expect(view.sorting).toEqual({ field: "displayName", direction: "asc" });
  });
  it("persists the unified private status and keeps legacy fields readable", () => {
    const view = createSavedView("想重看", { ...filters, privateStatus: "rewatch", usedFilter: "all", mediaStatus: "all" }, { order: ["title"] }, []);
    expect(view.filters.privateStatus).toBe("rewatch");
    expect(readSavedViews({ getItem: () => JSON.stringify([{ ...view, filters: { ...view.filters, privateStatus: undefined, usedFilter: "used", mediaStatus: "all" } }]) })[0]?.filters.usedFilter).toBe("used");
  });
  it("rejects blank and duplicate names", () => {
    expect(() => createSavedView(" ", filters, {}, [])).toThrow("不可為空");
    const existing = [createSavedView("常用", filters, {}, [])];
    expect(() => createSavedView("常用", filters, {}, existing)).toThrow("同名");
  });
  it("falls back safely for corrupted or old storage", () => {
    expect(readSavedViews({ getItem: (key) => key === SAVED_VIEWS_KEY ? "broken" : null })).toEqual([]);
    expect(readSavedViews({ getItem: () => JSON.stringify([{ schemaVersion: 0 }]) })).toEqual([]);
  });
});
