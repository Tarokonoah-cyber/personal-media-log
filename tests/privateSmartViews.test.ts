import { describe, expect, it } from "vitest";
import { buildItemWhere } from "../functions/_lib/items";
import { privateSmartViews } from "../src/lib/privateSmartViews";
import type { ItemListParams } from "../functions/_lib/types";

const params = (qualityView: ItemListParams["qualityView"]): ItemListParams => ({ page: 1, pageSize: 200, privateOnly: true, qualityView });

describe("private Smart Views", () => {
  it("covers the explicit high-throughput inboxes", () => {
    expect(privateSmartViews.map((view) => view.id)).toEqual([
      "missing_tags", "unrated", "incomplete_metadata", "missing_people", "suspected_duplicate", "unset_collection"
    ]);
  });

  it("uses existing relationships for no-tag and review-only duplicate queries", () => {
    expect(buildItemWhere(params("missing_tags")).whereSql).toContain("NOT EXISTS");
    const duplicateSql = buildItemWhere(params("suspected_duplicate")).whereSql;
    expect(duplicateSql).toContain("GROUP BY grouped_items.normalized_code HAVING COUNT(*) > 1");
    expect(duplicateSql).toContain("lower(trim(coalesce(grouped_items.maker, '')))");
    expect(duplicateSql).toContain("HAVING COUNT(*) > 1");
    expect(duplicateSql.toLowerCase()).not.toMatch(/\bdelete\s+from\b/);
  });
});
