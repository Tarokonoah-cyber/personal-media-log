import { HttpError } from "./http";
import { newId } from "./ids";
import { getItemsByIds } from "./items";
import type { Actor, Env } from "./types";

export const organizationInboxCategories = [
  "new",
  "missing_metadata",
  "missing_tags",
  "missing_people",
  "duplicate_suspected",
  "normalization_needed",
  "metadata_conflict",
  "ready",
  "skipped"
] as const;
export type OrganizationInboxCategory = (typeof organizationInboxCategories)[number];
export type OrganizationInboxState = "active" | "skipped" | "ready";

type InboxRow = {
  id: string;
  inbox_state: OrganizationInboxState;
  is_new: number;
  missing_metadata: number;
  missing_tags: number;
  missing_people: number;
  duplicate_suspected: number;
  normalization_needed: number;
  metadata_conflict: number;
};

const reasonLabels: Record<Exclude<OrganizationInboxCategory, "ready" | "skipped">, string> = {
  new: "新作品",
  missing_metadata: "Metadata 不完整",
  missing_tags: "缺少標籤",
  missing_people: "缺少人物",
  duplicate_suspected: "疑似重複",
  normalization_needed: "需要正規化",
  metadata_conflict: "Metadata 疑似衝突"
};
const reasonFields: Record<keyof typeof reasonLabels, keyof InboxRow> = {
  new: "is_new",
  missing_metadata: "missing_metadata",
  missing_tags: "missing_tags",
  missing_people: "missing_people",
  duplicate_suspected: "duplicate_suspected",
  normalization_needed: "normalization_needed",
  metadata_conflict: "metadata_conflict"
};

export function isOrganizationInboxCategory(value: unknown): value is OrganizationInboxCategory {
  return typeof value === "string" && organizationInboxCategories.includes(value as OrganizationInboxCategory);
}

export async function getOrganizationInboxSummary(env: Env) {
  const row = await env.MEDIA_LOG_DB.prepare(`${inboxCte()}
    SELECT
      SUM(CASE WHEN inbox_state = 'active' AND needs_attention = 1 THEN 1 ELSE 0 END) AS needs_attention,
      SUM(CASE WHEN inbox_state = 'active' AND is_new = 1 THEN 1 ELSE 0 END) AS new_count,
      SUM(CASE WHEN inbox_state = 'active' AND missing_metadata = 1 THEN 1 ELSE 0 END) AS missing_metadata,
      SUM(CASE WHEN inbox_state = 'active' AND missing_tags = 1 THEN 1 ELSE 0 END) AS missing_tags,
      SUM(CASE WHEN inbox_state = 'active' AND missing_people = 1 THEN 1 ELSE 0 END) AS missing_people,
      SUM(CASE WHEN inbox_state = 'active' AND duplicate_suspected = 1 THEN 1 ELSE 0 END) AS duplicate_suspected,
      SUM(CASE WHEN inbox_state = 'active' AND normalization_needed = 1 THEN 1 ELSE 0 END) AS normalization_needed,
      SUM(CASE WHEN inbox_state = 'active' AND metadata_conflict = 1 THEN 1 ELSE 0 END) AS metadata_conflict,
      SUM(CASE WHEN inbox_state = 'ready' THEN 1 ELSE 0 END) AS ready,
      SUM(CASE WHEN inbox_state = 'skipped' THEN 1 ELSE 0 END) AS skipped
    FROM inbox_items
  `).first<Record<string, number>>();
  return {
    needsAttention: Number(row?.needs_attention || 0),
    categories: {
      new: Number(row?.new_count || 0),
      missing_metadata: Number(row?.missing_metadata || 0),
      missing_tags: Number(row?.missing_tags || 0),
      missing_people: Number(row?.missing_people || 0),
      duplicate_suspected: Number(row?.duplicate_suspected || 0),
      normalization_needed: Number(row?.normalization_needed || 0),
      metadata_conflict: Number(row?.metadata_conflict || 0),
      ready: Number(row?.ready || 0),
      skipped: Number(row?.skipped || 0)
    }
  };
}

export async function listOrganizationInbox(
  env: Env,
  category: OrganizationInboxCategory = "missing_metadata",
  page = 1,
  pageSize = 50
) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const categorySql = inboxCategorySql(category);
  const [countResult, listResult] = await env.MEDIA_LOG_DB.batch([
    env.MEDIA_LOG_DB.prepare(`${inboxCte()} SELECT COUNT(*) AS count FROM inbox_items WHERE ${categorySql}`),
    env.MEDIA_LOG_DB.prepare(`${inboxCte()}
      SELECT * FROM inbox_items WHERE ${categorySql}
      ORDER BY datetime(updated_at) DESC, id DESC LIMIT ? OFFSET ?
    `).bind(safePageSize, (safePage - 1) * safePageSize)
  ]);
  const count = (countResult.results as Array<{ count: number }> || [])[0];
  const rows = listResult.results as InboxRow[] || [];
  const hydrated = await getItemsByIds(env, rows.map((row) => row.id));
  const itemById = new Map(hydrated.map((item) => [item.id, item]));
  return {
    category,
    page: safePage,
    pageSize: safePageSize,
    total: Number(count?.count || 0),
    items: rows.flatMap((row) => {
      const item = itemById.get(row.id);
      if (!item) return [];
      return [{
        item,
        state: row.inbox_state,
        reasons: inboxReasons(row)
      }];
    })
  };
}

export async function setOrganizationInboxState(env: Env, actor: Actor, itemIds: unknown, state: unknown) {
  if (state !== "active" && state !== "skipped" && state !== "ready") throw new HttpError(400, "Invalid inbox state");
  const ids = validateItemIds(itemIds);
  const result = await env.MEDIA_LOG_DB.prepare(`
    INSERT INTO organization_inbox_state (item_id, state, actor_email, updated_at)
    SELECT items.id, ?, ?, datetime('now')
    FROM items JOIN json_each(?) selected ON CAST(selected.value AS TEXT) = items.id
    WHERE items.is_private = 1 AND items.status != 'deleted'
    ON CONFLICT(item_id) DO UPDATE SET
      state = excluded.state,
      actor_email = excluded.actor_email,
      updated_at = excluded.updated_at
  `).bind(state, actor.email, JSON.stringify(ids)).run();
  await env.MEDIA_LOG_DB.prepare(`
    INSERT INTO audit_logs (id, actor_email, action, entity_type, entity_id, metadata_json)
    VALUES (?, ?, 'organization_inbox_state', 'item_batch', ?, ?)
  `).bind(newId("audit"), actor.email, ids.join(","), JSON.stringify({ ids, state })).run();
  return { state, requested: ids.length, changed: Number(result.meta?.changes || 0), itemIds: ids };
}

function inboxCte() {
  return `WITH tagged AS (
    SELECT DISTINCT item_id FROM item_tags
  ), personed AS (
    SELECT DISTINCT item_id FROM item_people
  ), duplicate_codes AS (
    SELECT normalized_code
    FROM items
    WHERE is_private = 1 AND status != 'deleted' AND normalized_code IS NOT NULL AND normalized_code != ''
    GROUP BY normalized_code HAVING COUNT(*) > 1
  ), inbox_base AS (
    SELECT
      items.id,
      items.updated_at,
      coalesce(inbox.state, 'active') AS inbox_state,
      CASE WHEN items.status = 'raw' OR datetime(items.created_at) >= datetime('now', '-7 days') THEN 1 ELSE 0 END AS is_new,
      CASE WHEN
        coalesce(nullif(trim(items.official_title), ''), '') = ''
        OR coalesce(nullif(trim(items.platform), ''), '') = ''
        OR (lower(trim(coalesce(items.platform, ''))) = 'jav' AND coalesce(nullif(trim(items.maker), ''), '') = '')
      THEN 1 ELSE 0 END AS missing_metadata,
      CASE WHEN tagged.item_id IS NULL THEN 1 ELSE 0 END AS missing_tags,
      CASE WHEN personed.item_id IS NULL THEN 1 ELSE 0 END AS missing_people,
      CASE WHEN duplicate_codes.normalized_code IS NOT NULL THEN 1 ELSE 0 END AS duplicate_suspected,
      CASE WHEN coalesce(nullif(trim(items.code), ''), '') != ''
        AND coalesce(nullif(trim(items.normalized_code), ''), '') != ''
        AND items.code != items.normalized_code THEN 1 ELSE 0 END AS normalization_needed,
      CASE WHEN
        (items.release_year IS NOT NULL AND items.year IS NOT NULL AND items.release_year != items.year)
        OR (coalesce(items.normalized_code, '') LIKE 'FC2-PPV-%' AND lower(coalesce(items.platform, '')) != 'fc2')
        OR (lower(coalesce(items.platform, '')) = 'fc2' AND coalesce(items.normalized_code, '') NOT LIKE 'FC2-PPV-%')
      THEN 1 ELSE 0 END AS metadata_conflict
    FROM items
    LEFT JOIN tagged ON tagged.item_id = items.id
    LEFT JOIN personed ON personed.item_id = items.id
    LEFT JOIN duplicate_codes ON duplicate_codes.normalized_code = items.normalized_code
    LEFT JOIN organization_inbox_state inbox ON inbox.item_id = items.id
    WHERE items.is_private = 1 AND items.status != 'deleted'
  ), inbox_items AS (
    SELECT *, CASE WHEN is_new = 1 OR missing_metadata = 1 OR missing_tags = 1 OR missing_people = 1
      OR duplicate_suspected = 1 OR normalization_needed = 1 OR metadata_conflict = 1 THEN 1 ELSE 0 END AS needs_attention
    FROM inbox_base
  )`;
}

function inboxCategorySql(category: OrganizationInboxCategory) {
  if (category === "ready") return "inbox_state = 'ready'";
  if (category === "skipped") return "inbox_state = 'skipped'";
  return `inbox_state = 'active' AND ${category} = 1`;
}

function inboxReasons(row: InboxRow) {
  return (Object.keys(reasonLabels) as Array<keyof typeof reasonLabels>)
    .filter((reason) => Number(row[reasonFields[reason]]) === 1)
    .map((code) => ({ code, label: reasonLabels[code] }));
}

function validateItemIds(value: unknown) {
  if (!Array.isArray(value)) throw new HttpError(400, "itemIds must be an array");
  const ids = Array.from(new Set(value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean)));
  if (ids.length < 1 || ids.length > 100) throw new HttpError(400, "Select between 1 and 100 inbox items");
  return ids;
}
