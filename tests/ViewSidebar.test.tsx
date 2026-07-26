import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ViewSidebar } from "../src/components/ViewSidebar";

vi.mock("../src/lib/api", () => ({ searchPrivateFacet: vi.fn(async () => ({ facet: "actress", items: [] })) }));

afterEach(cleanup);

const privateFacets = {
  source: [{ value: "FC2", count: 7 }, { value: "JAV", count: 9 }, { value: "其他", count: 1 }],
  maker: [],
  series: [],
  actress: [{ value: "女優 A", count: 5 }, { value: "女優 B", count: 4 }],
  javMaker: [{ value: "SOD", count: 4 }, { value: "S1", count: 3 }, { value: "FALENO", count: 2 }],
  tags: [{ value: "中出", count: 8 }, { value: "白虎", count: 4 }],
  ratingBuckets: [],
  favoriteLevel: [{ value: "unset", count: 17 }],
  used: [],
  status: []
};

function renderPrivateSidebar(filters: Record<string, unknown>, onPrivateFilter = vi.fn()) {
  const result = render(<ViewSidebar activeView="私密" displayView="table" activeTool={null} summaryItems={[]} inboxTotal={0} tags={[]} filters={{ platformFilters: "", makerFilters: "", favoriteLevelFilters: "", personFilters: "", missingPeople: false, ...filters } as never} privateMode privateSummary={{ total: 17, used: 0, unused: 17, averageRating: null, collectionCounts: [] }} privateFacets={privateFacets} safeMode={false} collapsed={false} mobileOpen={false} onToggleCollapsed={vi.fn()} onCloseMobile={vi.fn()} onView={vi.fn()} onDisplayView={vi.fn()} onLibrary={vi.fn()} onTag={vi.fn()} onTool={vi.fn()} onPrivateFilter={onPrivateFilter} />);
  return { ...result, onPrivateFilter };
}

it("renders JAV studios as nested filters without Other", () => {
  const { container, onPrivateFilter } = renderPrivateSidebar({});
  const platformSection = screen.getByText("平台").closest(".sidebar-private-facet") as HTMLElement;
  expect(within(platformSection).getByRole("button", { name: /FC2/ })).toBeVisible();
  expect(within(platformSection).getByRole("button", { name: /JAV/ })).toBeVisible();
  expect(within(platformSection).getByTitle("SOD 4")).toBeVisible();
  expect(within(platformSection).getByTitle("S1 3")).toBeVisible();
  within(platformSection).getByTitle("FALENO 2").click();
  expect(onPrivateFilter).toHaveBeenCalledWith(expect.objectContaining({ platformFilters: "JAV", makerFilters: "FALENO" }));
  expect(within(platformSection).queryByText("其他")).toBeNull();
  expect(container.querySelector(".private-nav-tree")).toBeNull();
  expect(screen.getByText("未分類")).toBeVisible();
});

it("replaces the selected platform instead of combining FC2 and JAV", () => {
  const { onPrivateFilter } = renderPrivateSidebar({ platformFilters: "FC2" });
  screen.getByRole("button", { name: /FC2/ }).click();
  screen.getByRole("button", { name: /JAV/ }).click();
  expect(onPrivateFilter).toHaveBeenNthCalledWith(1, expect.objectContaining({ platformFilters: "FC2", makerFilters: "" }));
  expect(onPrivateFilter).toHaveBeenNthCalledWith(2, expect.objectContaining({ platformFilters: "JAV", makerFilters: "" }));
});

it("keeps sidebar favorites and actresses single-select", () => {
  const { onPrivateFilter } = renderPrivateSidebar({ favoriteLevelFilters: "normal", personFilters: "女優 A" });
  screen.getByRole("button", { name: /神作/ }).click();
  screen.getByRole("button", { name: /女優 B/ }).click();
  expect(onPrivateFilter).toHaveBeenNthCalledWith(1, expect.objectContaining({ favoriteLevelFilters: "masterpiece" }));
  expect(onPrivateFilter).toHaveBeenNthCalledWith(2, expect.objectContaining({ personFilters: "女優 B" }));
});

it("renders searchable private tags and replaces the selected tag", () => {
  const { onPrivateFilter } = renderPrivateSidebar({ tag: "中出" });
  const tagSection = screen.getByText("標籤").closest(".sidebar-private-facet") as HTMLElement;
  expect(within(tagSection).getByRole("button", { name: /中出/ })).toHaveAttribute("aria-pressed", "true");
  within(tagSection).getByRole("button", { name: /白虎/ }).click();
  expect(onPrivateFilter).toHaveBeenCalledWith(expect.objectContaining({ tag: "白虎", excludeTag: "" }));
  expect(within(tagSection).getByLabelText("搜尋標籤")).toBeVisible();
});
