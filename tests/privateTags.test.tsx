import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagEditor } from "../src/components/TagEditor";
import { PRIVATE_TAG_PRESETS, PUBLIC_TAG_PRESETS, tagPresetsForScope } from "../src/lib/tagPresets";
import { saveTagAlias } from "../src/lib/tagWorkflow";

describe("private tag presets and editor", () => {
  it("keeps private presets separate from public genre tags", () => {
    expect(tagPresetsForScope("private")).toEqual(expect.arrayContaining(["人妻", "熟女", "素人", "FC2"]));
    expect(tagPresetsForScope("private")).not.toEqual(expect.arrayContaining(["歷史", "犯罪", "動作", "動畫", "奇幻"]));
    expect(tagPresetsForScope("public")).toEqual(expect.arrayContaining(["歷史", "犯罪", "動作", "動畫", "奇幻"]));
    expect(PUBLIC_TAG_PRESETS).not.toEqual(PRIVATE_TAG_PRESETS);
  });

  it("adds custom tags with Enter and rejects blanks", async () => {
    const onChange = vi.fn();
    render(<TagEditor tags={[]} knownTags={["人妻"]} onChange={onChange} placeholder="輸入私密標籤後按 Enter" />);
    const input = screen.getByPlaceholderText("輸入私密標籤後按 Enter");
    await userEvent.type(input, " 自訂標籤 {Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["自訂標籤"]);
    await userEvent.type(input, "   {Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("does not show selected tags as suggestions and can remove chips", async () => {
    const onChange = vi.fn();
    const { container } = render(<TagEditor tags={["劇情"]} knownTags={["劇情", "短髮"]} onChange={onChange} />);
    const suggestions = container.querySelector(".tag-suggestions");
    expect(suggestions?.textContent).not.toContain("#劇情");
    expect(screen.getByRole("option", { name: "#短髮" })).toBeVisible();
    await userEvent.click(screen.getByTitle("移除 劇情"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("commits an alias as its canonical tag", async () => {
    localStorage.clear();
    expect(saveTagAlias("story", "劇情")).toBe(true);
    const onChange = vi.fn();
    render(<TagEditor tags={[]} knownTags={["劇情"]} onChange={onChange} />);

    await userEvent.type(screen.getByRole("combobox"), "story{Enter}");

    expect(onChange).toHaveBeenLastCalledWith(["劇情"]);
    expect(onChange).not.toHaveBeenCalledWith(["story"]);
  });
});
