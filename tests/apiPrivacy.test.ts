import { afterEach, describe, expect, it, vi } from "vitest";
import { listPrivateItems } from "../src/lib/api";
import type { ListFilters } from "../src/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("private item API", () => {
  it("uses the dedicated private endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], page: 1, pageSize: 100, total: 0 })
    });
    vi.stubGlobal("fetch", fetchMock);

    await listPrivateItems({
      query: "FC2",
      page: 1,
      pageSize: 100
    } as ListFilters);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/private/items?query=FC2&page=1&pageSize=100");
  });
});
