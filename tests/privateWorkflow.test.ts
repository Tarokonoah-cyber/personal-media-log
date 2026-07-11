import { describe, expect, it } from "vitest";
import { normalizeWorkCode } from "../shared/privateModel";

describe("private workflow contract", () => {
  it("uses the same normalized code contract across UI and API", () => {
    expect(normalizeWorkCode("fc2 ppv 4907361")).toBe("FC2-PPV-4907361");
  });
});
