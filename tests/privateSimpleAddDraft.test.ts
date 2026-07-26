import { describe, expect, it, vi } from "vitest";
import { PRIVATE_DEFAULT_ACTRESS } from "../shared/privateModel";
import {
  PRIVATE_SIMPLE_ADD_DRAFT_KEY,
  clearPrivateSimpleAddDraft,
  emptyPrivateSimpleAddDraft,
  hasMeaningfulPrivateDraft,
  readPrivateSimpleAddDraft,
  savePrivateSimpleAddDraft
} from "../src/lib/privateSimpleAddDraft";

describe("private simple-add draft storage", () => {
  it("saves and restores every private add field", () => {
    const storage = memoryStorage();
    const draft = {
      ...emptyPrivateSimpleAddDraft("2026-07-23"),
      code: "FC2-PPV-123",
      title: "測試片名",
      rating: "4",
      collection: "used" as const,
      actress: "測試女優",
      platform: "FC2",
      maker: "片商",
      summary: "快速筆記",
      tags: ["人妻", "人妻", " #短髮 "],
      release_date: "2026-07-01"
    };

    const saved = savePrivateSimpleAddDraft(draft, storage, "2026-07-23T12:00:00.000Z");

    expect(saved?.savedAt).toBe("2026-07-23T12:00:00.000Z");
    expect(readPrivateSimpleAddDraft(storage)).toEqual({
      schemaVersion: 1,
      savedAt: "2026-07-23T12:00:00.000Z",
      draft: { ...draft, tags: ["人妻", "短髮"] }
    });
  });

  it("does not treat private defaults as an unfinished draft", () => {
    expect(hasMeaningfulPrivateDraft(emptyPrivateSimpleAddDraft("2026-07-23"))).toBe(false);
    expect(hasMeaningfulPrivateDraft({
      ...emptyPrivateSimpleAddDraft(),
      actress: PRIVATE_DEFAULT_ACTRESS
    })).toBe(false);
  });

  it("ignores invalid JSON and unknown schema versions", () => {
    const storage = memoryStorage();
    storage.setItem(PRIVATE_SIMPLE_ADD_DRAFT_KEY, "{broken");
    expect(readPrivateSimpleAddDraft(storage)).toBeNull();
    storage.setItem(PRIVATE_SIMPLE_ADD_DRAFT_KEY, JSON.stringify({
      schemaVersion: 2,
      savedAt: "2026-07-23T12:00:00.000Z",
      draft: { code: "FC2-PPV-123" }
    }));
    expect(readPrivateSimpleAddDraft(storage)).toBeNull();
  });

  it("reports storage failures without throwing", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      removeItem: vi.fn(() => {
        throw new Error("blocked");
      })
    };
    const draft = { ...emptyPrivateSimpleAddDraft(), code: "FC2-PPV-123" };
    expect(readPrivateSimpleAddDraft(storage)).toBeNull();
    expect(savePrivateSimpleAddDraft(draft, storage)).toBeNull();
    expect(clearPrivateSimpleAddDraft(storage)).toBe(false);
  });

  it("removes a saved draft only when explicitly cleared", () => {
    const storage = memoryStorage();
    savePrivateSimpleAddDraft({ ...emptyPrivateSimpleAddDraft(), code: "FC2-PPV-123" }, storage);
    expect(storage.getItem(PRIVATE_SIMPLE_ADD_DRAFT_KEY)).not.toBeNull();
    expect(clearPrivateSimpleAddDraft(storage)).toBe(true);
    expect(storage.getItem(PRIVATE_SIMPLE_ADD_DRAFT_KEY)).toBeNull();
  });
});

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    }
  };
}
