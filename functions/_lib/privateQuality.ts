import { HttpError } from "./http";
import { newId } from "./ids";
import { evaluateCompleteness } from "./metadataQuality";
import type { Actor, Env } from "./types";

export const privateIssueTypes = [
  "duplicate_code",
  "duplicate_metadata",
  "metadata_conflict",
  "normalization_needed",
  "unknown_platform",
  "missing_title",
  "suspicious_title",
  "missing_maker",
  "incomplete_metadata",
  "missing_people",
  "missing_tags",
  "too_few_tags",
  "missing_cover",
  "unrated",
  "unset_collection",
  "invalid_collection",
  "invalid_code"
] as const;
export type PrivateIssueType = (typeof privateIssueTypes)[number];

export function isPrivateIssueType(value: unknown): value is PrivateIssueType {
  return typeof value === "string" && privateIssueTypes.includes(value as PrivateIssueType);
}

const labels: Record<PrivateIssueType, string> = {
  duplicate_code: "疑似重複作品代號",
  duplicate_metadata: "疑似重複標題／Metadata",
  metadata_conflict: "Metadata 疑似衝突",
  normalization_needed: "需要正規化",
  unknown_platform: "平台待確認",
  missing_title: "缺少標題",
  suspicious_title: "疑似 placeholder 標題",
  missing_maker: "缺少片商",
  incomplete_metadata: "Metadata 不完整",
  missing_people: "缺少人物",
  missing_tags: "缺少標籤",
  too_few_tags: "標籤過少",
  missing_cover: "缺少封面",
  unrated: "尚未評分",
  unset_collection: "收藏未分類",
  invalid_collection: "無效收藏值",
  invalid_code: "無效作品代號"
};

export async function getPrivateQuality(env: Env, issueType?: PrivateIssueType, page = 1, pageSize = 50, ignored = false) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  if (!issueType) {
    const results = await env.MEDIA_LOG_DB.batch([
      ...privateIssueTypes.map((type) => env.MEDIA_LOG_DB.prepare(`
        SELECT COUNT(*) AS count
        FROM (${issueSql(type)}) q
        WHERE NOT EXISTS (
          SELECT 1 FROM private_data_quality_ignores i
          WHERE i.item_id = q.item_id AND i.issue_type = ? AND i.issue_key = q.issue_key
        )
      `).bind(type)),
      env.MEDIA_LOG_DB.prepare("SELECT COUNT(*) AS count FROM private_data_quality_ignores")
    ]);
    const counts = new Map(privateIssueTypes.map((type, index) => {
      const row = (results[index].results as Array<{ count: number }> || [])[0];
      return [type, Number(row?.count || 0)] as const;
    }));
    const ignoredResult = results[privateIssueTypes.length];
    const ignoredRow = (ignoredResult.results as Array<{ count: number }> || [])[0];
    return {
      summary: privateIssueTypes.map((type) => ({ type, label: labels[type], count: counts.get(type) || 0 })),
      ignoredCount: Number(ignoredRow?.count || 0)
    };
  }
  const base = issueSql(issueType);
  const ignoredClause = ignored ? "EXISTS" : "NOT EXISTS";
  const wrapped = `SELECT q.* FROM (${base}) q WHERE ${ignoredClause} (
    SELECT 1 FROM private_data_quality_ignores i WHERE i.item_id = q.item_id AND i.issue_type = ? AND i.issue_key = q.issue_key
  )`;
  const [countResult, issueResult] = await env.MEDIA_LOG_DB.batch([
    env.MEDIA_LOG_DB.prepare(`SELECT COUNT(*) AS count FROM (${wrapped})`).bind(issueType),
    env.MEDIA_LOG_DB.prepare(`${wrapped} ORDER BY q.code, q.item_id LIMIT ? OFFSET ?`).bind(issueType, safePageSize, (safePage - 1) * safePageSize)
  ]);
  const count = (countResult.results as Array<{ count: number }> || [])[0];
  const issues = (issueResult.results as Array<Record<string, unknown>> || []).map(decorateIssue);
  return { issueType, label: labels[issueType], page: safePage, pageSize: safePageSize, total: Number(count?.count || 0), issues };
}

export async function ignorePrivateIssue(env: Env, actor: Actor, itemId: string, issueType: PrivateIssueType, issueKey: string) {
  if (!itemId || !issueKey) throw new HttpError(400, "itemId and issueKey are required");
  const id = newId("quality_ignore");
  await env.MEDIA_LOG_DB.prepare("INSERT OR IGNORE INTO private_data_quality_ignores (id, item_id, issue_type, issue_key) VALUES (?, ?, ?, ?)")
    .bind(id, itemId, issueType, issueKey).run();
  return { id, itemId, issueType, issueKey, actor: actor.email };
}

export async function unignorePrivateIssue(env: Env, itemId: string, issueType: PrivateIssueType, issueKey: string) {
  if (!itemId || !issueKey) throw new HttpError(400, "itemId and issueKey are required");
  await env.MEDIA_LOG_DB.prepare("DELETE FROM private_data_quality_ignores WHERE item_id = ? AND issue_type = ? AND issue_key = ?")
    .bind(itemId, issueType, issueKey).run();
}

function commonWhere(extra: string) {
  return `SELECT items.id AS item_id, coalesce(items.code, '') AS code, coalesce(items.official_title, items.raw_title, '') AS title,
    items.raw_title, items.official_title, items.normalized_code, items.platform, items.maker,
    items.release_date, items.rating, items.quick_note, items.long_note, items.cover_url, items.collection_level,
    (SELECT COUNT(*) FROM item_tags quality_tags WHERE quality_tags.item_id = items.id) AS tag_count,
    (SELECT COUNT(*) FROM item_people quality_people WHERE quality_people.item_id = items.id) AS people_count,
    ${extra}
    FROM items WHERE items.is_private = 1 AND items.status != 'deleted'`;
}

function issueSql(type: PrivateIssueType) {
  switch (type) {
    case "duplicate_code": return `${commonWhere("coalesce(items.normalized_code, '') AS original_value, '請人工確認重複項目' AS suggestion, 'duplicate:' || items.normalized_code AS issue_key")}
      AND items.normalized_code IN (SELECT normalized_code FROM items WHERE is_private = 1 AND status != 'deleted' AND normalized_code IS NOT NULL GROUP BY normalized_code HAVING COUNT(*) > 1)`;
    case "duplicate_metadata": {
      const currentTitle = normalizedTitleSql("items");
      const groupedTitle = normalizedTitleSql("grouped_items");
      const currentPlatform = "lower(trim(coalesce(items.platform, '')))";
      const groupedPlatform = "lower(trim(coalesce(grouped_items.platform, '')))";
      const currentMaker = "lower(trim(coalesce(items.maker, '')))";
      const groupedMaker = "lower(trim(coalesce(grouped_items.maker, '')))";
      const currentYear = "coalesce(items.year, items.release_year)";
      const groupedYear = "coalesce(grouped_items.year, grouped_items.release_year)";
      return `${commonWhere(`${currentTitle} AS original_value, '同標題且平台／片商／年份相似；僅供人工 review' AS suggestion, 'duplicate-metadata:' || ${currentTitle} || ':' || coalesce(items.platform, '') AS issue_key`)}
        AND length(${currentTitle}) >= 4
        AND (
          (${currentTitle}, ${currentPlatform}, ${currentMaker}) IN (
            SELECT ${groupedTitle}, ${groupedPlatform}, ${groupedMaker} FROM items grouped_items
            WHERE grouped_items.is_private = 1
              AND grouped_items.status != 'deleted'
              AND length(${groupedTitle}) >= 4
              AND ${groupedMaker} != ''
            GROUP BY ${groupedTitle}, ${groupedPlatform}, ${groupedMaker}
            HAVING COUNT(*) > 1
          )
          OR (${currentTitle}, ${currentPlatform}, ${currentYear}) IN (
            SELECT ${groupedTitle}, ${groupedPlatform}, ${groupedYear} FROM items grouped_items
            WHERE grouped_items.is_private = 1
              AND grouped_items.status != 'deleted'
              AND length(${groupedTitle}) >= 4
              AND ${groupedYear} IS NOT NULL
            GROUP BY ${groupedTitle}, ${groupedPlatform}, ${groupedYear}
            HAVING COUNT(*) > 1
          )
        )`;
    }
    case "metadata_conflict": return `${commonWhere("coalesce(items.platform, '') AS original_value, '確認平台、年份與作品代號是否一致' AS suggestion, 'metadata-conflict:' || items.updated_at AS issue_key")}
      AND (
        (items.release_year IS NOT NULL AND items.year IS NOT NULL AND items.release_year != items.year)
        OR (coalesce(items.normalized_code, '') LIKE 'FC2-PPV-%' AND lower(coalesce(items.platform, '')) != 'fc2')
        OR (lower(coalesce(items.platform, '')) = 'fc2' AND coalesce(items.normalized_code, '') NOT LIKE 'FC2-PPV-%')
      )`;
    case "normalization_needed": return `${commonWhere("coalesce(items.code, '') AS original_value, '保留顯示值，建立 normalized identity' AS suggestion, 'normalization:' || coalesce(items.code, '') AS issue_key")}
      AND coalesce(nullif(trim(items.code), ''), '') != ''
      AND coalesce(nullif(trim(items.normalized_code), ''), '') != ''
      AND items.code != items.normalized_code`;
    case "unknown_platform": return `${commonWhere("coalesce(items.platform, '') AS original_value, '需人工確認' AS suggestion, 'platform:' || coalesce(items.platform, '') || ':' || coalesce(items.normalized_code, '') AS issue_key")} AND coalesce(items.platform, '') NOT IN ('FC2', 'JAV')`;
    case "missing_title": return `${commonWhere("coalesce(items.official_title, '') AS original_value, '補充正式標題' AS suggestion, 'missing-title:' || items.updated_at AS issue_key")} AND (items.official_title IS NULL OR trim(items.official_title) = '' OR items.official_title = items.code)`;
    case "suspicious_title": return `${commonWhere("coalesce(items.official_title, items.raw_title, '') AS original_value, '確認是否為 placeholder 或僅有作品代號' AS suggestion, 'suspicious-title:' || items.updated_at AS issue_key")}
      AND (
        lower(trim(coalesce(items.official_title, items.raw_title, ''))) IN ('unknown','untitled','test','temp','todo','tbd','待補','待整理','未命名','無標題','-','—')
        OR lower(replace(replace(coalesce(items.official_title, items.raw_title, ''), '-', ''), ' ', '')) = lower(replace(replace(coalesce(items.code, ''), '-', ''), ' ', ''))
      )`;
    case "missing_maker": return `${commonWhere("coalesce(items.maker, '') AS original_value, '補充片商或 studio' AS suggestion, 'missing-maker:' || items.updated_at AS issue_key")} AND (items.maker IS NULL OR trim(items.maker) = '') AND items.platform = 'JAV'`;
    case "incomplete_metadata": return `${commonWhere("trim((CASE WHEN coalesce(nullif(trim(items.official_title), ''), '') = '' THEN '正式標題 ' ELSE '' END) || (CASE WHEN coalesce(nullif(trim(items.maker), ''), '') = '' THEN '片商 ' ELSE '' END) || (CASE WHEN coalesce(nullif(trim(items.release_date), ''), '') = '' THEN '發行日期' ELSE '' END)) AS original_value, '補齊列出的 metadata 欄位' AS suggestion, 'metadata:' || items.updated_at AS issue_key")} AND (coalesce(nullif(trim(items.official_title), ''), '') = '' OR coalesce(nullif(trim(items.maker), ''), '') = '' OR coalesce(nullif(trim(items.release_date), ''), '') = '')`;
    case "missing_people": return `${commonWhere("'' AS original_value, '補充女優／創作者' AS suggestion, 'missing-people:' || items.updated_at AS issue_key")} AND NOT EXISTS (SELECT 1 FROM item_people WHERE item_people.item_id = items.id)`;
    case "missing_tags": return `${commonWhere("'' AS original_value, '補充標籤' AS suggestion, 'missing-tags:' || items.updated_at AS issue_key")} AND NOT EXISTS (SELECT 1 FROM item_tags WHERE item_tags.item_id = items.id)`;
    case "too_few_tags": return `${commonWhere("CAST((SELECT COUNT(*) FROM item_tags quality_tags WHERE quality_tags.item_id = items.id) AS TEXT) AS original_value, '補充更可用的分類標籤' AS suggestion, 'too-few-tags:' || items.updated_at AS issue_key")} AND (SELECT COUNT(*) FROM item_tags quality_tags WHERE quality_tags.item_id = items.id) = 1`;
    case "missing_cover": return `${commonWhere("'' AS original_value, '補充封面（選填、低優先）' AS suggestion, 'missing-cover:' || items.updated_at AS issue_key")} AND (items.cover_url IS NULL OR trim(items.cover_url) = '')`;
    case "unrated": return `${commonWhere("'' AS original_value, '補充 1–10 評分' AS suggestion, 'unrated:' || items.updated_at AS issue_key")} AND items.rating IS NULL`;
    case "unset_collection": return `${commonWhere("items.collection_level AS original_value, '選擇收藏等級' AS suggestion, 'collection:unset:' || items.updated_at AS issue_key")} AND items.collection_level = 'unset'`;
    case "invalid_collection": return `${commonWhere("coalesce(items.collection_level, '') AS original_value, '改為未分類' AS suggestion, 'collection-invalid:' || coalesce(items.collection_level, '') AS issue_key")} AND (items.collection_level IS NULL OR items.collection_level NOT IN ('unset','masterpiece','normal','discard'))`;
    case "invalid_code": return `${commonWhere("coalesce(items.code, '') AS original_value, '需人工確認或補充作品代號' AS suggestion, 'code-invalid:' || coalesce(items.code, '') AS issue_key")} AND (items.normalized_code IS NULL OR trim(items.normalized_code) = '' OR items.normalized_code NOT GLOB '*[0-9]*')`;
  }
}

function decorateIssue(row: Record<string, unknown>) {
  const completeness = evaluateCompleteness({
    code: stringValue(row.code),
    normalized_code: stringValue(row.normalized_code),
    raw_title: stringValue(row.raw_title),
    official_title: stringValue(row.official_title),
    platform: stringValue(row.platform),
    maker: stringValue(row.maker),
    release_date: stringValue(row.release_date),
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    quick_note: stringValue(row.quick_note),
    long_note: stringValue(row.long_note),
    cover_url: stringValue(row.cover_url),
    collection_level: stringValue(row.collection_level),
    tag_count: Number(row.tag_count || 0),
    people_count: Number(row.people_count || 0)
  });
  return { ...row, completeness_score: completeness.score, completeness_profile: completeness.profile, reasons: completeness.reasons };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function normalizedTitleSql(alias: string) {
  return `lower(replace(replace(replace(replace(replace(replace(
    coalesce(nullif(trim(${alias}.official_title), ''), nullif(trim(${alias}.raw_title), ''), ''),
    ' ', ''), '　', ''), '-', ''), '_', ''), '：', ''), ':', ''))`;
}
