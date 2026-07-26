import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRIVATE_DEFAULT_ACTRESS } from "../shared/privateModel";
import { SimpleAddModal } from "../src/App";
import {
  PRIVATE_SIMPLE_ADD_DRAFT_KEY,
  emptyPrivateSimpleAddDraft,
  readPrivateSimpleAddDraft,
  savePrivateSimpleAddDraft
} from "../src/lib/privateSimpleAddDraft";
import type { ItemInput } from "../src/types";
import type { PrivateTableMode } from "../src/lib/privateTablePreferences";

describe("private simple-add draft experience", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ conflict: null }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })));
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("restores an unfinished draft and identifies when it was saved", () => {
    savePrivateSimpleAddDraft({
      ...emptyPrivateSimpleAddDraft("2026-07-23"),
      code: "FC2-PPV-123",
      title: "未完成片名",
      summary: "尚未送出的內容"
    }, window.localStorage, "2026-07-22T15:30:00.000Z");

    renderPrivateModal();

    expect(screen.getByLabelText("番號")).toHaveValue("FC2-PPV-123");
    expect(screen.queryByLabelText("片名")).toBeNull();
    expect(readPrivateSimpleAddDraft()?.draft.title).toBe("未完成片名");
    expect(screen.getByText(/已恢復.+未完成草稿/)).toBeVisible();
  });

  it("flushes the latest input when browser Back closes the mobile form", async () => {
    render(<PrivateAddHarness />);
    fireEvent.change(screen.getByLabelText("番號"), { target: { value: "FC2-PPV-456" } });
    fireEvent.change(screen.getByLabelText("快速筆記"), { target: { value: "剛輸入就按返回" } });

    window.history.replaceState({}, "", "/");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
    });

    expect(screen.getByText("私密工作台")).toBeVisible();
    expect(readPrivateSimpleAddDraft()?.draft).toMatchObject({
      code: "FC2-PPV-456",
      summary: "剛輸入就按返回"
    });
  });

  it("keeps the draft when create fails and clears it after success", async () => {
    const onSubmit = vi.fn()
      .mockRejectedValueOnce(new Error("作品代號已存在"))
      .mockResolvedValueOnce(undefined);
    renderPrivateModal({ onSubmit });
    fireEvent.change(screen.getByLabelText("番號"), { target: { value: "FC2-PPV-789" } });
    window.dispatchEvent(new Event("pagehide"));

    await userEvent.click(screen.getByRole("button", { name: "新增" }));
    expect(await screen.findByText("作品代號已存在")).toBeVisible();
    expect(window.localStorage.getItem(PRIVATE_SIMPLE_ADD_DRAFT_KEY)).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "新增" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(window.localStorage.getItem(PRIVATE_SIMPLE_ADD_DRAFT_KEY)).toBeNull();
  });

  it("clears only after explicit confirmation and resets the form", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPrivateModal();
    fireEvent.change(screen.getByLabelText("番號"), { target: { value: "FC2-PPV-999" } });
    window.dispatchEvent(new Event("pagehide"));

    await userEvent.click(screen.getByRole("button", { name: "清除草稿" }));
    expect(screen.getByLabelText("番號")).toHaveValue("FC2-PPV-999");
    expect(window.localStorage.getItem(PRIVATE_SIMPLE_ADD_DRAFT_KEY)).not.toBeNull();

    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: "清除草稿" }));
    expect(screen.getByLabelText("番號")).toHaveValue("");
    expect(screen.getByText("草稿已清除")).toBeVisible();
    expect(window.localStorage.getItem(PRIVATE_SIMPLE_ADD_DRAFT_KEY)).toBeNull();
  });

  it("submits a typical FC2 entry without exposing low-value fields", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderPrivateModal({ onSubmit, knownTags: ["中出", "白虎"] });

    fireEvent.change(screen.getByLabelText("番號"), { target: { value: "fc2 ppv 4851113" } });
    await userEvent.click(screen.getByRole("radio", { name: "4 星" }));
    await userEvent.click(screen.getByRole("button", { name: "神作" }));
    fireEvent.change(screen.getByLabelText("快速筆記"), { target: { value: "快速完成一筆" } });
    await userEvent.click(screen.getByRole("button", { name: "#中出" }));
    await userEvent.click(screen.getByRole("button", { name: "新增" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      code: "FC2-PPV-4851113",
      platform: "FC2",
      maker: "FC2",
      rating: 8,
      quick_note: "快速完成一筆",
      tags: ["中出"],
      people: ["素人"]
    }));
  });

  it("uses the FC2 template for unknown codes and keeps low-value fields hidden", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderPrivateModal({ onSubmit, privateTableMode: "fc2" });

    fireEvent.change(screen.getByLabelText("番號"), { target: { value: "CUSTOM-001" } });
    await userEvent.click(screen.getByRole("button", { name: "更多資料" }));

    expect(screen.queryByLabelText("片名")).toBeNull();
    expect(screen.queryByLabelText("女優")).toBeNull();
    expect(screen.queryByLabelText("平台")).toBeNull();
    expect(screen.queryByLabelText("片商")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "新增" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      code: "CUSTOM-001",
      platform: "FC2",
      maker: "FC2",
      people: [PRIVATE_DEFAULT_ACTRESS]
    }));
  });

  it("uses the JAV template for unknown codes and exposes actress and maker", async () => {
    renderPrivateModal({ privateTableMode: "jav" });
    fireEvent.change(screen.getByLabelText("番號"), { target: { value: "CUSTOM-002" } });

    expect(screen.getByLabelText("女優")).toHaveValue(PRIVATE_DEFAULT_ACTRESS);
    expect(screen.getByLabelText("片商")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "更多資料" }));
    expect(screen.getByLabelText("片名")).toBeVisible();
    expect(screen.queryByLabelText("平台")).toBeNull();
  });

  it("keeps the modal open and resets record fields after add-and-continue", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderPrivateModal({ onSubmit });
    fireEvent.change(screen.getByLabelText("番號"), { target: { value: "FC2-PPV-100" } });
    fireEvent.change(screen.getByLabelText("快速筆記"), { target: { value: "第一筆" } });

    await userEvent.click(screen.getByRole("button", { name: "新增並繼續" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("番號")).toHaveValue("");
    expect(screen.getByLabelText("快速筆記")).toHaveValue("");
    expect(screen.getByRole("dialog", { name: "快速新增私密資料" })).toBeVisible();
  });

  it("warns about an existing code before submit and opens the existing item", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      conflict: { id: "item-existing", code: "FC2-PPV-200", title: "既有作品" }
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })));
    const onOpenExisting = vi.fn();
    renderPrivateModal({ onOpenExisting });
    fireEvent.change(screen.getByLabelText("番號"), { target: { value: "FC2-PPV-200" } });

    expect(await screen.findByText("這個番號已存在")).toBeVisible();
    expect(screen.getByRole("button", { name: "新增" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "開啟" }));
    expect(onOpenExisting).toHaveBeenCalledWith("item-existing");
  });
});

function PrivateAddHarness() {
  const [open, setOpen] = useState(true);
  return open
    ? <SimpleAddModal privateMode knownTags={[]} loading={false} onClose={() => setOpen(false)} onSubmit={vi.fn()} />
    : <div>私密工作台</div>;
}

function renderPrivateModal({
  onClose = vi.fn(),
  onSubmit = vi.fn().mockResolvedValue(undefined),
  onOpenExisting,
  knownTags = [],
  privateTableMode
}: {
  onClose?: () => void;
  onSubmit?: (input: ItemInput) => Promise<void>;
  onOpenExisting?: (id: string) => void;
  knownTags?: string[];
  privateTableMode?: PrivateTableMode;
} = {}) {
  return render(
    <SimpleAddModal
      privateMode
      privateTableMode={privateTableMode}
      knownTags={knownTags}
      loading={false}
      onClose={onClose}
      onSubmit={onSubmit}
      onOpenExisting={onOpenExisting}
    />
  );
}
