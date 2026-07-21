import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ViewSidebar } from "../src/components/ViewSidebar";

vi.mock("../src/lib/api", () => ({ searchPrivateFacet: vi.fn(async () => ({ facet: "actress", items: [] })) }));

it("renders JAV studios as nested filters without Other", () => {
  const onPrivateFilter = vi.fn();
  const { container } = render(<ViewSidebar activeView="私密" displayView="table" activeTool={null} summaryItems={[]} inboxTotal={0} tags={[]} filters={{ platformFilters: "", makerFilters: "", favoriteLevelFilters: "", personFilters: "", missingPeople: false } as never} privateMode privateSummary={{ total: 17, used: 0, unused: 17, averageRating: null, collectionCounts: [] }} privateFacets={{ source: [{ value: "FC2", count: 7 }, { value: "JAV", count: 9 }, { value: "其他", count: 1 }], maker: [], series: [], actress: [], javMaker: [{ value: "SOD", count: 4 }, { value: "S1", count: 3 }, { value: "FALENO", count: 2 }], tags: [], ratingBuckets: [], favoriteLevel: [{ value: "unset", count: 17 }], used: [], status: [] }} safeMode={false} collapsed={false} mobileOpen={false} onToggleCollapsed={vi.fn()} onCloseMobile={vi.fn()} onView={vi.fn()} onDisplayView={vi.fn()} onLibrary={vi.fn()} onTag={vi.fn()} onTool={vi.fn()} onPrivateFilter={onPrivateFilter} />);
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
