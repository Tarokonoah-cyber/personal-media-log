import type { ListFilters } from "../types";
import type { PrivateColumnId } from "./privateTablePreferences";

export type PrivateSortField = Exclude<ListFilters["sort"], "" | undefined>;

export const privateSortOptions: Array<{ value: PrivateSortField; label: string }> = [
  { value: "code", label: "作品代號" },
  { value: "title", label: "標題" },
  { value: "rating", label: "評分" },
  { value: "people", label: "人物" },
  { value: "source", label: "來源" },
  { value: "favorite", label: "收藏" },
  { value: "used", label: "已使用" },
  { value: "updated", label: "更新時間" },
  { value: "releaseDate", label: "發行日期" }
];

export function privateSortFieldForColumn(column: PrivateColumnId): PrivateSortField | null {
  if (column === "identity") return "code";
  if (column === "rating") return "rating";
  if (column === "actress") return "people";
  if (column === "source") return "source";
  if (column === "favorite") return "favorite";
  if (column === "used") return "used";
  if (column === "updated") return "updated";
  if (column === "releaseDate") return "releaseDate";
  return null;
}

export function privateSortFirstOrder(field: PrivateSortField): NonNullable<ListFilters["order"]> {
  return field === "code" || field === "title" || field === "people" || field === "source" || field === "displayName" ? "asc" : "desc";
}

export function nextPrivateSortField(filters: ListFilters, field: PrivateSortField): Partial<ListFilters> {
  const firstOrder = privateSortFirstOrder(field);
  if (filters.sort !== field) return { sort: field, order: firstOrder, page: 1 };
  if (filters.order === firstOrder) return { sort: field, order: firstOrder === "asc" ? "desc" : "asc", page: 1 };
  return { sort: "", order: "", page: 1 };
}

export function nextPrivateSort(filters: ListFilters, column: PrivateColumnId): Partial<ListFilters> {
  const field = privateSortFieldForColumn(column);
  if (!field) return {};
  return nextPrivateSortField(filters, field);
}
