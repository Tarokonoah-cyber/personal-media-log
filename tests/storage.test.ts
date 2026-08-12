import { afterEach, describe, expect, it, vi } from "vitest";
import { readStorageEnum, readStorageItem, removeStorageItem, writeStorageItem } from "../src/lib/storage";

describe("safe browser preferences", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("rejects stale enum values instead of putting the UI in an invalid mode", () => {
    window.localStorage.setItem("view", "obsolete");
    expect(readStorageEnum("view", ["table", "list"] as const, "table")).toBe("table");
  });

  it("keeps the app usable when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });

    expect(readStorageItem("theme")).toBeNull();
    expect(writeStorageItem("theme", "dark")).toBe(false);
    expect(removeStorageItem("theme")).toBe(false);
  });
});
