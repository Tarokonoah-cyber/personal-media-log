export type CompletenessReasonCode =
  | "missing_code"
  | "missing_title"
  | "suspicious_title"
  | "missing_platform"
  | "unknown_platform"
  | "missing_maker"
  | "missing_people"
  | "missing_tags"
  | "too_few_tags"
  | "missing_collection"
  | "missing_cover"
  | "missing_rating"
  | "missing_note"
  | "missing_release_date"
  | "metadata_conflict";

export interface CompletenessReason {
  code: CompletenessReasonCode;
  label: string;
  field: string;
  weight: number;
  severity: "high" | "medium" | "low";
}

export interface CompletenessItem {
  code?: string | null;
  normalized_code?: string | null;
  raw_title?: string | null;
  official_title?: string | null;
  platform?: string | null;
  maker?: string | null;
  release_date?: string | null;
  rating?: number | null;
  quick_note?: string | null;
  long_note?: string | null;
  cover_url?: string | null;
  collection_level?: string | null;
  tags?: string[];
  people?: string[];
  tag_count?: number;
  people_count?: number;
}

export interface CompletenessResult {
  score: number;
  earnedWeight: number;
  expectedWeight: number;
  profile: "fc2" | "jav" | "private";
  reasons: CompletenessReason[];
}

type ExpectedField = {
  field: string;
  weight: number;
  present: boolean;
  missing: CompletenessReason;
};

export function evaluateCompleteness(item: CompletenessItem): CompletenessResult {
  const platform = clean(item.platform).toLocaleLowerCase();
  const code = clean(item.code || item.normalized_code);
  const title = clean(item.official_title || item.raw_title);
  const tags = item.tags || [];
  const people = item.people || [];
  const tagCount = Number.isFinite(item.tag_count) ? Number(item.tag_count) : tags.length;
  const peopleCount = Number.isFinite(item.people_count) ? Number(item.people_count) : people.length;
  const profile = platform === "fc2" || /^fc2(?:-?ppv)?/i.test(code)
    ? "fc2"
    : platform === "jav" || /^[a-z]{2,8}-?\d{2,7}$/i.test(code)
      ? "jav"
      : "private";
  const fields: ExpectedField[] = [
    expected("code", 2, Boolean(code), "missing_code", "缺少作品代號", "high"),
    expected("title", 2, Boolean(title), "missing_title", "缺少標題", "high"),
    expected("platform", 1, Boolean(platform), "missing_platform", "缺少平台", "medium"),
    expected("people", 1.5, peopleCount > 0, "missing_people", "缺少人物", "medium"),
    expected("tags", 1.5, tagCount > 0, "missing_tags", "缺少標籤", "medium"),
    expected("collection_level", 0.75, Boolean(item.collection_level && item.collection_level !== "unset"), "missing_collection", "收藏尚未分類", "low"),
    expected("cover_url", 0.5, Boolean(clean(item.cover_url)), "missing_cover", "缺少封面", "low"),
    expected("rating", 0.75, item.rating !== null && item.rating !== undefined, "missing_rating", "尚未評分", "low"),
    expected("note", 0.5, Boolean(clean(item.quick_note || item.long_note)), "missing_note", "缺少心得或筆記", "low")
  ];

  if (profile === "jav") {
    fields.push(expected("maker", 1.25, Boolean(clean(item.maker)), "missing_maker", "缺少片商", "medium"));
    fields.push(expected("release_date", 1, Boolean(clean(item.release_date)), "missing_release_date", "缺少發行日期", "medium"));
  } else if (profile === "private") {
    fields.push(expected("maker", 0.5, Boolean(clean(item.maker)), "missing_maker", "缺少片商", "low"));
    fields.push(expected("release_date", 0.5, Boolean(clean(item.release_date)), "missing_release_date", "缺少發行日期", "low"));
  } else {
    fields.push(expected("release_date", 0.5, Boolean(clean(item.release_date)), "missing_release_date", "缺少發行日期", "low"));
  }

  const expectedWeight = fields.reduce((sum, field) => sum + field.weight, 0);
  let earnedWeight = fields.reduce((sum, field) => sum + (field.present ? field.weight : 0), 0);
  const reasons = fields.filter((field) => !field.present).map((field) => field.missing);

  if (tagCount === 1) {
    reasons.push(reason("too_few_tags", "標籤過少", "tags", 0.35, "low"));
    earnedWeight = Math.max(0, earnedWeight - 0.35);
  }
  if (title && isSuspiciousTitle(title, code)) {
    reasons.push(reason("suspicious_title", "標題疑似 placeholder 或僅有作品代號", "official_title", 0.75, "medium"));
    earnedWeight = Math.max(0, earnedWeight - 0.75);
  }
  if (platform && hasPlatformConflict(platform, code)) {
    reasons.push(reason("metadata_conflict", "平台與作品代號格式疑似衝突", "platform", 1, "high"));
    earnedWeight = Math.max(0, earnedWeight - 1);
  }
  if (platform && !["fc2", "jav", "糖心"].includes(platform)) {
    reasons.push(reason("unknown_platform", "平台尚未正規化", "platform", 0.25, "low"));
    earnedWeight = Math.max(0, earnedWeight - 0.25);
  }

  return {
    score: Math.max(0, Math.min(100, Math.round((earnedWeight / expectedWeight) * 100))),
    earnedWeight: roundWeight(earnedWeight),
    expectedWeight: roundWeight(expectedWeight),
    profile,
    reasons
  };
}

export function normalizeEntityKey(value: unknown) {
  return clean(value)
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\-_–—－・･·.,，。:：;；'"「」『』()（）\[\]【】]+/gu, "")
    .trim();
}

export function normalizeComparisonCode(value: unknown) {
  const normalized = clean(value).normalize("NFKC").toUpperCase().replace(/[\s_–—－]+/g, "-");
  const compact = normalized.replace(/-+/g, "-").replace(/^-|-$/g, "");
  const fc2 = compact.match(/^FC2(?:-?PPV)?-?(\d{5,9})$/);
  if (fc2) return `FC2-PPV-${fc2[1]}`;
  const jav = compact.match(/^([A-Z]{2,10})-?(\d{2,7})$/);
  return jav ? `${jav[1]}-${jav[2]}` : compact || null;
}

export function isSuspiciousTitle(title: string, code = "") {
  const normalizedTitle = normalizeEntityKey(title);
  const normalizedCode = normalizeEntityKey(code);
  if (!normalizedTitle) return true;
  if (normalizedCode && normalizedTitle === normalizedCode) return true;
  return /^(unknown|untitled|test|temp|todo|tbd|待補|待整理|未命名|無標題|[-—_]+)$/iu.test(title.trim());
}

function expected(
  field: string,
  weight: number,
  present: boolean,
  code: CompletenessReasonCode,
  label: string,
  severity: CompletenessReason["severity"]
): ExpectedField {
  return { field, weight, present, missing: reason(code, label, field, weight, severity) };
}

function reason(
  code: CompletenessReasonCode,
  label: string,
  field: string,
  weight: number,
  severity: CompletenessReason["severity"]
): CompletenessReason {
  return { code, label, field, weight, severity };
}

function hasPlatformConflict(platform: string, code: string) {
  const normalizedCode = normalizeComparisonCode(code) || "";
  if (!normalizedCode) return false;
  if (normalizedCode.startsWith("FC2-PPV-")) return platform !== "fc2";
  if (/^[A-Z]{2,10}-\d{2,7}$/.test(normalizedCode)) return platform === "fc2";
  return false;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
}

function roundWeight(value: number) {
  return Math.round(value * 100) / 100;
}

