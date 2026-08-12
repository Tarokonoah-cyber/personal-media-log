import { HttpError } from "./http";
import { newId } from "./ids";
import type { Actor, Env } from "./types";

export const privateIssueTypes = ["duplicate_code", "duplicate_metadata", "unknown_platform", "missing_title", "incomplete_metadata", "missing_people", "missing_tags", "unrated", "unset_collection", "invalid_collection", "invalid_code"] as const;
export type PrivateIssueType = (typeof privateIssueTypes)[number];

export function isPrivateIssueType(value: unknown): value is PrivateIssueType {
  return typeof value === "string" && privateIssueTypes.includes(value as PrivateIssueType);
}

const labels: Record<PrivateIssueType, string> = {
  duplicate_code: "疑似重複作品代號", duplicate_metadata: "疑似重複標題／Metadata", unknown_platform: "平台待確認", missing_title: "缺少標題", incomplete_metadata: "Metadata 不完整", missing_people: "缺少女優",
  missing_tags: "缺少標籤", unrated: "尚未評分", unset_collection: "收藏未分類", invalid_collection: "無效收藏值", invalid_code: "無效作品代號"
};

export async function getPrivateQuality(env: Env, issueType?: PrivateIssueType, page = 1, pageSize = 50, ignored = false) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  if (!issueType) {
    const rows = await Promise.all(privateIssueTypes.map(async (type) => ({ type, label: labels[type], count: await issueCount(env, type, false) })));
    const ignoredCount = await env.MEDIA_LOG_DB.prepare("SELECT COUNT(*) AS count FROM private_data_quality_ignores").first<{ count: number }>();
    return { summary: rows, ignoredCount: Number(ignoredCount?.count || 0) };
  }
  const base = issueSql(issueType);
  const ignoredClause = ignored ? "EXISTS" : "NOT EXISTS";
  const wrapped = `SELECT q.* FROM (${base}) q WHERE ${ignoredClause} (
    SELECT 1 FROM private_data_quality_ignores i WHERE i.item_id = q.item_id AND i.issue_type = ? AND i.issue_key = q.issue_key
  )`;
  const [count, result] = await Promise.all([
    env.MEDIA_LOG_DB.prepare(`SELECT COUNT(*) AS count FROM (${wrapped})`).bind(issueType).first<{ count: number }>(),
    env.MEDIA_LOG_DB.prepare(`${wrapped} ORDER BY q.code, q.item_id LIMIT ? OFFSET ?`).bind(issueType, safePageSize, (safePage - 1) * safePageSize).all<Record<string, unknown>>()
  ]);
  return { issueType, label: labels[issueType], page: safePage, pageSize: safePageSize, total: Number(count?.count || 0), issues: result.results || [] };
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

async function issueCount(env: Env, type: PrivateIssueType, ignored: boolean) {
  const base = issueSql(type);
  const clause = ignored ? "EXISTS" : "NOT EXISTS";
  const row = await env.MEDIA_LOG_DB.prepare(`SELECT COUNT(*) AS count FROM (${base}) q WHERE ${clause} (
    SELECT 1 FROM private_data_quality_ignores i WHERE i.item_id = q.item_id AND i.issue_type = ? AND i.issue_key = q.issue_key
  )`).bind(type).first<{ count: number }>();
  return Number(row?.count || 0);
}

function commonWhere(extra: string) {
  return `SELECT items.id AS item_id, coalesce(items.code, '') AS code, coalesce(items.official_title, items.raw_title, '') AS title,
    items.platform, items.collection_level, ${extra}
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
    case "unknown_platform": return `${commonWhere("coalesce(items.platform, '') AS original_value, '需人工確認' AS suggestion, 'platform:' || coalesce(items.platform, '') || ':' || coalesce(items.normalized_code, '') AS issue_key")} AND coalesce(items.platform, '') NOT IN ('FC2', 'JAV')`;
    case "missing_title": return `${commonWhere("coalesce(items.official_title, '') AS original_value, '補充正式標題' AS suggestion, 'missing-title:' || items.updated_at AS issue_key")} AND (items.official_title IS NULL OR trim(items.official_title) = '' OR items.official_title = items.code)`;
    case "incomplete_metadata": return `${commonWhere("trim((CASE WHEN coalesce(nullif(trim(items.official_title), ''), '') = '' THEN '正式標題 ' ELSE '' END) || (CASE WHEN coalesce(nullif(trim(items.maker), ''), '') = '' THEN '片商 ' ELSE '' END) || (CASE WHEN coalesce(nullif(trim(items.release_date), ''), '') = '' THEN '發行日期' ELSE '' END)) AS original_value, '補齊列出的 metadata 欄位' AS suggestion, 'metadata:' || items.updated_at AS issue_key")} AND (coalesce(nullif(trim(items.official_title), ''), '') = '' OR coalesce(nullif(trim(items.maker), ''), '') = '' OR coalesce(nullif(trim(items.release_date), ''), '') = '')`;
    case "missing_people": return `${commonWhere("'' AS original_value, '補充女優／創作者' AS suggestion, 'missing-people:' || items.updated_at AS issue_key")} AND NOT EXISTS (SELECT 1 FROM item_people WHERE item_people.item_id = items.id)`;
    case "missing_tags": return `${commonWhere("'' AS original_value, '補充標籤' AS suggestion, 'missing-tags:' || items.updated_at AS issue_key")} AND NOT EXISTS (SELECT 1 FROM item_tags WHERE item_tags.item_id = items.id)`;
    case "unrated": return `${commonWhere("'' AS original_value, '補充 1–10 評分' AS suggestion, 'unrated:' || items.updated_at AS issue_key")} AND items.rating IS NULL`;
    case "unset_collection": return `${commonWhere("items.collection_level AS original_value, '選擇收藏等級' AS suggestion, 'collection:unset:' || items.updated_at AS issue_key")} AND items.collection_level = 'unset'`;
    case "invalid_collection": return `${commonWhere("coalesce(items.collection_level, '') AS original_value, '改為未分類' AS suggestion, 'collection-invalid:' || coalesce(items.collection_level, '') AS issue_key")} AND (items.collection_level IS NULL OR items.collection_level NOT IN ('unset','masterpiece','normal','discard'))`;
    case "invalid_code": return `${commonWhere("coalesce(items.code, '') AS original_value, '需人工確認或補充作品代號' AS suggestion, 'code-invalid:' || coalesce(items.code, '') AS issue_key")} AND (items.normalized_code IS NULL OR trim(items.normalized_code) = '' OR items.normalized_code NOT GLOB '*[0-9]*')`;
  }
}

function normalizedTitleSql(alias: string) {
  return `lower(replace(replace(replace(replace(replace(replace(
    coalesce(nullif(trim(${alias}.official_title), ''), nullif(trim(${alias}.raw_title), ''), ''),
    ' ', ''), '　', ''), '-', ''), '_', ''), '：', ''), ':', ''))`;
}
