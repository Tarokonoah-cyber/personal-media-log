import { describe, expect, it } from "vitest";
import { privateBatchTagPatch, retainVisibleSelection, runLimitedBatch, togglePageItemSelection, togglePageSelection } from "../src/lib/privateBatch";
import type { MediaItem } from "../src/types";

describe("private page batch operations", () => {
  it("selects only the current page and prunes selection when the page changes", () => {
    const pageOne = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(togglePageItemSelection([], "a")).toEqual(["a"]);
    expect(togglePageSelection(["a"], pageOne)).toEqual(["a", "b", "c"]);
    expect(togglePageSelection(["a", "b", "c"], pageOne)).toEqual([]);
    expect(retainVisibleSelection(["a", "b"], [{ id: "b" }, { id: "d" }])).toEqual(["b"]);
  });

  it("limits concurrent requests to five and reports partial failures", async () => {
    const items = Array.from({ length: 12 }, (_, index) => ({ id: String(index) }));
    let active = 0;
    let maximum = 0;
    const result = await runLimitedBatch(items, async (item) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 4));
      active -= 1;
      if (item.id === "3" || item.id === "8") throw new Error("failed");
    });
    expect(maximum).toBe(5);
    expect(result.failedIds.sort()).toEqual(["3", "8"]);
    expect(result.succeededIds).toHaveLength(10);
  });

  it("adds and removes normalized tags without replacing unrelated tags", () => {
    const item = { tags: ["FC2", "劇情"] } as MediaItem;
    expect(privateBatchTagPatch(item, "#FC2、戶外, 主觀視角", "add")).toEqual({ tags: ["FC2", "劇情", "戶外", "主觀視角"] });
    expect(privateBatchTagPatch(item, "FC2、戶外", "remove")).toEqual({ tags: ["劇情"] });
    expect(privateBatchTagPatch({ tags: ["劇情", "劇情", "戶外"] } as MediaItem, "戶外", "remove")).toEqual({ tags: ["劇情"] });
  });
});
