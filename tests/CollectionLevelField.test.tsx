import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CollectionLevelField } from "../src/components/ItemEditor";

describe("CollectionLevelField", () => {
  it("renders one mutually exclusive selection and supports keyboard selection", async () => {
    const onChange = vi.fn();
    render(<CollectionLevelField value="normal" onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "一般" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "神作" }));
    expect(onChange).toHaveBeenCalledWith("masterpiece");
  });

  it("can receive keyboard-first focus from Organization Inbox", () => {
    render(<CollectionLevelField value="normal" autoFocus onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "一般" })).toHaveFocus();
  });
});
