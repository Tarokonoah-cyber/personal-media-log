import { describe, expect, it } from "vitest";
import { json, noContent } from "../functions/_lib/http";

describe("private API response headers", () => {
  it("prevents JSON responses from being cached or MIME-sniffed", () => {
    const response = json({ ok: true });

    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
  });

  it("applies the same protection to empty mutation responses", () => {
    const response = noContent();

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
