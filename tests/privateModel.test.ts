import { describe, expect, it } from "vitest";
import { findWorkCodeConflict, normalizeCollectionLevel, normalizeWorkCode, workCodesEqual } from "../shared/privateModel";

describe("collection level normalization", () => {
  it.each([
    [true, "normal"], [false, "unset"], [null, "unset"], [undefined, "unset"],
    ["神作", "masterpiece"], ["一般", "normal"], ["淘汰", "discard"], ["invalid", "unset"]
  ])("maps %s to %s", (input, expected) => expect(normalizeCollectionLevel(input)).toBe(expected));
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
