export const collectionLevels = ["unset", "masterpiece", "normal", "discard"] as const;

export type CollectionLevel = (typeof collectionLevels)[number];

export const collectionLevelLabels: Record<CollectionLevel, string> = {
  unset: "未分類",
  masterpiece: "神作",
  normal: "一般",
  discard: "淘汰"
};

export function isCollectionLevel(value: unknown): value is CollectionLevel {
  return typeof value === "string" && collectionLevels.includes(value as CollectionLevel);
}

export function normalizeCollectionLevel(value: unknown): CollectionLevel {
  if (isCollectionLevel(value)) return value;
  if (value === true || value === 1) return "normal";
  if (value === false || value === null || value === undefined || value === 0) return "unset";
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["神作", "masterpiece", "best"].includes(text)) return "masterpiece";
  if (["收藏", "一般", "normal", "favorite", "favourite", "true", "1"].includes(text)) return "normal";
  if (["雷片", "已刪", "刪除", "淘汰", "discard", "deleted", "trash"].includes(text)) return "discard";
  return "unset";
}

export function normalizeWorkCode(value: unknown): string {
  if (typeof value !== "string") return "";
  let text = value
    .replace(/\u3000/g, " ")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFF0D]/g, "-")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-");

  const fc2 = text.replace(/[\s-]/g, "").match(/^FC2PPV(\d+)$/);
  if (fc2) return `FC2-PPV-${fc2[1]}`;

  const known = text.match(/^([A-Z][A-Z0-9]{1,11})[\s-]+(\d{2,10})$/);
  if (known) return `${known[1]}-${known[2]}`;

  text = text.replace(/\s*-\s*/g, "-");
  return text;
}

export function workCodesEqual(left: unknown, right: unknown) {
  const a = normalizeWorkCode(left);
  const b = normalizeWorkCode(right);
  return Boolean(a && b && a === b);
}

export function findWorkCodeConflict<T extends { id: string; code?: unknown }>(value: unknown, items: T[], currentId?: string) {
  const normalized = normalizeWorkCode(value);
  if (!normalized) return undefined;
  return items.find((item) => item.id !== currentId && normalizeWorkCode(item.code) === normalized);
}
