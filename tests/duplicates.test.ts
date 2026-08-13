import { afterEach, describe, expect, it, vi } from "vitest";
import { duplicateDecisions, isDuplicateDecision } from "../functions/_lib/duplicates";
import { applyDuplicateMerge, decideDuplicatePair, previewDuplicateMerge, rollbackDuplicateMerge } from "../src/lib/api";
import type { DuplicateMergePreview } from "../src/types";

afterEach(() => vi.unstubAllGlobals());

describe("duplicate review decisions", () => {
  it("uses an explicit non-destructive decision allowlist", () => {
    expect(duplicateDecisions).toEqual(["not_duplicate", "ignored", "keep_both"]);
    expect(isDuplicateDecision("not_duplicate")).toBe(true);
    expect(isDuplicateDecision("merged")).toBe(false);
    expect(isDuplicateDecision("DELETE FROM items")).toBe(false);
  });
});

describe("duplicate API client", () => {
  it("records review decisions without requesting item changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ dataChanged: false }) });
    vi.stubGlobal("fetch", fetchMock);

    await decideDuplicatePair("item-a", "item-b", "keep_both", { reason: "different edition" });

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      itemAId: "item-a", itemBId: "item-b", decision: "keep_both", metadata: { reason: "different edition" }
    });
  });

  it("keeps preview separate from confirmed merge with explicit resolutions", async () => {
    const preview = {
      target: { id: "item-a" }, source: { id: "item-b" }, expectedTargetUpdatedAt: "a-time", expectedSourceUpdatedAt: "b-time",
      conflicts: [{ field: "rating", label: "Rating", targetValue: 8, sourceValue: 9 }]
    } as DuplicateMergePreview;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => preview })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ mergeId: "merge-1", merged: true }) });
    vi.stubGlobal("fetch", fetchMock);

    await previewDuplicateMerge("item-a", "item-b");
    await applyDuplicateMerge(preview, { rating: "source" });

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ targetItemId: "item-a", sourceItemId: "item-b" });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      targetItemId: "item-a", sourceItemId: "item-b", expectedTargetUpdatedAt: "a-time",
      expectedSourceUpdatedAt: "b-time", resolutions: { rating: "source" }, confirmed: true
    });
  });

  it("requires explicit confirmation for recovery", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ rolledBack: true }) });
    vi.stubGlobal("fetch", fetchMock);

    await rollbackDuplicateMerge("merge-1");

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ mergeId: "merge-1", confirmed: true });
  });
});
