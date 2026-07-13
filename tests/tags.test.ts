import { describe, expect, it } from "vitest";
import { addTags, normalizeTags, parseTagInput } from "../src/lib/tags";

describe("tag normalization", () => {
  it("splits pasted tag text by common separators", () => {
    expect(parseTagInput("#FC2, 劇情、短髮  ; 高清\nFC2")).toEqual(["FC2", "劇情", "短髮", "高清"]);
  });

  it("deduplicates and trims existing tag arrays", () => {
    expect(normalizeTags([" 劇情 ", "劇情", "#短髮", ""])).toEqual(["劇情", "短髮"]);
  });

  it("adds multiple incoming tags without duplicating current tags", () => {
    expect(addTags(["劇情"], "#劇情, 長髮、神作")).toEqual(["劇情", "長髮", "神作"]);
  });
});
