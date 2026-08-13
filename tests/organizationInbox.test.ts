import { afterEach, describe, expect, it, vi } from "vitest";
import { isOrganizationInboxCategory, organizationInboxCategories } from "../functions/_lib/organizationInbox";
import { getOrganizationInboxSummary, listOrganizationInbox, setOrganizationInboxState } from "../src/lib/api";

afterEach(() => vi.unstubAllGlobals());

describe("organization inbox categories", () => {
  it("keeps an explicit reason allowlist", () => {
    expect(organizationInboxCategories).toEqual([
      "new", "missing_metadata", "missing_tags", "missing_people", "duplicate_suspected",
      "normalization_needed", "metadata_conflict", "ready", "skipped"
    ]);
    expect(isOrganizationInboxCategory("missing_tags")).toBe(true);
    expect(isOrganizationInboxCategory("ready")).toBe(true);
    expect(isOrganizationInboxCategory("1=1")).toBe(false);
  });
});

describe("organization inbox API client", () => {
  it("loads summary and a paginated reason queue", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ needsAttention: 43, categories: {} }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ total: 10, items: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    await getOrganizationInboxSummary();
    await listOrganizationInbox("missing_people", 2, 50);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/private/inbox/summary");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/private/inbox?category=missing_people&page=2&pageSize=50");
  });

  it("uses a single batch state request for multi-select and undo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ changed: 2 }) });
    vi.stubGlobal("fetch", fetchMock);

    await setOrganizationInboxState(["item-1", "item-2"], "skipped");
    await setOrganizationInboxState(["item-1", "item-2"], "active");

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ itemIds: ["item-1", "item-2"], state: "skipped" });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ itemIds: ["item-1", "item-2"], state: "active" });
  });
});
