import { HttpError } from "./http";
import { batchUpdateItems, getItemsByIds } from "./items";
import type { Actor, Env, ItemInput, ItemRecord } from "./types";

export type MetadataSuggestionStatus = "pending" | "accepted" | "rejected" | "ignored";
export type MetadataSuggestionField = "official_title" | "platform" | "maker";

export function isMetadataSuggestionStatus(value: unknown): value is MetadataSuggestionStatus {
  return value === "pending" || value === "accepted" || value === "rejected" || value === "ignored";
}

type SuggestionRow = {
  id: string;
  item_id: string;
  field: MetadataSuggestionField;
  current_value: string | null;
  suggested_value: string;
  source: string;
  reason: string;
  status: MetadataSuggestionStatus;
  created_at: string;
  code?: string | null;
  title?: string | null;
};

export async function refreshMetadataSuggestions(env: Env) {
  const statements = [
    env.MEDIA_LOG_DB.prepare(`
      INSERT OR IGNORE INTO metadata_suggestions
        (id, item_id, field, current_value, suggested_value, source, reason)
      SELECT 'suggestion_' || lower(hex(randomblob(12))), id, 'platform', platform, 'FC2',
        'normalized_code', '作品代號符合 FC2 identity'
      FROM items
      WHERE is_private = 1 AND status != 'deleted'
        AND normalized_code LIKE 'FC2-PPV-%'
        AND lower(trim(coalesce(platform, ''))) != 'fc2'
    `),
    env.MEDIA_LOG_DB.prepare(`
      INSERT OR IGNORE INTO metadata_suggestions
        (id, item_id, field, current_value, suggested_value, source, reason)
      SELECT 'suggestion_' || lower(hex(randomblob(12))), id, 'platform', platform, 'JAV',
        'normalized_code', '作品代號符合一般 JAV identity'
      FROM items
      WHERE is_private = 1 AND status != 'deleted'
        AND normalized_code GLOB '[A-Z]*-[0-9]*'
        AND normalized_code NOT LIKE 'FC2-PPV-%'
        AND lower(trim(coalesce(platform, ''))) NOT IN ('jav', 'fc2')
    `),
    env.MEDIA_LOG_DB.prepare(`
      INSERT OR IGNORE INTO metadata_suggestions
        (id, item_id, field, current_value, suggested_value, source, reason)
      SELECT 'suggestion_' || lower(hex(randomblob(12))), id, 'maker', maker,
        CASE
          WHEN normalized_code GLOB 'SSIS-*' OR normalized_code GLOB 'IPZZ-*' OR normalized_code GLOB 'SONE-*' THEN 'S1'
          WHEN normalized_code GLOB 'STARS-*' OR normalized_code GLOB 'SDAB-*' OR normalized_code GLOB 'SDDE-*' THEN 'SOD'
          WHEN normalized_code GLOB 'ABW-*' OR normalized_code GLOB 'CHN-*' THEN 'Prestige'
        END,
        'code_prefix', '由已知作品代號 prefix 推導片商'
      FROM items
      WHERE is_private = 1 AND status != 'deleted'
        AND (maker IS NULL OR trim(maker) = '')
        AND (
          normalized_code GLOB 'SSIS-*' OR normalized_code GLOB 'IPZZ-*' OR normalized_code GLOB 'SONE-*'
          OR normalized_code GLOB 'STARS-*' OR normalized_code GLOB 'SDAB-*' OR normalized_code GLOB 'SDDE-*'
          OR normalized_code GLOB 'ABW-*' OR normalized_code GLOB 'CHN-*'
        )
    `),
    env.MEDIA_LOG_DB.prepare(`
      INSERT OR IGNORE INTO metadata_suggestions
        (id, item_id, field, current_value, suggested_value, source, reason)
      SELECT 'suggestion_' || lower(hex(randomblob(12))), id, 'official_title', official_title,
        trim(raw_title), 'raw_title', 'raw title 可作為正式標題候選'
      FROM items
      WHERE is_private = 1 AND status != 'deleted'
        AND (official_title IS NULL OR trim(official_title) = '')
        AND trim(coalesce(raw_title, '')) != ''
        AND lower(replace(replace(trim(raw_title), '-', ''), ' ', ''))
          != lower(replace(replace(trim(coalesce(code, '')), '-', ''), ' ', ''))
        AND lower(trim(raw_title)) NOT IN ('unknown','untitled','test','temp','todo','tbd','待補','待整理','未命名','無標題','-','—')
    `)
  ];
  const results = await env.MEDIA_LOG_DB.batch(statements);
  return { generated: results.reduce((sum, result) => sum + Number(result.meta?.changes || 0), 0) };
}

export async function listMetadataSuggestions(
  env: Env,
  status: MetadataSuggestionStatus = "pending",
  page = 1,
  pageSize = 50,
  itemId?: string
) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const where = ["metadata_suggestions.status = ?"];
  const bind: unknown[] = [status];
  if (itemId) {
    where.push("metadata_suggestions.item_id = ?");
    bind.push(itemId);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const [countResult, listResult] = await env.MEDIA_LOG_DB.batch([
    env.MEDIA_LOG_DB.prepare(`SELECT COUNT(*) AS count FROM metadata_suggestions ${whereSql}`).bind(...bind),
    env.MEDIA_LOG_DB.prepare(`
      SELECT metadata_suggestions.*, items.code, coalesce(items.official_title, items.raw_title) AS title
      FROM metadata_suggestions
      JOIN items ON items.id = metadata_suggestions.item_id
      ${whereSql}
      ORDER BY metadata_suggestions.created_at DESC, metadata_suggestions.id
      LIMIT ? OFFSET ?
    `).bind(...bind, safePageSize, (safePage - 1) * safePageSize)
  ]);
  const count = (countResult.results as Array<{ count: number }> || [])[0];
  return {
    page: safePage,
    pageSize: safePageSize,
    total: Number(count?.count || 0),
    suggestions: (listResult.results as SuggestionRow[] || [])
  };
}

export async function previewMetadataSuggestions(env: Env, ids: unknown) {
  const suggestionIds = validateSuggestionIds(ids);
  const suggestions = await getSuggestionRows(env, suggestionIds, "pending");
  ensureAllSuggestionsFound(suggestionIds, suggestions);
  return {
    atomic: true,
    changes: suggestions.map((row) => ({
      suggestionId: row.id,
      itemId: row.item_id,
      field: row.field,
      before: row.current_value,
      after: row.suggested_value,
      source: row.source,
      reason: row.reason
    }))
  };
}

export async function applyMetadataSuggestions(env: Env, actor: Actor, ids: unknown, confirmed: unknown) {
  if (confirmed !== true) throw new HttpError(400, "confirmed=true is required after preview");
  const suggestionIds = validateSuggestionIds(ids);
  const suggestions = await getSuggestionRows(env, suggestionIds, "pending");
  ensureAllSuggestionsFound(suggestionIds, suggestions);
  const items = await getItemsByIds(env, suggestions.map((row) => row.item_id));
  const itemById = new Map(items.map((item) => [item.id, item]));
  const suggestionsByItem = new Map<string, SuggestionRow[]>();
  for (const suggestion of suggestions) {
    const item = itemById.get(suggestion.item_id);
    if (!item) throw new HttpError(404, "Suggestion item no longer exists", { suggestionId: suggestion.id });
    const current = item[suggestion.field];
    if ((current ?? "") !== (suggestion.current_value ?? "")) {
      throw new HttpError(409, "Suggestion preview is stale", {
        suggestionId: suggestion.id,
        itemId: suggestion.item_id,
        field: suggestion.field,
        expected: suggestion.current_value,
        actual: current
      });
    }
    suggestionsByItem.set(item.id, [...(suggestionsByItem.get(item.id) || []), suggestion]);
  }
  const operations = Array.from(suggestionsByItem.entries()).map(([itemId, itemSuggestions]) => {
    const item = itemById.get(itemId)!;
    const input = itemToInput(item);
    for (const suggestion of itemSuggestions) input[suggestion.field] = suggestion.suggested_value;
    return { id: itemId, input };
  });
  const result = await batchUpdateItems(env, actor, operations);
  await env.MEDIA_LOG_DB.prepare(`
    UPDATE metadata_suggestions
    SET status = 'accepted', actor_email = ?, decided_at = datetime('now')
    WHERE id IN (SELECT CAST(value AS TEXT) FROM json_each(?)) AND status = 'pending'
  `).bind(actor.email, JSON.stringify(suggestionIds)).run();
  return { ...result, acceptedSuggestionIds: suggestionIds };
}

export async function decideMetadataSuggestions(
  env: Env,
  actor: Actor,
  ids: unknown,
  decision: unknown
) {
  if (decision !== "rejected" && decision !== "ignored") throw new HttpError(400, "decision must be rejected or ignored");
  const suggestionIds = validateSuggestionIds(ids);
  const result = await env.MEDIA_LOG_DB.prepare(`
    UPDATE metadata_suggestions
    SET status = ?, actor_email = ?, decided_at = datetime('now')
    WHERE id IN (SELECT CAST(value AS TEXT) FROM json_each(?)) AND status = 'pending'
  `).bind(decision, actor.email, JSON.stringify(suggestionIds)).run();
  return { decision, requested: suggestionIds.length, changed: Number(result.meta?.changes || 0) };
}

function validateSuggestionIds(value: unknown) {
  if (!Array.isArray(value)) throw new HttpError(400, "ids must be an array");
  const ids = Array.from(new Set(value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean)));
  if (ids.length < 1 || ids.length > 100) throw new HttpError(400, "Select between 1 and 100 suggestions");
  return ids;
}

async function getSuggestionRows(env: Env, ids: string[], status: MetadataSuggestionStatus) {
  const result = await env.MEDIA_LOG_DB.prepare(`
    SELECT id, item_id, field, current_value, suggested_value, source, reason, status, created_at
    FROM metadata_suggestions
    WHERE status = ? AND id IN (SELECT CAST(value AS TEXT) FROM json_each(?))
  `).bind(status, JSON.stringify(ids)).all<SuggestionRow>();
  return result.results || [];
}

function ensureAllSuggestionsFound(ids: string[], rows: SuggestionRow[]) {
  const found = new Set(rows.map((row) => row.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) throw new HttpError(409, "Some suggestions are no longer pending", { missing });
}

function itemToInput(item: ItemRecord): ItemInput {
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, deleted_at: _deletedAt, ...input } = item;
  return input;
}
