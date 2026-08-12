import { beforeEach, describe, expect, it } from "vitest";
import { canonicalizeTagInput, rankTagSuggestions, readRecentTags, rememberRecentTags, saveTagAlias } from "../src/lib/tagWorkflow";

describe("high-throughput tag workflow", () => {
  beforeEach(() => localStorage.clear());

  it("resolves aliases and existing canonical casing before a write", () => {
    expect(saveTagAlias("story", "劇情")).toBe(true);
    expect(canonicalizeTagInput("story, fc2", ["劇情", "FC2"])).toEqual(["劇情", "FC2"]);
  });

  it("ranks recent tags before frequency-ordered known tags", () => {
    rememberRecentTags(["短髮", "劇情"]);
    expect(readRecentTags()).toEqual(["短髮", "劇情"]);
    expect(rankTagSuggestions(["常用", "劇情", "戶外"], "").slice(0, 4)).toEqual(["短髮", "劇情", "常用", "戶外"]);
  });
});
