import { describe, expect, it } from "vitest";
import { findWorkCodeConflict, normalizeCollectionLevel, normalizePlatform, normalizeWorkCode, validateQuickEdit, workCodesEqual } from "../shared/privateModel";

describe("collection level normalization", () => {
  it.each([
    [true, "normal"], [false, "unset"], [null, "unset"], [undefined, "unset"],
    ["神作", "masterpiece"], ["一般", "normal"], ["淘汰", "discard"], ["invalid", "unset"]
  ])("maps %s to %s", (input, expected) => expect(normalizeCollectionLevel(input)).toBe(expected));
});

describe("private taxonomy and quick edits", () => {
  it.each([
    [{ code: "FC2PPV-2255291" }, "FC2"],
    [{ code: "𝙼𝙸𝙳𝙰-𝟼𝟼𝟸" }, "JAV"],
    [{ code: "SSNI-575" }, "JAV"],
    [{ code: "FCVPPV-4615888" }, "unknown"]
  ])("classifies known platforms without guessing", (input, expected) => expect(normalizePlatform(input)).toBe(expected));

  it("normalizes mathematical alphanumeric codes with NFKC", () => expect(normalizeWorkCode("𝚂𝚃𝙰𝚁𝚃-𝟻𝟾𝟹")).toBe("START-583"));
  it("allows only supported private quick edits", () => {
    expect(validateQuickEdit("collection_level", "masterpiece")).toEqual({ field: "collection_level", value: "masterpiece" });
    expect(validateQuickEdit("rating", null)).toEqual({ field: "rating", value: null });
    expect(validateQuickEdit("rating", 11)).toBeNull();
    expect(validateQuickEdit("used", true)).toEqual({ field: "used", value: true });
    expect(validateQuickEdit("private_status", "rewatch")).toEqual({ field: "private_status", value: "rewatch" });
    expect(validateQuickEdit("private_status", "watched")).toBeNull();
    expect(validateQuickEdit("platform", "JAV")).toBeNull();
  });
});

describe("work code normalization", () => {
  it.each([
    [" fc2-ppv-4907361 ", "FC2-PPV-4907361"],
    ["fc2ppv4907361", "FC2-PPV-4907361"],
    ["FC2 PPV 4907361", "FC2-PPV-4907361"],
    ["FC2—PPV—4907361", "FC2-PPV-4907361"],
    ["start–583", "START-583"],
    [" ssni 575 ", "SSNI-575"],
    ["custom title 2026", "CUSTOM TITLE 2026"]
  ])("normalizes %s", (input, expected) => expect(normalizeWorkCode(input)).toBe(expected));

  it("treats case and dash variants as the same code", () => expect(workCodesEqual("start–583", "START-583")).toBe(true));
  it("ignores the edited item itself", () => expect(findWorkCodeConflict("START-583", [{ id: "a", code: "start–583" }], "a")).toBeUndefined());
  it("finds a different conflicting item", () => expect(findWorkCodeConflict("START-583", [{ id: "a", code: "start–583" }], "b")?.id).toBe("a"));
});
