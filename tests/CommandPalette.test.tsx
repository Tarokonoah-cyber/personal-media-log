import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "../src/components/CommandPalette";

describe("CommandPalette", () => {
  it("filters and executes a command without a mouse", async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    render(<CommandPalette open actions={[
      { id: "missing-tags", label: "Smart View：無 Tag", group: "搜尋與檢視", run },
      { id: "rating", label: "批次評分：5 星", group: "批次整理", run: vi.fn() }
    ]} onOpenChange={vi.fn()} onSearch={vi.fn()} />);
    const input = screen.getByLabelText("搜尋指令");
    await user.type(input, "無 tag{Enter}");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("falls back to a direct table search", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<CommandPalette open actions={[]} onOpenChange={vi.fn()} onSearch={onSearch} />);
    await user.type(screen.getByLabelText("搜尋指令"), "ABW-123{Enter}");
    expect(onSearch).toHaveBeenCalledWith("ABW-123");
  });

  it("closes with Escape without executing a command", async () => {
    const onOpenChange = vi.fn();
    const run = vi.fn();
    render(<CommandPalette open actions={[{ id: "noop", label: "不執行", run }]} onOpenChange={onOpenChange} onSearch={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("搜尋指令"), "{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(run).not.toHaveBeenCalled();
  });
});
