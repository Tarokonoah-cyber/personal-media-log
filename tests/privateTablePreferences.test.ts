import { describe, expect, it, vi } from "vitest";
import {
  LEGACY_PRIVATE_TABLE_PREFERENCES_KEY,
  LEGACY_V3_PRIVATE_TABLE_PREFERENCES_KEY,
  PRIVATE_TABLE_PREFERENCES_KEY,
  defaultPrivateTablePreferences,
  migratePrivateTablePreferencesV2,
  migratePrivateTablePreferencesV3,
  normalizePrivateTablePreferences,
  readPrivateTablePreferences
} from "../src/lib/privateTablePreferences";

describe("private table preference migration", () => {
  it("uses one required identity column and removes platform from the table", () => {
    const defaults = defaultPrivateTablePreferences();
    expect(defaults.order[0]).toBe("identity");
    expect(defaults.widths.identity).toBe(520);
    expect(defaults.visible.identity).toBe(true);
    expect(defaults.order).not.toContain("platform");
  });

  it("turns untouched v3 code and title columns into the 520px identity default", () => {
    const migrated = migratePrivateTablePreferencesV3({
      order: ["summary", "code", "title", "platform", "tags"],
      widths: { code: 168, title: 260, platform: 92, tags: 210 },
      visible: { title: false, summary: false },
      pageSize: 50
    });
    expect(migrated.order.slice(0, 3)).toEqual(["identity", "summary", "tags"]);
    expect(migrated.order).not.toContain("platform");
    expect(migrated.widths.identity).toBe(520);
    expect(migrated.visible.identity).toBe(true);
    expect(migrated.visible.summary).toBe(false);
    expect(migrated.pageSize).toBe(50);
  });

  it("combines customized legacy code and title widths within identity limits", () => {
    const migrated = migratePrivateTablePreferencesV2({
      order: ["tags", "code", "title"],
      widths: { code: 244, title: 410 },
      pageSize: 200
    });
    expect(migrated.order.slice(0, 2)).toEqual(["identity", "tags"]);
    expect(migrated.widths.identity).toBe(654);
    expect(migrated.pageSize).toBe(200);
  });

  it("normalizes old saved-view preferences without duplicate identity columns", () => {
    const normalized = normalizePrivateTablePreferences({
      order: ["title", "rating", "code", "platform", "rating"],
      widths: { code: 900, title: 400 }
    });
    expect(normalized.order.filter((id) => id === "identity")).toHaveLength(1);
    expect(normalized.order.filter((id) => id === "rating")).toHaveLength(1);
    expect(normalized.widths.identity).toBe(900);
  });

  it("reads v3 before v2 and persists the migrated v4 preference", () => {
    const legacyV3 = JSON.stringify({ order: ["tags", "code", "title"], pageSize: 50 });
    const legacyV2 = JSON.stringify({ order: ["summary", "code", "title"], pageSize: 200 });
    const storage = {
      getItem: vi.fn((key: string) => {
        if (key === LEGACY_V3_PRIVATE_TABLE_PREFERENCES_KEY) return legacyV3;
        if (key === LEGACY_PRIVATE_TABLE_PREFERENCES_KEY) return legacyV2;
        return null;
      }),
      setItem: vi.fn()
    };
    const result = readPrivateTablePreferences(storage);
    expect(result.order.slice(0, 2)).toEqual(["identity", "tags"]);
    expect(result.pageSize).toBe(50);
    expect(storage.setItem).toHaveBeenCalledWith(PRIVATE_TABLE_PREFERENCES_KEY, expect.any(String));
  });
});
