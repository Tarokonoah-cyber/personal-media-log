import type { ListFilters } from "../types";
import type { PrivateColumnId } from "./privateTablePreferences";

export type PrivateSortField = Exclude<ListFilters["sort"], "" | undefined>;

export function privateSortFieldForColumn(column: PrivateColumnId): PrivateSortField | null {
  if (column === "identity") return "displayName";
  if (column === "rating") return "rating";
  if (column === "releaseDate") return "releaseDate";
  return null;
}

export function nextPrivateSort(filters: ListFilters, column: PrivateColumnId): Partial<ListFilters> {
  const field = privateSortFieldForColumn(column);
  if (!field) return {};
  const firstOrder: NonNullable<ListFilters["order"]> = field === "displayName" ? "asc" : "desc";
  if (filters.sort !== field) return { sort: field, order: firstOrder, page: 1 };
  if (filters.order === firstOrder) return { sort: field, order: firstOrder === "asc" ? "desc" : "asc", page: 1 };
  return { sort: "", order: "", page: 1 };
}
