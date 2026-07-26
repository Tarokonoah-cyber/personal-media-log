import { describe, expect, it, vi } from "vitest";
import { PRIVATE_ADD_RECENTS_KEY, readPrivateAddRecents, updatePrivateAddRecents } from "../src/lib/privateAddRecents";
import { emptyPrivateSimpleAddDraft } from "../src/lib/privateSimpleAddDraft";

describe("private add recents", () => {
  it("puts the newest tags, actresses and makers first without duplicates", () => {
    const storage = memoryStorage();
    storage.setItem(PRIVATE_ADD_RECENTS_KEY, JSON.stringify({
      schemaVersion: 1,
      tags: ["白虎", "巨乳"],
      actresses: ["女優 B"],
      makers: ["SOD"]
    }));

    expect(updatePrivateAddRecents({
      ...emptyPrivateSimpleAddDraft(),
      tags: ["中出", "白虎"],
      actress: "女優 A",
      maker: "S1"
    }, storage)).toEqual({
      schemaVersion: 1,
      tags: ["中出", "白虎", "巨乳"],
      actresses: ["女優 A", "女優 B"],
      makers: ["S1", "SOD"]
    });
  });

  it("does not store the default amateur actress as a recent shortcut", () => {
    const storage = memoryStorage();
    updatePrivateAddRecents({
      ...emptyPrivateSimpleAddDraft(),
      tags: ["中出"],
      maker: "FC2"
    }, storage);

    expect(readPrivateAddRecents(storage)).toMatchObject({
      actresses: [],
      tags: ["中出"],
      makers: ["FC2"]
    });
  });

  it("falls back safely when storage is unavailable", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("blocked");
      })
    };
    expect(readPrivateAddRecents(storage)).toEqual({ schemaVersion: 1, tags: [], actresses: [], makers: [] });
    expect(updatePrivateAddRecents(emptyPrivateSimpleAddDraft(), storage)).toBeNull();
  });
});

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    }
  };
}
