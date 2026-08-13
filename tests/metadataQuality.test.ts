import { describe, expect, it } from "vitest";
import { evaluateCompleteness, isSuspiciousTitle, normalizeComparisonCode, normalizeEntityKey } from "../functions/_lib/metadataQuality";
import { isMetadataSuggestionStatus } from "../functions/_lib/metadataSuggestions";

describe("metadata completeness", () => {
  it("uses platform-aware expectations and explains every deduction", () => {
    const result = evaluateCompleteness({
      code: "FC2 PPV 1234567",
      normalized_code: "FC2-PPV-1234567",
      official_title: "A useful title",
      platform: "FC2",
      maker: null,
      release_date: "2026-01-02",
      people_count: 1,
      tag_count: 2,
      collection_level: "normal",
      cover_url: "https://example.test/cover.jpg",
      rating: 8,
      quick_note: "reviewed"
    });

    expect(result.profile).toBe("fc2");
    expect(result.score).toBe(100);
    expect(result.reasons).toEqual([]);
  });

  it("returns stable reason codes instead of only a percentage", () => {
    const result = evaluateCompleteness({
      code: "SSIS-001",
      normalized_code: "SSIS-001",
      official_title: "test",
      platform: "JAV",
      maker: null,
      release_date: null,
      people_count: 0,
      tag_count: 1,
      collection_level: "unset",
      cover_url: null,
      rating: null,
      quick_note: null,
      long_note: null
    });

    expect(result.profile).toBe("jav");
    expect(result.score).toBeLessThan(50);
    expect(result.reasons.map((reason) => reason.code)).toEqual(expect.arrayContaining([
      "suspicious_title",
      "missing_maker",
      "missing_release_date",
      "missing_people",
      "too_few_tags",
      "missing_collection",
      "missing_cover",
      "missing_rating",
      "missing_note"
    ]));
  });
});

describe("normalization identities", () => {
  it.each([
    ["FC2-PPV-1234567", "FC2-PPV-1234567"],
    ["FC2 PPV 1234567", "FC2-PPV-1234567"],
    ["fc2-1234567", "FC2-PPV-1234567"],
    ["ssis 001", "SSIS-001"],
    ["ＳＳＩＳ－００１", "SSIS-001"]
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeComparisonCode(input)).toBe(expected);
  });

  it("keeps display values separate while matching unicode aliases", () => {
    expect(normalizeEntityKey(" ＡＢＣ・Studio ")).toBe(normalizeEntityKey("abc studio"));
  });

  it("recognizes placeholder titles", () => {
    expect(isSuspiciousTitle("TODO", "SSIS-001")).toBe(true);
    expect(isSuspiciousTitle("SSIS 001", "SSIS-001")).toBe(true);
    expect(isSuspiciousTitle("Real descriptive title", "SSIS-001")).toBe(false);
  });
});

describe("metadata suggestion status", () => {
  it("rejects arbitrary status input", () => {
    expect(isMetadataSuggestionStatus("pending")).toBe(true);
    expect(isMetadataSuggestionStatus("accepted")).toBe(true);
    expect(isMetadataSuggestionStatus("anything' OR 1=1 --")).toBe(false);
  });
});
