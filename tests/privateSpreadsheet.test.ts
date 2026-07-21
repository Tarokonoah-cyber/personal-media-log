import { describe, expect, it } from "vitest";
import {
  emptyPrivateRowDraft,
  privateCellPatch,
  privateCellValue,
  privateIdentityLabel,
  privateIdentityPatch,
  privateIdentityValue,
  privateRowDraftToInput
} from "../src/lib/privateSpreadsheet";
import type { MediaItem } from "../src/types";

describe("private spreadsheet data flow", () => {
  it("creates a private record with five-star input and a separate used collection", () => {
    const input = privateRowDraftToInput({
      ...emptyPrivateRowDraft("2026-07-20"),
      code: "fc2 ppv 1234567",
      title: "Sample title",
      rating: "4",
      collection: "masterpiece",
      actress: "Performer A, Performer B",
      platform: "FC2",
      maker: "Studio",
      tags: "#recommended, plot",
      releaseDate: "2026-07-01",
      summary: "Short note"
    });

    expect(input).toMatchObject({
      raw_title: "Sample title",
      official_title: "Sample title",
      code: "fc2 ppv 1234567",
      rating: 8,
      collection_level: "masterpiece",
      used: false,
      watched_at: "2026-07-20",
      release_date: "2026-07-01",
      release_year: 2026,
      platform: "FC2",
      maker: "Studio",
      quick_note: "Short note",
      people: ["Performer A", "Performer B"],
      tags: ["recommended", "plot"]
    });
  });

  it("maps the highest collection to used and defaults an empty actress to amateur", () => {
    const input = privateRowDraftToInput({
      ...emptyPrivateRowDraft("2026-07-20"),
      code: "ABC-123",
      collection: "used",
      actress: ""
    });

    expect(input).toMatchObject({
      rating: null,
      collection_level: "masterpiece",
      favorite_level: "已使用",
      used: true,
      people: ["素人"]
    });
    expect(emptyPrivateRowDraft().actress).toBe("素人");
  });

  it("maps ordinary spreadsheet cells to focused item patches", () => {
    const item = {
      raw_title: "Original title",
      official_title: null,
      code: "ABC-123",
      people: ["Performer A"],
      tags: ["plot"],
      watched_at: "2026-07-01",
      release_date: "2026-06-15",
      quick_note: null,
      metadata_json: "{}"
    } as MediaItem;

    expect(privateCellValue(item, "actress")).toBe("Performer A");
    expect(privateCellPatch(item, "tags", "plot, outdoor, plot")).toEqual({ tags: ["plot", "outdoor"] });
    expect(privateCellPatch(item, "maker", " Studio ")).toEqual({ maker: "Studio" });
    expect(privateCellPatch(item, "actress", "")).toEqual({ people: ["素人"] });
    expect(privateCellValue(item, "releaseDate")).toBe("2026-06-15");
    expect(privateCellPatch(item, "releaseDate", "2025-03-12")).toEqual({ release_date: "2025-03-12", release_year: 2025 });
  });

  it("renders code and optional title in one identity cell", () => {
    const withTitle = {
      raw_title: "A readable title",
      official_title: "A readable title",
      code: "FC2-PPV-1234567",
      people: [],
      tags: [],
      metadata_json: "{}"
    } as MediaItem;
    const codeOnly = { ...withTitle, raw_title: "FC2-PPV-1234567", official_title: null } as MediaItem;

    expect(privateIdentityValue(withTitle)).toEqual({ code: "FC2-PPV-1234567", title: "A readable title" });
    expect(privateIdentityLabel(withTitle)).toBe("FC2-PPV-1234567 — A readable title");
    expect(privateIdentityValue(codeOnly)).toEqual({ code: "FC2-PPV-1234567", title: "" });
    expect(privateIdentityLabel(codeOnly)).toBe("FC2-PPV-1234567");
  });

  it("updates identity fields together and requires a code", () => {
    expect(privateIdentityPatch({ code: " ABC-123 ", title: " Updated title " })).toEqual({
      code: "ABC-123",
      official_title: "Updated title",
      raw_title: "Updated title"
    });
    expect(privateIdentityPatch({ code: "ABC-123", title: "" })).toEqual({
      code: "ABC-123",
      official_title: null,
      raw_title: "ABC-123"
    });
    expect(() => privateIdentityPatch({ code: " ", title: "Title" })).toThrow("番號不能空白");
  });
});
