export type PrivateColumnId = "identity" | "rating" | "favorite" | "used" | "actress" | "source" | "maker" | "tags" | "releaseDate" | "updated" | "summary";
export type PrivateTableMode = "all" | "fc2" | "jav";

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

export type PrivateTablePreferenceProfiles = Record<PrivateTableMode, PrivateTablePreferences>;

type PrivateTablePreferencesInput = {
  order?: string[];
  widths?: Record<string, number>;
  visible?: Record<string, boolean>;
  pageSize?: number;
};

type PrivateTablePreferenceProfilesInput = {
  profiles?: Partial<Record<PrivateTableMode, PrivateTablePreferencesInput>>;
};

export const PRIVATE_TABLE_PREFERENCES_KEY = "private-library-table-preferences-v7";
export const LEGACY_V6_PRIVATE_TABLE_PREFERENCES_KEY = "private-library-table-preferences-v6";
export const LEGACY_V5_PRIVATE_TABLE_PREFERENCES_KEY = "private-library-table-preferences-v5";
export const LEGACY_V4_PRIVATE_TABLE_PREFERENCES_KEY = "private-library-table-preferences-v4";
export const LEGACY_V3_PRIVATE_TABLE_PREFERENCES_KEY = "private-library-table-preferences-v3";
export const LEGACY_PRIVATE_TABLE_PREFERENCES_KEY = "private-library-table-preferences-v2";

export const privateColumnDefinitions: PrivateColumnDefinition[] = [
  { id: "identity", label: "作品代號 / 標題", width: 520, minWidth: 320, maxWidth: 900, required: true },
  { id: "rating", label: "評分", width: 112, minWidth: 106, maxWidth: 138 },
  { id: "favorite", label: "收藏", width: 96, minWidth: 84, maxWidth: 138 },
  { id: "used", label: "已使用", width: 82, minWidth: 76, maxWidth: 108 },
  { id: "actress", label: "人物", width: 176, minWidth: 110, maxWidth: 360 },
  { id: "source", label: "來源", width: 96, minWidth: 82, maxWidth: 220 },
  { id: "maker", label: "片商", width: 108, minWidth: 88, maxWidth: 300 },
  { id: "tags", label: "標籤", width: 168, minWidth: 128, maxWidth: 420 },
  { id: "releaseDate", label: "發行日期", width: 112, minWidth: 104, maxWidth: 150 },
  { id: "updated", label: "更新時間", width: 142, minWidth: 122, maxWidth: 210 },
  { id: "summary", label: "快速筆記", width: 280, minWidth: 160, maxWidth: 520 }
];

export const privateColumnMap = Object.fromEntries(privateColumnDefinitions.map((column) => [column.id, column])) as Record<PrivateColumnId, PrivateColumnDefinition>;

const privateColumnIds = privateColumnDefinitions.map((column) => column.id);
const privateModeOrder: Record<PrivateTableMode, PrivateColumnId[]> = {
  all: ["identity", "rating", "favorite", "used", "actress", "source", "tags", "updated", "releaseDate", "maker", "summary"],
  fc2: ["identity", "rating", "favorite", "used", "actress", "source", "tags", "updated", "releaseDate", "maker", "summary"],
  jav: ["identity", "rating", "favorite", "used", "actress", "source", "maker", "updated", "releaseDate", "tags", "summary"]
};
const privateModeVisible: Record<PrivateTableMode, PrivateColumnId[]> = {
  all: ["identity", "rating", "favorite", "used", "actress", "source", "tags", "updated", "releaseDate"],
  fc2: ["identity", "rating", "favorite", "used", "actress", "source", "tags", "updated", "releaseDate"],
  jav: ["identity", "rating", "favorite", "used", "actress", "source", "maker", "updated", "releaseDate", "tags"]
};
const legacySeparatedDefaults = {
  v3: { code: 168, title: 260 },
  v2: { code: 172, title: 300 }
};

export function privateTableModeFromPlatformFilters(value?: string | null): PrivateTableMode {
  const platforms = String(value || "")
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean);
  if (platforms.length !== 1) return "all";
  if (platforms[0] === "FC2") return "fc2";
  if (platforms[0] === "JAV") return "jav";
  return "all";
}

export function privateColumnLabel(id: PrivateColumnId, mode: PrivateTableMode) {
  if (id === "identity" && mode === "fc2") return "FC2 番號";
  if (id === "identity" && mode === "all") return "作品";
  return privateColumnMap[id].label;
}

export function defaultPrivateTablePreferences(mode: PrivateTableMode = "all"): PrivateTablePreferences {
  const visibleColumns = new Set(privateModeVisible[mode]);
  return {
    order: [...privateModeOrder[mode]],
    widths: Object.fromEntries(privateColumnDefinitions.map((column) => [
      column.id,
      column.id === "identity" && mode === "fc2" ? 360 : column.width
    ])) as Record<PrivateColumnId, number>,
    visible: Object.fromEntries(privateColumnDefinitions.map((column) => [column.id, visibleColumns.has(column.id)])) as Record<PrivateColumnId, boolean>,
    pageSize: 100
  };
}

export function defaultPrivateTablePreferenceProfiles(): PrivateTablePreferenceProfiles {
  return {
    all: defaultPrivateTablePreferences("all"),
    fc2: defaultPrivateTablePreferences("fc2"),
    jav: defaultPrivateTablePreferences("jav")
  };
}

export function normalizePrivateTablePreferences(
  value?: PrivateTablePreferencesInput | Partial<PrivateTablePreferences> | null,
  mode: PrivateTableMode = "all"
): PrivateTablePreferences {
  const defaults = defaultPrivateTablePreferences(mode);
  const requestedOrder = value?.order || [];
  const migratedOrder = requestedOrder
    .map((id) => id === "code" || id === "title" ? "identity" : id === "watchedAt" ? "releaseDate" : id)
    .filter((id) => id !== "platform");
  if (requestedOrder.length > 0 && !migratedOrder.includes("releaseDate")) {
    const summaryIndex = migratedOrder.indexOf("summary");
    migratedOrder.splice(summaryIndex >= 0 ? summaryIndex : migratedOrder.length, 0, "releaseDate");
  }
  const order = [
    "identity" as const,
    ...migratedOrder.filter((id, index): id is PrivateColumnId => id !== "identity" && privateColumnIds.includes(id as PrivateColumnId) && migratedOrder.indexOf(id) === index),
    ...privateModeOrder[mode].filter((id) => id !== "identity" && !migratedOrder.includes(id))
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

export function normalizePrivateTablePreferenceProfiles(value?: PrivateTablePreferenceProfilesInput | null): PrivateTablePreferenceProfiles {
  return {
    all: normalizePrivateTablePreferences(value?.profiles?.all, "all"),
    fc2: normalizePrivateTablePreferences(value?.profiles?.fc2, "fc2"),
    jav: normalizePrivateTablePreferences(value?.profiles?.jav, "jav")
  };
}

export function migratePrivateTablePreferencesV3(value?: PrivateTablePreferencesInput | null) {
  return normalizePrivateTablePreferences(value);
}

export function migratePrivateTablePreferencesV4(value?: PrivateTablePreferencesInput | null) {
  return normalizePrivateTablePreferences(value);
}

export function migratePrivateTablePreferencesV2(value?: PrivateTablePreferencesInput | null) {
  return normalizePrivateTablePreferences(value);
}

export function readPrivateTablePreferenceProfiles(storage: Pick<Storage, "getItem" | "setItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage) {
  if (!storage) return defaultPrivateTablePreferenceProfiles();
  try {
    const current = storage.getItem(PRIVATE_TABLE_PREFERENCES_KEY);
    if (current) return normalizePrivateTablePreferenceProfiles(JSON.parse(current));
    const legacyV6 = storage.getItem(LEGACY_V6_PRIVATE_TABLE_PREFERENCES_KEY);
    if (legacyV6) {
      const profiles = normalizePrivateTablePreferenceProfiles(JSON.parse(legacyV6));
      for (const mode of ["all", "fc2", "jav"] as const) {
        profiles[mode] = normalizePrivateTablePreferences({
          ...profiles[mode],
          visible: {
            ...profiles[mode].visible,
            actress: true,
            source: true,
            used: true,
            updated: true
          }
        }, mode);
      }
      storage.setItem(PRIVATE_TABLE_PREFERENCES_KEY, JSON.stringify({ profiles }));
      return profiles;
    }
    const legacyV5 = storage.getItem(LEGACY_V5_PRIVATE_TABLE_PREFERENCES_KEY);
    const legacyV4 = storage.getItem(LEGACY_V4_PRIVATE_TABLE_PREFERENCES_KEY);
    const legacyV3 = storage.getItem(LEGACY_V3_PRIVATE_TABLE_PREFERENCES_KEY);
    const legacyV2 = storage.getItem(LEGACY_PRIVATE_TABLE_PREFERENCES_KEY);
    const migrated = legacyV5
      ? normalizePrivateTablePreferences(JSON.parse(legacyV5))
      : legacyV4
        ? migratePrivateTablePreferencesV4(JSON.parse(legacyV4))
        : legacyV3
          ? migratePrivateTablePreferencesV3(JSON.parse(legacyV3))
          : legacyV2
            ? migratePrivateTablePreferencesV2(JSON.parse(legacyV2))
            : null;
    if (!migrated) return defaultPrivateTablePreferenceProfiles();
    const profiles = profilesFromLegacyPreference(migrated);
    storage.setItem(PRIVATE_TABLE_PREFERENCES_KEY, JSON.stringify({ profiles }));
    return profiles;
  } catch {
    return defaultPrivateTablePreferenceProfiles();
  }
}

export function readPrivateTablePreferences(storage: Pick<Storage, "getItem" | "setItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage) {
  return readPrivateTablePreferenceProfiles(storage).all;
}

export function savePrivateTablePreferenceProfiles(
  profiles: PrivateTablePreferenceProfiles,
  storage: Pick<Storage, "setItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage
) {
  if (!storage) return;
  try {
    storage.setItem(PRIVATE_TABLE_PREFERENCES_KEY, JSON.stringify({
      profiles: {
        all: normalizePrivateTablePreferences(profiles.all, "all"),
        fc2: normalizePrivateTablePreferences(profiles.fc2, "fc2"),
        jav: normalizePrivateTablePreferences(profiles.jav, "jav")
      }
    }));
  } catch {
    // Preferences are non-authoritative; keep the in-memory table usable.
  }
}

export function savePrivateTablePreferences(preferences: PrivateTablePreferences, storage: Pick<Storage, "setItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage) {
  savePrivateTablePreferenceProfiles({
    ...defaultPrivateTablePreferenceProfiles(),
    all: normalizePrivateTablePreferences(preferences, "all")
  }, storage);
}

function profilesFromLegacyPreference(preferences: PrivateTablePreferences): PrivateTablePreferenceProfiles {
  const sharedWidths = preferences.widths;
  const pageSize = preferences.pageSize;
  return {
    all: normalizePrivateTablePreferences({
      ...preferences,
      visible: { ...preferences.visible, actress: false, maker: false }
    }, "all"),
    fc2: normalizePrivateTablePreferences({
      ...defaultPrivateTablePreferences("fc2"),
      widths: { ...defaultPrivateTablePreferences("fc2").widths, ...sharedWidths, identity: 360 },
      pageSize
    }, "fc2"),
    jav: normalizePrivateTablePreferences({
      ...defaultPrivateTablePreferences("jav"),
      widths: { ...defaultPrivateTablePreferences("jav").widths, ...sharedWidths },
      pageSize
    }, "jav")
  };
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
