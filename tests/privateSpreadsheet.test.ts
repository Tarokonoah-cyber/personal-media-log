import { describe, expect, it } from "vitest";
import { emptyPrivateRowDraft, privateCellPatch, privateCellValue, privateRowDraftToInput } from "../src/lib/privateSpreadsheet";
import { privateItemDetails } from "../src/lib/privacy";
import type { MediaItem } from "../src/types";

describe("private spreadsheet data flow", () => {
  it("creates a completed private record without a visible status choice", () => {
    const input = privateRowDraftToInput({
      ...emptyPrivateRowDraft("2026-07-20"),
      code: "fc2 ppv 1234567",
      title: "測試片名",
      rating: "8.5",
      collection: "masterpiece",
      actress: "演員 A、演員 B",
      platform: "FC2",
      maker: "片商",
      tags: "#高畫質、劇情, 高畫質",
      summary: "快速筆記"
    });

    expect(input).toMatchObject({
      raw_title: "測試片名",
      official_title: "測試片名",
      code: "fc2 ppv 1234567",
      rating: 8.5,
      collection_level: "masterpiece",
      favorite_level: "神作",
      used: true,
      media_status: "已觀看",
      watched_at: "2026-07-20",
      platform: "FC2",
      maker: "片商",
      quick_note: "快速筆記",
      people: ["演員 A", "演員 B"],
      tags: ["高畫質", "劇情"]
    });
  });

  it("maps spreadsheet cells to focused item patches", () => {
    const item = {
      raw_title: "舊片名",
      official_title: null,
      code: "ABC-123",
      people: ["演員 A"],
      tags: ["劇情"],
      watched_at: "2026-07-01",
      quick_note: null,
      metadata_json: JSON.stringify({ title: "匯入片名" })
    } as MediaItem;

    expect(privateCellValue(item, "actress")).toBe("演員 A");
    expect(privateCellPatch(item, "title", "手動片名")).toEqual({ official_title: "手動片名", raw_title: "手動片名" });
    expect(privateCellPatch(item, "tags", "劇情、戶外, 劇情")).toEqual({ tags: ["劇情", "戶外"] });

    const updated = { ...item, official_title: "手動片名" };
    expect(privateItemDetails(updated).title).toBe("手動片名");
  });
});
