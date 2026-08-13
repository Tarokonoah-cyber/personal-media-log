import { describe, expect, it, vi } from "vitest";
import { captureScrollPositions, restoreScrollPositions } from "../src/lib/scrollPosition";

describe("scroll position preservation", () => {
  it("restores both vertical and horizontal positions after refreshed content renders", () => {
    const table = document.createElement("div");
    const mobileList = document.createElement("div");
    document.body.append(table, mobileList);
    table.scrollTop = 640;
    table.scrollLeft = 180;
    mobileList.scrollTop = 920;

    const snapshots = captureScrollPositions([table, mobileList, null]);
    table.scrollTop = 0;
    table.scrollLeft = 0;
    mobileList.scrollTop = 0;
    const schedule = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    restoreScrollPositions(snapshots, schedule);

    expect(schedule).toHaveBeenCalledOnce();
    expect(table.scrollTop).toBe(640);
    expect(table.scrollLeft).toBe(180);
    expect(mobileList.scrollTop).toBe(920);
  });
});
