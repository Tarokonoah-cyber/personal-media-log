export const PUBLIC_TAG_PRESETS = [
  "歷史",
  "犯罪",
  "動作",
  "動作冒險",
  "動畫",
  "奇幻",
  "冒險",
  "科幻"
] as const;

export const PRIVATE_TAG_PRESETS = [
  "人妻",
  "熟女",
  "素人",
  "巨乳",
  "苗條",
  "長腿",
  "眼鏡",
  "短髮",
  "制服",
  "絲襪",
  "泳裝",
  "角色扮演",
  "劇情",
  "主觀視角",
  "戶外",
  "單體",
  "企劃",
  "FC2"
] as const;

export type TagScope = "public" | "private";

export function tagPresetsForScope(scope: TagScope) {
  return scope === "private" ? [...PRIVATE_TAG_PRESETS] : [...PUBLIC_TAG_PRESETS];
}
