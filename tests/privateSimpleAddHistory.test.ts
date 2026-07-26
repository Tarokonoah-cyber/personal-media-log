import { describe, expect, it, vi } from "vitest";
import {
  PRIVATE_SIMPLE_ADD_HISTORY_KEY,
  isPrivateSimpleAddHistoryEntry,
  popPrivateSimpleAddHistoryEntry,
  pushPrivateSimpleAddHistoryEntry,
  removeStalePrivateSimpleAddHistoryEntry
} from "../src/lib/privateSimpleAddHistory";

describe("private simple-add history entry", () => {
  it("pushes one same-page modal entry and pops it on explicit close", () => {
    const target = historyTarget({ page: "private" });
    expect(pushPrivateSimpleAddHistoryEntry(target, "/private")).toBe(true);
    expect(target.pushState).toHaveBeenCalledWith({
      page: "private",
      [PRIVATE_SIMPLE_ADD_HISTORY_KEY]: true
    }, "", "/private");
    target.state = target.pushState.mock.calls[0][0];
    expect(pushPrivateSimpleAddHistoryEntry(target, "/private")).toBe(false);
    expect(popPrivateSimpleAddHistoryEntry(target)).toBe(true);
    expect(target.back).toHaveBeenCalledOnce();
  });

  it("recognizes browser back as leaving the modal history entry", () => {
    expect(isPrivateSimpleAddHistoryEntry({ [PRIVATE_SIMPLE_ADD_HISTORY_KEY]: true })).toBe(true);
    expect(isPrivateSimpleAddHistoryEntry({ page: "private" })).toBe(false);
  });

  it("strips a stale marker after a reload without navigating", () => {
    const target = historyTarget({
      page: "private",
      [PRIVATE_SIMPLE_ADD_HISTORY_KEY]: true
    });
    expect(removeStalePrivateSimpleAddHistoryEntry(target, "/private")).toBe(true);
    expect(target.replaceState).toHaveBeenCalledWith({ page: "private" }, "", "/private");
    expect(target.back).not.toHaveBeenCalled();
  });
});

function historyTarget(state: unknown) {
  return {
    state,
    pushState: vi.fn(),
    replaceState: vi.fn(),
    back: vi.fn()
  };
}
