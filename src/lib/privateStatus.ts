import { fieldsToPrivateStatus } from "../../shared/privateStatus";
import type { ListFilters } from "../types";

export { fieldsToPrivateStatus, isPrivateStatus, privateStatusLabels, privateStatusOptions, privateStatusToFields } from "../../shared/privateStatus";
export type { PrivateMediaStatus, PrivateStatusFilter, PrivateUiStatus } from "../../shared/privateStatus";

export function privateStatusFilterValue(filters: Pick<ListFilters, "privateStatus" | "usedFilter" | "mediaStatus">) {
  if (filters.privateStatus && filters.privateStatus !== "all") return filters.privateStatus;
  if (filters.mediaStatus && filters.mediaStatus !== "all") {
    return fieldsToPrivateStatus({ used: filters.usedFilter !== "unused", media_status: filters.mediaStatus });
  }
  if (filters.usedFilter === "unused") return "pending";
  if (filters.usedFilter === "used") return "done";
  return "all";
}
