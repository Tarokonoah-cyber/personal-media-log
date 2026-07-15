import { describe, expect, it } from "vitest";
import { fieldsToPrivateStatus, privateStatusToFields } from "../src/lib/privateStatus";

describe("private UI status mapping", () => {
  it.each([
    ["pending", { used: false, media_status: "待觀看" }],
    ["done", { used: true, media_status: "已觀看" }],
    ["rewatch", { used: true, media_status: "想重看" }],
    ["excluded", { used: true, media_status: "已刪除" }]
  ] as const)("maps %s to persisted fields", (status, fields) => {
    expect(privateStatusToFields(status)).toEqual(fields);
  });

  it.each([
    [{ used: false, media_status: "待觀看" }, "pending"],
    [{ used: true, media_status: "已觀看" }, "done"],
    [{ used: true, media_status: "想重看" }, "rewatch"],
    [{ used: true, media_status: "已刪除" }, "excluded"]
  ] as const)("maps persisted fields back to %s", (fields, status) => {
    expect(fieldsToPrivateStatus(fields)).toBe(status);
  });

  it.each([
    [{ used: false, media_status: "想重看" }, "rewatch"],
    [{ used: false, media_status: "已刪除" }, "excluded"],
    [{ used: true, media_status: "待觀看" }, "pending"],
    [{ used: false, media_status: "已觀看" }, "pending"],
    [{ used: true, media_status: null }, "done"]
  ] as const)("classifies legacy inconsistent fields with status precedence", (fields, status) => {
    expect(fieldsToPrivateStatus(fields)).toBe(status);
  });
});
