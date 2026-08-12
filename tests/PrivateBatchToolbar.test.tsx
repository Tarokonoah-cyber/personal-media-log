import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PrivateBatchToolbar } from "../src/components/PrivateBatchToolbar";

describe("PrivateBatchToolbar", () => {
  it("applies a tag with Enter and clears the completed input", async () => {
    const user = userEvent.setup();
    const onTags = vi.fn().mockResolvedValue({ succeededIds: ["item-1"], failedIds: [] });

    render(
      <PrivateBatchToolbar
        selectedCount={1}
        knownTags={["待整理"]}
        busy={false}
        onCollection={vi.fn()}
        onTags={onTags}
        onDelete={vi.fn()}
        onClear={vi.fn()}
      />
    );

    const input = screen.getByLabelText("批次標籤");
    await user.type(input, "待重看{Enter}");

    expect(onTags).toHaveBeenCalledWith("待重看", "add");
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("applies a rating through the same compact field control", async () => {
    const user = userEvent.setup();
    const onField = vi.fn().mockResolvedValue({ succeededIds: ["item-1"], failedIds: [] });
    render(
      <PrivateBatchToolbar
        selectedCount={20}
        knownTags={[]}
        busy={false}
        onCollection={vi.fn()}
        onField={onField}
        onTags={vi.fn()}
        onDelete={vi.fn()}
        onClear={vi.fn()}
      />
    );
    await user.selectOptions(screen.getByLabelText("批次欄位"), "rating");
    await user.selectOptions(screen.getByLabelText("批次值"), "5");
    await user.click(screen.getAllByRole("button", { name: "套用" })[0]);
    expect(onField).toHaveBeenCalledWith("rating", "5");
  });
});
