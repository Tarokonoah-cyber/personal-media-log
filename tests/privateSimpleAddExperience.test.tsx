import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SimpleAddModal } from "../src/App";
import {
  PRIVATE_SIMPLE_ADD_DRAFT_KEY,
  emptyPrivateSimpleAddDraft,
  readPrivateSimpleAddDraft,
  savePrivateSimpleAddDraft
} from "../src/lib/privateSimpleAddDraft";
import type { ItemInput } from "../src/types";

describe("private simple-add draft experience", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
    vi.restoreAllMocks();
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
    expect(screen.getByLabelText("片名")).toHaveValue("未完成片名");
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
});

function PrivateAddHarness() {
  const [open, setOpen] = useState(true);
  return open
    ? <SimpleAddModal privateMode knownTags={[]} loading={false} onClose={() => setOpen(false)} onSubmit={vi.fn()} />
    : <div>私密工作台</div>;
}

function renderPrivateModal({
  onClose = vi.fn(),
  onSubmit = vi.fn().mockResolvedValue(undefined)
}: {
  onClose?: () => void;
  onSubmit?: (input: ItemInput) => Promise<void>;
} = {}) {
  return render(
    <SimpleAddModal
      privateMode
      knownTags={[]}
      loading={false}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
