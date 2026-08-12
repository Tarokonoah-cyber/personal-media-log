import { describe, expect, it } from "vitest";
import { chunkSqlValues } from "../functions/_lib/items";

describe("item relation hydration", () => {
  it("keeps 200-row relation queries below D1's SQL variable limit", () => {
    const ids = Array.from({ length: 200 }, (_, index) => `item-${index}`);
    const chunks = chunkSqlValues(ids);

    expect(chunks).toHaveLength(3);
    expect(chunks.every((chunk) => chunk.length <= 80)).toBe(true);
    expect(chunks.flat()).toEqual(ids);
  });

  it("does not let callers raise the safe chunk ceiling", () => {
    expect(chunkSqlValues([1, 2, 3], 200)).toEqual([[1, 2, 3]]);
  });
});
