import { describe, expect, it } from "vitest";
import { isPrivateIssueType, privateIssueTypes } from "../functions/_lib/privateQuality";

describe("private data quality API contract", () => {
  it("uses an explicit issue-type allowlist", () => {
    expect(privateIssueTypes).toHaveLength(17);
    expect(isPrivateIssueType("duplicate_code")).toBe(true);
    expect(isPrivateIssueType("duplicate_metadata")).toBe(true);
    expect(isPrivateIssueType("incomplete_metadata")).toBe(true);
    expect(isPrivateIssueType("suspicious_title")).toBe(true);
    expect(isPrivateIssueType("normalization_needed")).toBe(true);
    expect(isPrivateIssueType("DROP TABLE items")).toBe(false);
  });
});
