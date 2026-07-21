import { privateCollectionLevel, privateCollectionLevelLabels, privateCollectionLevels, privateRatingFromStars, privateStarsFromRating, type PrivateCollectionLevel } from "../../shared/privateModel";
import type { ItemInput, MediaItem } from "../types";
import {
  privateCellPatch,
  privateCellValue,
  privateIdentityLabel,
  privateIdentityPatch,
  type PrivateEditableColumn,
} from "./privateSpreadsheet";
import type { PrivateColumnId } from "./privateTablePreferences";

export type PrivateCellPosition = {
  itemId: string;
  column: PrivateColumnId;
};

export type PrivateCellMovement = "left" | "right" | "up" | "down" | "tabForward" | "tabBackward";

export type PrivateClipboardUpdate =
  | { kind: "patch"; patch: Partial<ItemInput> }
  | { kind: "quick"; field: "rating" | "collection_level"; value: number | PrivateCollectionLevel | null };

export function privateCellKey(position: PrivateCellPosition) {
  return `${position.itemId}:${position.column}`;
}

export function movePrivateCell(
  position: PrivateCellPosition,
  itemIds: readonly string[],
  columns: readonly PrivateColumnId[],
  movement: PrivateCellMovement,
): PrivateCellPosition | null {
  if (itemIds.length === 0 || columns.length === 0) return null;
  let rowIndex = itemIds.indexOf(position.itemId);
  let columnIndex = columns.indexOf(position.column);
  if (rowIndex < 0 || columnIndex < 0) return { itemId: itemIds[0], column: columns[0] };

  if (movement === "up") rowIndex = Math.max(0, rowIndex - 1);
  if (movement === "down") rowIndex = Math.min(itemIds.length - 1, rowIndex + 1);
  if (movement === "left") columnIndex = Math.max(0, columnIndex - 1);
  if (movement === "right") columnIndex = Math.min(columns.length - 1, columnIndex + 1);
  if (movement === "tabForward") {
    if (columnIndex < columns.length - 1) columnIndex += 1;
    else if (rowIndex < itemIds.length - 1) {
      rowIndex += 1;
      columnIndex = 0;
    }
  }
  if (movement === "tabBackward") {
    if (columnIndex > 0) columnIndex -= 1;
    else if (rowIndex > 0) {
      rowIndex -= 1;
      columnIndex = columns.length - 1;
    }
  }

  return { itemId: itemIds[rowIndex], column: columns[columnIndex] };
}

export function privateClipboardValue(item: MediaItem, column: PrivateColumnId) {
  if (column === "identity") return privateIdentityLabel(item);
  if (column === "rating") return item.rating === null || item.rating === undefined ? "" : String(privateStarsFromRating(item.rating));
  if (column === "favorite") return privateCollectionLevelLabels[privateCollectionLevel(item)];
  return privateCellValue(item, column as PrivateEditableColumn);
}

export function privateClipboardUpdate(item: MediaItem, column: PrivateColumnId, rawValue: string): PrivateClipboardUpdate {
  const value = rawValue.replace(/\r\n/g, "\n").trim();
  if (column === "identity") {
    const [code, title] = parseIdentityClipboard(value);
    return { kind: "patch", patch: privateIdentityPatch({ code, title }) };
  }
  if (column === "rating") {
    if (!value) return { kind: "quick", field: "rating", value: null };
    const stars = Number(value.replace(/\s*星$/u, ""));
    const rating = privateRatingFromStars(stars);
    if (rating === null) throw new Error("評分必須是 1–5 星");
    return { kind: "quick", field: "rating", value: rating };
  }
  if (column === "favorite") {
    return { kind: "quick", field: "collection_level", value: parseCollectionLevel(value) };
  }
  if ((column === "releaseDate" || column === "watchedAt") && value && !isValidIsoDate(value)) {
    throw new Error(`${column === "releaseDate" ? "發行日期" : "紀錄日"}格式必須是 YYYY-MM-DD`);
  }
  return { kind: "patch", patch: privateCellPatch(item, column as PrivateEditableColumn, value) };
}

function parseIdentityClipboard(value: string): [string, string] {
  if (value.includes("\t")) {
    const [code, ...titleParts] = value.split("\t");
    return [code.trim(), titleParts.join(" ").trim()];
  }
  const separatorIndex = value.indexOf(" — ");
  if (separatorIndex < 0) return [value, ""];
  return [value.slice(0, separatorIndex).trim(), value.slice(separatorIndex + 3).trim()];
}

function parseCollectionLevel(value: string): PrivateCollectionLevel {
  const normalizedKey = value.toLocaleLowerCase();
  const key = privateCollectionLevels.find((level) => level === normalizedKey);
  if (key) return key;
  const label = privateCollectionLevels.find((level) => privateCollectionLevelLabels[level] === value);
  if (label) return label;
  throw new Error("收藏必須是未分類、一般、神作、已使用或淘汰");
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
