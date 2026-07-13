import type { MediaStatus } from "../types";

export const privateStatusOptions = ["pending", "done", "rewatch", "excluded"] as const;

export type PrivateUiStatus = (typeof privateStatusOptions)[number];

export const privateStatusLabels: Record<PrivateUiStatus, string> = {
  pending: "待處理",
  done: "完成",
  rewatch: "想重看",
  excluded: "排除"
};

export function privateStatusToFields(status: PrivateUiStatus): { used: boolean; media_status: MediaStatus } {
  if (status === "pending") return { used: false, media_status: "待觀看" };
  if (status === "rewatch") return { used: true, media_status: "想重看" };
  if (status === "excluded") return { used: true, media_status: "已刪除" };
  return { used: true, media_status: "已觀看" };
}

export function fieldsToPrivateStatus(value: { used?: boolean | null; media_status?: string | null }): PrivateUiStatus {
  if (value.media_status === "想重看") return "rewatch";
  if (value.media_status === "已刪除") return "excluded";
  if (value.used === false || value.media_status === "待觀看") return "pending";
  return "done";
}
