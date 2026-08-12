import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoverImage } from "../src/components/CoverImage";

describe("CoverImage", () => {
  it("shows a useful fallback when the remote image fails", () => {
    render(<CoverImage src="https://invalid.example/cover.jpg" alt="封面" fallback={<span>無封面</span>} />);

    fireEvent.error(screen.getByRole("img", { name: "封面" }));

    expect(screen.queryByRole("img", { name: "封面" })).not.toBeInTheDocument();
    expect(screen.getByText("無封面")).toBeVisible();
  });
});
