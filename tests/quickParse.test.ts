import { describe, expect, it } from "vitest";
import { parseQuickEntry } from "../src/lib/quickParse";

describe("parseQuickEntry rating scale", () => {
  it("keeps explicit ten-point ratings unchanged", () => {
    expect(parseQuickEntry("藍鳥 8/10 #棒球").rating).toBe(8);
  });

  it("converts explicit five-star ratings to the canonical ten-point scale", () => {
    expect(parseQuickEntry("藍鳥 4.5/5 #棒球").rating).toBe(9);
  });

  it("maps descriptive ratings to the canonical ten-point scale", () => {
    expect(parseQuickEntry("藍鳥 神作").rating).toBe(10);
    expect(parseQuickEntry("藍鳥 普通").rating).toBe(6);
  });

  it("uses the same canonical scale for private quick entry", () => {
    expect(parseQuickEntry("ABC-123 4/5", { privateMode: true }).rating).toBe(8);
  });
});
