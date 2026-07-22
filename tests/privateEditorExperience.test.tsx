import React from "react";
import { render, screen } from "@testing-library/react";
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
});
