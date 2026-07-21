export type PrivateColumnId = "identity" | "rating" | "favorite" | "actress" | "maker" | "tags" | "watchedAt" | "summary";

export type PrivateColumnDefinition = {
  id: PrivateColumnId;
  label: string;
  width: number;
  minWidth: number;
  maxWidth: number;
  required?: boolean;
  defaultHidden?: boolean;
};

export type PrivateTablePreferences = {
  order: PrivateColumnId[];
  widths: Record<PrivateColumnId, number>;
  visible: Record<PrivateColumnId, boolean>;
  pageSize: number;
};

type PrivateTablePreferencesInput = {
  order?: string[];
  widths?: Record<string, number>;
  visible?: Record<string, boolean>;
  pageSize?: number;
};

export const PRIVATE_TABLE_PREFERENCES_KEY = "private-library-table-preferences-v4";
export const LEGACY_V3_PRIVATE_TABLE_PREFERENCES_KEY = "private-library-table-preferences-v3";
export const LEGACY_PRIVATE_TABLE_PREFERENCES_KEY = "private-library-table-preferences-v2";

export const privateColumnDefinitions: PrivateColumnDefinition[] = [
  { id: "identity", label: "作品代號 / 標題", width: 520, minWidth: 320, maxWidth: 900, required: true },
  { id: "rating", label: "評分", width: 68, minWidth: 62, maxWidth: 100 },
  { id: "favorite", label: "收藏", width: 88, minWidth: 76, maxWidth: 130 },
  { id: "actress", label: "女優", width: 176, minWidth: 110, maxWidth: 360 },
  { id: "maker", label: "片商", width: 108, minWidth: 88, maxWidth: 300 },
  { id: "tags", label: "標籤", width: 168, minWidth: 128, maxWidth: 420 },
  { id: "watchedAt", label: "紀錄日", width: 112, minWidth: 104, maxWidth: 150 },
  { id: "summary", label: "快速筆記", width: 280, minWidth: 160, maxWidth: 520 }
];

export const privateColumnMap = Object.fromEntries(privateColumnDefinitions.map((column) => [column.id, column])) as Record<PrivateColumnId, PrivateColumnDefinition>;

const privateColumnIds = privateColumnDefinitions.map((column) => column.id);
const legacySeparatedDefaults = {
  v3: { code: 168, title: 260 },
  v2: { code: 172, title: 300 }
};

export function defaultPrivateTablePreferences(): PrivateTablePreferences {
  return {
    order: [...privateColumnIds],
    widths: Object.fromEntries(privateColumnDefinitions.map((column) => [column.id, column.width])) as Record<PrivateColumnId, number>,
    visible: Object.fromEntries(privateColumnDefinitions.map((column) => [column.id, !column.defaultHidden])) as Record<PrivateColumnId, boolean>,
    pageSize: 100
  };
}

export function normalizePrivateTablePreferences(value?: PrivateTablePreferencesInput | Partial<PrivateTablePreferences> | null): PrivateTablePreferences {
  const defaults = defaultPrivateTablePreferences();
  const requestedOrder = value?.order || [];
  const migratedOrder = requestedOrder.map((id) => id === "code" || id === "title" ? "identity" : id).filter((id) => id !== "platform");
  const order = [
    "identity" as const,
    ...migratedOrder.filter((id, index): id is PrivateColumnId => id !== "identity" && privateColumnIds.includes(id as PrivateColumnId) && migratedOrder.indexOf(id) === index),
    ...privateColumnIds.filter((id) => id !== "identity" && !migratedOrder.includes(id))
  ];
  const widths = { ...defaults.widths };
  const visible = { ...defaults.visible };
  const sourceWidths = value?.widths || {};
  const sourceVisible = value?.visible || {};

  for (const column of privateColumnDefinitions) {
    if (column.id !== "identity" && sourceWidths[column.id] != null) widths[column.id] = Number(sourceWidths[column.id]);
    if (column.id !== "identity" && sourceVisible[column.id] != null) visible[column.id] = Boolean(sourceVisible[column.id]);
  }

  widths.identity = legacyIdentityWidth(sourceWidths);
  visible.identity = true;
  for (const column of privateColumnDefinitions) {
    widths[column.id] = Math.min(column.maxWidth, Math.max(column.minWidth, Number(widths[column.id]) || column.width));
    if (column.required) visible[column.id] = true;
  }

  return {
    order,
    widths,
    visible,
    pageSize: [50, 100, 200].includes(Number(value?.pageSize)) ? Number(value?.pageSize) : defaults.pageSize
  };
}

export function migratePrivateTablePreferencesV3(value?: PrivateTablePreferencesInput | null) {
  return normalizePrivateTablePreferences(value);
}

export function migratePrivateTablePreferencesV2(value?: PrivateTablePreferencesInput | null) {
  return normalizePrivateTablePreferences(value);
}

export function readPrivateTablePreferences(storage: Pick<Storage, "getItem" | "setItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage) {
  if (!storage) return defaultPrivateTablePreferences();
  try {
    const current = storage.getItem(PRIVATE_TABLE_PREFERENCES_KEY);
    if (current) return normalizePrivateTablePreferences(JSON.parse(current));
    const legacyV3 = storage.getItem(LEGACY_V3_PRIVATE_TABLE_PREFERENCES_KEY);
    const legacyV2 = storage.getItem(LEGACY_PRIVATE_TABLE_PREFERENCES_KEY);
    const migrated = legacyV3
      ? migratePrivateTablePreferencesV3(JSON.parse(legacyV3))
      : legacyV2
        ? migratePrivateTablePreferencesV2(JSON.parse(legacyV2))
        : null;
    if (!migrated) return defaultPrivateTablePreferences();
    storage.setItem(PRIVATE_TABLE_PREFERENCES_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return defaultPrivateTablePreferences();
  }
}

export function savePrivateTablePreferences(preferences: PrivateTablePreferences, storage: Pick<Storage, "setItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage) {
  if (!storage) return;
  storage.setItem(PRIVATE_TABLE_PREFERENCES_KEY, JSON.stringify(normalizePrivateTablePreferences(preferences)));
}

function legacyIdentityWidth(widths: Record<string, number>) {
  if (widths.identity != null) return Number(widths.identity);
  const codeWidth = widths.code;
  const titleWidth = widths.title;
  const codeCustomized = codeWidth != null && codeWidth !== legacySeparatedDefaults.v3.code && codeWidth !== legacySeparatedDefaults.v2.code;
  const titleCustomized = titleWidth != null && titleWidth !== legacySeparatedDefaults.v3.title && titleWidth !== legacySeparatedDefaults.v2.title;
  if (!codeCustomized && !titleCustomized) return 520;
  return Number(codeWidth ?? legacySeparatedDefaults.v3.code) + Number(titleWidth ?? legacySeparatedDefaults.v3.title);
}
