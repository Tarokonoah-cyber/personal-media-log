import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ItemEditor } from "../src/components/ItemEditor";
import { formatDuplicateCodeError } from "../src/lib/api";
import { shouldValidateNormalizedCode } from "../functions/_lib/items";
import type { MediaItem } from "../src/types";

const privateItem: MediaItem = {
  id: "item-private",
  raw_title: "FC2-PPV-1234567",
  official_title: null,
  original_title: null,
  code: "FC2-PPV-1234567",
  type: null,
  category: null,
  platform: "FC2",
  maker: "FC2",
  series: null,
  release_year: 2026,
  release_date: "2026-07-01",
  year: 2026,
  watched_at: "2026-07-22",
  started_at: null,
  completed_at: null,
  planned_at: null,
  rating: 8,
  rewatch_score: null,
  favorite: false,
  favorite_level: "一般",
  collection_level: "normal",
  normalized_code: "FC2-PPV-1234567",
  used: true,
  is_private: true,
  status: "complete",
  media_status: "已觀看",
  quick_note: "保留快速筆記",
  long_note: "既有完整心得仍保留在資料中",
  source_url: null,
  cover_url: null,
  metadata_json: null,
  progress_json: null,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-22T00:00:00.000Z",
  deleted_at: null,
  tags: [],
  people: ["素人"],
  collections: []
};

describe("private editor experience", () => {
  it("keeps the release date but hides redundant private-only fields", () => {
    render(<ItemEditor item={privateItem} privateMode onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByLabelText("發行日期")).toHaveValue("2026-07-01");
    expect(screen.queryByLabelText("發售年份")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("完整心得")).not.toBeInTheDocument();
    expect(screen.getByLabelText("快速筆記")).toHaveValue("保留快速筆記");
  });

  it("only rechecks uniqueness when the normalized code changes", () => {
    expect(shouldValidateNormalizedCode("FC2-PPV-1234567", "FC2-PPV-1234567")).toBe(false);
    expect(shouldValidateNormalizedCode("FC2-PPV-1234567", "FC2-PPV-7654321")).toBe(true);
    expect(shouldValidateNormalizedCode(null, "FC2-PPV-1234567")).toBe(true);
  });

  it("shows a concise duplicate-code message without normalization internals", () => {
    const message = formatDuplicateCodeError({
      inputCode: "fc2 ppv 1234567",
      normalizedCode: "FC2-PPV-1234567",
      existing: { code: "FC2-PPV-1234567", title: "既有作品" }
    });

    expect(message).toBe("番號「FC2-PPV-1234567」已有其他紀錄；請確認是否為重複作品。");
    expect(message).not.toContain("正規化");
  });

  it("delegates delete confirmation to the app only once", async () => {
    const confirm = vi.spyOn(window, "confirm");
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<ItemEditor item={privateItem} privateMode onClose={vi.fn()} onSave={vi.fn()} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole("button", { name: "刪除" }));

    expect(confirm).not.toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledWith(privateItem.id);
  });

  it.each(["{Control>}s{/Control}", "{Meta>}s{/Meta}"])("saves with Ctrl/Cmd+S (%s)", async (shortcut) => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ItemEditor item={privateItem} privateMode onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()} />);

    await userEvent.keyboard(shortcut);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it.each(["{Control>}{Enter}{/Control}", "{Meta>}{Enter}{/Meta}"])("saves and advances with Ctrl/Cmd+Enter (%s)", async (shortcut) => {
    const onSaveAndNext = vi.fn().mockResolvedValue(undefined);
    render(<ItemEditor item={privateItem} privateMode onClose={vi.fn()} onSave={vi.fn()} onSaveAndNext={onSaveAndNext} onDelete={vi.fn()} />);

    await userEvent.keyboard(shortcut);

    await waitFor(() => expect(onSaveAndNext).toHaveBeenCalledTimes(1));
  });

  it("does not advance when save-and-next fails", async () => {
    const onSaveAndNext = vi.fn().mockRejectedValue(new Error("release-gate-save-failed"));
    render(<ItemEditor item={privateItem} privateMode onClose={vi.fn()} onSave={vi.fn()} onSaveAndNext={onSaveAndNext} onDelete={vi.fn()} />);

    await userEvent.keyboard("{Control>}{Enter}{/Control}");

    expect(await screen.findByText("release-gate-save-failed")).toBeVisible();
    expect(screen.getByRole("heading", { name: "FC2-PPV-1234567" })).toBeVisible();
    expect(onSaveAndNext).toHaveBeenCalledTimes(1);
  });
});
