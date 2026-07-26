import { describe, expect, it } from "vitest";
import {
  movePrivateCell,
  privateClipboardUpdate,
  privateClipboardValue,
  type PrivateCellPosition,
} from "../src/lib/privateSpreadsheetKeyboard";
import type { MediaItem } from "../src/types";

const item = {
  id: "item-1",
  code: "ABC-123",
  raw_title: "Readable title",
  official_title: "Readable title",
  rating: 8.5,
  collection_level: "masterpiece",
  favorite_level: "神作",
  people: ["Performer A", "Performer B"],
  maker: "Studio",
  tags: ["plot"],
  release_date: "2026-06-15",
  watched_at: "2026-07-20",
  quick_note: "Short note",
  metadata_json: "{}",
} as MediaItem;

describe("private spreadsheet keyboard navigation", () => {
  const rows = ["item-1", "item-2"];
  const columns = ["identity", "rating", "tags"] as const;
  const start: PrivateCellPosition = { itemId: "item-1", column: "identity" };

  it("moves by visible rows and columns while clamping arrow movement", () => {
    expect(movePrivateCell(start, rows, columns, "right")).toEqual({ itemId: "item-1", column: "rating" });
    expect(movePrivateCell(start, rows, columns, "left")).toEqual(start);
    expect(movePrivateCell(start, rows, columns, "down")).toEqual({ itemId: "item-2", column: "identity" });
    expect(movePrivateCell({ itemId: "item-2", column: "tags" }, rows, columns, "down")).toEqual({ itemId: "item-2", column: "tags" });
  });

  it("wraps Tab movement between rows and respects table boundaries", () => {
    expect(movePrivateCell({ itemId: "item-1", column: "tags" }, rows, columns, "tabForward")).toEqual({ itemId: "item-2", column: "identity" });
    expect(movePrivateCell({ itemId: "item-2", column: "identity" }, rows, columns, "tabBackward")).toEqual({ itemId: "item-1", column: "tags" });
    expect(movePrivateCell({ itemId: "item-2", column: "tags" }, rows, columns, "tabForward")).toEqual({ itemId: "item-2", column: "tags" });
  });
});

describe("private spreadsheet clipboard", () => {
  it("copies the displayed value for every column kind", () => {
    expect(privateClipboardValue(item, "identity")).toBe("ABC-123 — Readable title");
    expect(privateClipboardValue(item, "rating")).toBe("5");
    expect(privateClipboardValue(item, "favorite")).toBe("神作");
    expect(privateClipboardValue(item, "actress")).toBe("Performer A, Performer B");
  });

  it("parses combined, tab-separated, and code-only identities", () => {
    expect(privateClipboardUpdate(item, "identity", "XYZ-999 — New title")).toEqual({
      kind: "patch",
      patch: { code: "XYZ-999", official_title: "New title", raw_title: "New title" },
    });
    expect(privateClipboardUpdate(item, "identity", "XYZ-999\tTab title")).toEqual({
      kind: "patch",
      patch: { code: "XYZ-999", official_title: "Tab title", raw_title: "Tab title" },
    });
    expect(privateClipboardUpdate(item, "identity", "XYZ-999")).toEqual({
      kind: "patch",
      patch: { code: "XYZ-999", official_title: null, raw_title: "XYZ-999" },
    });
  });

  it("validates ratings, favorites, and dates", () => {
    expect(privateClipboardUpdate(item, "rating", "5 星")).toEqual({ kind: "quick", field: "rating", value: 10 });
    expect(privateClipboardUpdate(item, "rating", "")).toEqual({ kind: "quick", field: "rating", value: null });
    expect(privateClipboardUpdate(item, "favorite", "淘汰")).toEqual({ kind: "quick", field: "collection_level", value: "discard" });
    expect(privateClipboardUpdate(item, "favorite", "normal")).toEqual({ kind: "quick", field: "collection_level", value: "normal" });
    expect(privateClipboardUpdate(item, "favorite", "已使用")).toEqual({ kind: "quick", field: "collection_level", value: "used" });
    expect(privateClipboardUpdate(item, "releaseDate", "2026-02-28")).toEqual({ kind: "patch", patch: { release_date: "2026-02-28", release_year: 2026 } });
    expect(() => privateClipboardUpdate(item, "rating", "6")).toThrow("評分必須是 1–5 星");
    expect(() => privateClipboardUpdate(item, "favorite", "最愛")).toThrow("收藏必須是未分類、一般、神作、已使用或淘汰");
    expect(() => privateClipboardUpdate(item, "releaseDate", "2026-02-30")).toThrow("發行日期格式必須是 YYYY-MM-DD");
  });

  it("uses existing normalization for people and tags", () => {
    expect(privateClipboardUpdate(item, "actress", "Performer A、Performer B、Performer A")).toEqual({ kind: "patch", patch: { people: ["Performer A", "Performer B"] } });
    expect(privateClipboardUpdate(item, "tags", "#plot, outdoor, plot")).toEqual({ kind: "patch", patch: { tags: ["plot", "outdoor"] } });
  });
});
