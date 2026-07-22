import { describe, expect, it } from "vitest";
import { parseJsonItems } from "../functions/_lib/importExport";
import { buildItemWhere } from "../functions/_lib/items";
import { privateItemWhereSql, publicItemWhereSql } from "../functions/_lib/privacy";
import { mapRows } from "../src/lib/importMapping";
import { isPrivateItem } from "../src/lib/privacy";
import type { MediaItem } from "../src/types";

describe("private collection boundary", () => {
  it("uses the explicit privacy flag as the only database boundary", () => {
    expect(privateItemWhereSql("items")).toBe("(items.is_private = 1)");
    expect(publicItemWhereSql("items")).toBe("(coalesce(items.is_private, 0) = 0)");

    const query = buildItemWhere({ privateOnly: true, includePrivate: true, page: 1, pageSize: 50 });
    expect(query.whereSql).toContain("items.is_private = 1");
    expect(query.whereSql).not.toContain("metadata_json");
    expect(query.whereSql).not.toContain("item_tags");
  });

  it("does not classify TMDb adult=false metadata as private", () => {
    const item = {
      is_private: false,
      metadata_json: JSON.stringify({ adult: false }),
      type: "movie",
      category: "",
      platform: "TMDb",
      tags: ["TMDb Movie"]
    } as MediaItem;

    expect(isPrivateItem(item)).toBe(false);
    expect(isPrivateItem({ ...item, is_private: true })).toBe(true);
  });

  it("requires imports to provide an explicit is_private value", () => {
    const metadata = JSON.stringify({ adult: false });
    const [serverRow] = parseJsonItems(JSON.stringify([{ raw_title: "Public movie", metadata_json: metadata }]));
    const [clientRow] = mapRows(
      [{ title: "Public movie", metadata }],
      { title: "raw_title", metadata: "metadata_json" }
    );

    expect(serverRow.is_private).toBe(false);
    expect(clientRow.is_private).toBe(false);
  });
});
