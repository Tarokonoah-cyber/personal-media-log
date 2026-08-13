import { afterEach, describe, expect, it, vi } from "vitest";
import { isEntityType } from "../functions/_lib/normalization";
import { applyEntityMerge, previewEntityMerge, registerEntityAlias, rollbackEntityMerge } from "../src/lib/api";

afterEach(() => vi.unstubAllGlobals());

describe("normalization entity allowlist", () => {
  it.each(["tag", "person", "maker", "platform"])("accepts %s", (value) => {
    expect(isEntityType(value)).toBe(true);
  });

  it("rejects arbitrary entity table names", () => {
    expect(isEntityType("items; DROP TABLE tags")).toBe(false);
  });
});

describe("normalization API client", () => {
  it("registers an alias without requesting a data rewrite", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ dataChanged: false }) });
    vi.stubGlobal("fetch", fetchMock);

    await registerEntityAlias("tag", "Canonical", "Alias");

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toEqual({ entityType: "tag", canonicalValue: "Canonical", aliasValue: "Alias" });
    expect(body).not.toHaveProperty("confirmed");
  });

  it("keeps preview and confirmed apply as separate requests", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ requiresConfirmation: true }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ mergeId: "merge-1", applied: true }) });
    vi.stubGlobal("fetch", fetchMock);

    await previewEntityMerge("person", "Old Name", "Canonical Name");
    await applyEntityMerge("person", "Old Name", "Canonical Name");

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ entityType: "person", sourceValue: "Old Name", targetValue: "Canonical Name" });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ entityType: "person", sourceValue: "Old Name", targetValue: "Canonical Name", confirmed: true });
  });

  it("requires an explicit confirmed rollback request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ mergeId: "merge-1", rolledBack: true }) });
    vi.stubGlobal("fetch", fetchMock);

    await rollbackEntityMerge("merge-1");

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ mergeId: "merge-1", confirmed: true });
  });
});
