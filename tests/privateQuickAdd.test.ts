import { describe, expect, it } from "vitest";
import { PRIVATE_DEFAULT_ACTRESS } from "../shared/privateModel";
import {
  applyPrivateAddCodeDefaults,
  privateAddDefaultsForCode,
  privateQuickAddToInput
} from "../src/lib/privateQuickAdd";
import { emptyPrivateSimpleAddDraft } from "../src/lib/privateSimpleAddDraft";

describe("private quick-add defaults", () => {
  it("normalizes FC2 and supplies all low-value defaults", () => {
    expect(privateAddDefaultsForCode("fc2 ppv 4851113")).toEqual({
      code: "FC2-PPV-4851113",
      platform: "FC2",
      maker: "FC2",
      actress: PRIVATE_DEFAULT_ACTRESS
    });
  });

  it("recognizes JAV without guessing maker or a named actress", () => {
    expect(privateAddDefaultsForCode("ssis 123")).toEqual({
      code: "SSIS-123",
      platform: "JAV",
      maker: "",
      actress: PRIVATE_DEFAULT_ACTRESS
    });
  });

  it("does not overwrite fields the user already touched", () => {
    const draft = {
      ...emptyPrivateSimpleAddDraft("2026-07-26"),
      maker: "S1",
      actress: "測試女優",
      platform: "JAV"
    };

    expect(applyPrivateAddCodeDefaults(draft, "fc2 ppv 123", {
      maker: true,
      actress: true,
      platform: true
    })).toMatchObject({
      code: "FC2-PPV-123",
      maker: "S1",
      actress: "測試女優",
      platform: "JAV"
    });
  });

  it("converts five-star input and hidden record date through the shared row model", () => {
    const input = privateQuickAddToInput({
      ...emptyPrivateSimpleAddDraft("2026-07-26"),
      code: "FC2-PPV-123",
      rating: "4",
      collection: "masterpiece",
      summary: "快速筆記",
      tags: ["中出", "中出", "白虎"]
    });

    expect(input).toMatchObject({
      code: "FC2-PPV-123",
      raw_title: "FC2-PPV-123",
      rating: 8,
      platform: null,
      watched_at: "2026-07-26",
      quick_note: "快速筆記",
      tags: ["中出", "白虎"],
      people: [PRIVATE_DEFAULT_ACTRESS]
    });
  });
});
