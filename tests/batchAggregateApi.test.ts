import { afterEach, describe, expect, it, vi } from "vitest";
import { batchUpdateItems, getPublicAggregate } from "../src/lib/api";
import type { BatchUpdateOperation } from "../src/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("batch update API client", () => {
  it.each([1, 10, 100])("sends %i updates in one request", async (size) => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        outcome: "updated",
        requested: size,
        updatedIds: Array.from({ length: size }, (_, index) => `item-${index}`),
        unchangedIds: [],
        atomic: true
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const operations: BatchUpdateOperation[] = Array.from({ length: size }, (_, index) => ({
      id: `item-${index}`,
      input: { raw_title: `Item ${index}` }
    }));

    await batchUpdateItems(operations);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/items/batch");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ operations });
  });
});

describe("public aggregate API client", () => {
  it("uses one aggregate request and includes the browser timezone offset", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ summary: { total: 1000 }, facets: { tags: [] }, stats: { total: 1000 } })
    });
    vi.stubGlobal("fetch", fetchMock);

    await getPublicAggregate();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toMatch(/^\/api\/public\/aggregate\?timezoneOffsetMinutes=-?\d+$/);
  });
});
