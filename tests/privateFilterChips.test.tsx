import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterSheet } from "../src/components/FilterSheet";
import { PrivateFilterChips } from "../src/components/PrivateFilterChips";
import { privateFilterChips } from "../src/lib/privateFilterChips";
import type { ListFilters } from "../src/types";

const filters = (): ListFilters => ({
  query: "", status: "all", favorite: false, highRated: false, ratingMin: "", ratingMax: "", unrated: false,
  usedFilter: "all", privateStatus: "all", collectionLevel: "", favoriteLevel: "all", mediaStatus: "all",
  platformFilters: "", makerFilters: "", favoriteLevelFilters: "", personFilters: "", missingPeople: false,
  hasNote: "all", hasCover: "all", watchStatus: "all", type: "", category: "", tag: "", excludeTag: "",
  year: "", platform: "", maker: "", series: "", codeQuery: "", titleQuery: "", person: "", studio: "",
  watchedFrom: "", watchedTo: "", viewedFrom: "", viewedTo: "", updatedFrom: "", updatedTo: "", page: 4, pageSize: 100
});

describe("private filter shortcuts", () => {
  it("creates individually removable chips for multi-value filters", () => {
    const chips = privateFilterChips({ ...filters(), platformFilters: "FC2,JAV", privateStatus: "rewatch", collectionLevel: "masterpiece", tag: "戶外", titleQuery: "測試" });
    expect(chips.find((chip) => chip.key === "platformFilters:FC2")?.patch).toEqual({ platformFilters: "JAV", page: 1 });
    expect(chips.find((chip) => chip.key === "privateStatus")).toBeUndefined();
    expect(chips.find((chip) => chip.key === "tag")?.label).toBe("包含：#戶外");
    expect(chips.find((chip) => chip.key === "collectionLevel")?.label).toBe("收藏：神作");
    expect(chips.find((chip) => chip.key === "title")?.patch).toEqual({ titleQuery: "", page: 1 });
  });

  it("applies a chip removal patch and resets to page one", async () => {
    const onPatch = vi.fn();
    render(<PrivateFilterChips filters={{ ...filters(), platformFilters: "FC2,JAV" }} onPatch={onPatch} onClear={vi.fn()} />);
    await userEvent.click(screen.getByTitle("移除 平台：FC2"));
    expect(onPatch).toHaveBeenCalledWith({ platformFilters: "JAV", page: 1 });
  });

  it("clears every active filter from the compact chip row", async () => {
    const onClear = vi.fn();
    render(<PrivateFilterChips filters={{ ...filters(), includeTags: "Tag A", excludeTags: "Tag C" }} onPatch={vi.fn()} onClear={onClear} />);
    await userEvent.click(screen.getByRole("button", { name: "全部清除" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("does not expose status controls in private advanced filters", () => {
    const { container } = render(<FilterSheet open filters={filters()} privateMode onChange={vi.fn()} onClose={vi.fn()} />);
    const statusLabels = Array.from(container.querySelectorAll("label")).filter((label) => label.firstChild?.textContent?.trim() === "狀態");
    expect(statusLabels).toHaveLength(0);
    expect(screen.queryByRole("option", { name: "待處理" })).not.toBeInTheDocument();
  });

  it("closes the advanced filter panel with Escape", async () => {
    const onClose = vi.fn();
    render(<FilterSheet open filters={filters()} privateMode onChange={vi.fn()} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
