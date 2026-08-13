import { HttpError } from "./http";
import { newId } from "./ids";
import { batchUpdateItems, getItemsByIds } from "./items";
import { normalizeEntityKey } from "./metadataQuality";
import type { Actor, Env, ItemInput, ItemRecord } from "./types";

export const duplicateDecisions = ["not_duplicate", "ignored", "keep_both"] as const;
export type DuplicateDecision = (typeof duplicateDecisions)[number];
export type DuplicateConfidence = "high" | "medium" | "low";

type CandidateRow = { a_id: string; b_id: string };
type ConflictResolution = "target" | "source";
type MergeConflict = { field: string; label: string; targetValue: unknown; sourceValue: unknown };

const mergeScalarFields: Array<{ field: keyof ItemInput; label: string }> = [
  { field: "raw_title", label: "原始標題" },
  { field: "official_title", label: "正式標題" },
  { field: "original_title", label: "原文標題" },
  { field: "code", label: "作品代號" },
  { field: "type", label: "類型" },
  { field: "category", label: "分類" },
  { field: "platform", label: "平台" },
  { field: "maker", label: "片商" },
  { field: "series", label: "系列" },
  { field: "release_year", label: "發行年份" },
  { field: "release_date", label: "發行日期" },
  { field: "year", label: "年份" },
  { field: "watched_at", label: "紀錄日" },
  { field: "rating", label: "評分" },
  { field: "rewatch_score", label: "重看分數" },
  { field: "collection_level", label: "收藏等級" },
  { field: "cover_url", label: "封面" },
  { field: "source_url", label: "來源" },
  { field: "progress_json", label: "觀看進度" }
];

export function isDuplicateDecision(value: unknown): value is DuplicateDecision {
  return typeof value === "string" && duplicateDecisions.includes(value as DuplicateDecision);
}

export async function refreshDuplicateSignatures(env: Env) {
  const normalizedTitle = normalizedTitleSql("items");
  const results = await env.MEDIA_LOG_DB.batch([
    env.MEDIA_LOG_DB.prepare(`
    WITH targets AS (
      SELECT items.id
      FROM items
      LEFT JOIN duplicate_item_signatures signatures ON signatures.item_id = items.id
      LEFT JOIN duplicate_signature_dirty dirty ON dirty.item_id = items.id
      WHERE items.is_private = 1 AND items.status != 'deleted'
        AND (
          signatures.item_id IS NULL
          OR dirty.item_id IS NOT NULL
          OR signatures.item_updated_at != items.updated_at
          OR signatures.signature_version != 2
        )
    ),
    people_signatures AS (
      SELECT item_people.item_id, group_concat(lower(trim(people.name)), '|') AS people_key
      FROM targets
      JOIN item_people ON item_people.item_id = targets.id
      JOIN people ON people.id = item_people.person_id
      GROUP BY item_people.item_id
    )
    INSERT INTO duplicate_item_signatures (
      item_id, normalized_code, normalized_title, title_block, maker_key, platform_key,
      collection_key, source_identity, people_key, item_updated_at, signature_updated_at, signature_version
    )
    SELECT
      items.id, nullif(trim(items.normalized_code), ''), ${normalizedTitle},
      substr(${normalizedTitle}, 1, 6) || ':' || substr(${normalizedTitle}, max(1, length(${normalizedTitle}) - 5), 6),
      lower(trim(coalesce(items.maker, ''))), lower(trim(coalesce(items.platform, ''))),
      lower(trim(coalesce(items.collection_level, ''))), lower(trim(coalesce(items.source_url, ''))),
      coalesce(people_signatures.people_key, ''), items.updated_at, datetime('now'), 2
    FROM targets
    JOIN items ON items.id = targets.id
    LEFT JOIN people_signatures ON people_signatures.item_id = items.id
    ON CONFLICT(item_id) DO UPDATE SET
      normalized_code = excluded.normalized_code,
      normalized_title = excluded.normalized_title,
      title_block = excluded.title_block,
      maker_key = excluded.maker_key,
      platform_key = excluded.platform_key,
      collection_key = excluded.collection_key,
      source_identity = excluded.source_identity,
      people_key = excluded.people_key,
      item_updated_at = excluded.item_updated_at,
      signature_updated_at = excluded.signature_updated_at,
      signature_version = excluded.signature_version
  `),
    env.MEDIA_LOG_DB.prepare(`
      DELETE FROM duplicate_item_signatures
      WHERE NOT EXISTS (
        SELECT 1 FROM items
        WHERE items.id = duplicate_item_signatures.item_id
          AND items.is_private = 1 AND items.status != 'deleted'
      )
    `),
    env.MEDIA_LOG_DB.prepare("DELETE FROM duplicate_signature_dirty")
  ]);
  return {
    indexed: Number(results[0]?.meta?.changes || 0),
    removed: Number(results[1]?.meta?.changes || 0)
  };
}

export async function listDuplicateCandidates(env: Env, page = 1, pageSize = 50) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const freshness = await env.MEDIA_LOG_DB.batch([
    env.MEDIA_LOG_DB.prepare("SELECT COUNT(*) AS count FROM duplicate_signature_dirty"),
    env.MEDIA_LOG_DB.prepare("SELECT COUNT(*) AS count FROM duplicate_item_signatures"),
    env.MEDIA_LOG_DB.prepare("SELECT COUNT(*) AS count FROM items WHERE is_private = 1 AND status != 'deleted'"),
    env.MEDIA_LOG_DB.prepare("SELECT COUNT(*) AS count FROM duplicate_item_signatures WHERE signature_version != 2")
  ]);
  const dirtyCount = Number((freshness[0]?.results?.[0] as { count?: number } | undefined)?.count || 0);
  const signatureCount = Number((freshness[1]?.results?.[0] as { count?: number } | undefined)?.count || 0);
  const privateCount = Number((freshness[2]?.results?.[0] as { count?: number } | undefined)?.count || 0);
  const outdatedCount = Number((freshness[3]?.results?.[0] as { count?: number } | undefined)?.count || 0);
  if (dirtyCount > 0 || signatureCount !== privateCount || outdatedCount > 0) await refreshDuplicateSignatures(env);
  const scanLimit = Math.min(1000, Math.max(200, safePage * safePageSize * 4));
  const base = (condition: string) => `
    SELECT a.item_id AS a_id, b.item_id AS b_id
    FROM duplicate_item_signatures a
    JOIN duplicate_item_signatures b ON a.item_id < b.item_id AND ${condition}
    JOIN items item_a ON item_a.id = a.item_id AND item_a.is_private = 1 AND item_a.status != 'deleted'
    JOIN items item_b ON item_b.id = b.item_id AND item_b.is_private = 1 AND item_b.status != 'deleted'
    WHERE NOT EXISTS (
      SELECT 1 FROM duplicate_decisions decisions WHERE decisions.pair_key = a.item_id || '::' || b.item_id
    )
    LIMIT ?
  `;
  const results = await env.MEDIA_LOG_DB.batch([
    env.MEDIA_LOG_DB.prepare(base("a.normalized_code != '' AND a.normalized_code = b.normalized_code")).bind(scanLimit),
    env.MEDIA_LOG_DB.prepare(base("a.source_identity != '' AND a.source_identity = b.source_identity")).bind(scanLimit),
    env.MEDIA_LOG_DB.prepare(base("a.normalized_title != '' AND a.normalized_title = b.normalized_title AND a.platform_key = b.platform_key AND a.maker_key != '' AND a.maker_key = b.maker_key")).bind(scanLimit),
    env.MEDIA_LOG_DB.prepare(base("a.normalized_title != '' AND a.normalized_title = b.normalized_title AND a.platform_key = b.platform_key AND a.people_key != '' AND a.people_key = b.people_key")).bind(scanLimit),
    env.MEDIA_LOG_DB.prepare(base("length(a.title_block) >= 6 AND a.title_block = b.title_block AND a.platform_key != '' AND a.platform_key = b.platform_key")).bind(scanLimit),
    env.MEDIA_LOG_DB.prepare(base("length(a.title_block) >= 6 AND a.title_block = b.title_block AND a.maker_key != '' AND a.maker_key = b.maker_key")).bind(scanLimit),
    env.MEDIA_LOG_DB.prepare(base("length(a.title_block) >= 6 AND a.title_block = b.title_block AND a.people_key != '' AND a.people_key = b.people_key")).bind(scanLimit)
  ]);
  const pairMap = new Map<string, CandidateRow>();
  for (const result of results) {
    for (const row of result.results as CandidateRow[] || []) pairMap.set(pairKey(row.a_id, row.b_id), row);
  }
  const rows = Array.from(pairMap.values());
  const candidateIds = Array.from(new Set(rows.flatMap((row) => [row.a_id, row.b_id])));
  const items: ItemRecord[] = [];
  for (let index = 0; index < candidateIds.length; index += 200) {
    items.push(...await getItemsByIds(env, candidateIds.slice(index, index + 200)));
  }
  const itemById = new Map(items.map((item) => [item.id, item]));
  const candidates = rows.flatMap((row) => {
    const itemA = itemById.get(row.a_id);
    const itemB = itemById.get(row.b_id);
    return itemA && itemB ? [scoreCandidate(itemA, itemB)] : [];
  }).filter((candidate) => candidate.score >= 45)
    .sort((left, right) => right.score - left.score || left.pairKey.localeCompare(right.pairKey));
  const offset = (safePage - 1) * safePageSize;
  return {
    page: safePage,
    pageSize: safePageSize,
    total: candidates.length,
    truncated: results.some((result) => (result.results?.length || 0) >= scanLimit),
    candidates: candidates.slice(offset, offset + safePageSize)
  };
}

export async function decideDuplicatePair(
  env: Env,
  actor: Actor,
  itemAId: unknown,
  itemBId: unknown,
  decision: unknown,
  metadata?: unknown
) {
  if (!isDuplicateDecision(decision)) throw new HttpError(400, "Invalid duplicate decision");
  const [itemA, itemB] = validatePairIds(itemAId, itemBId);
  const items = await getItemsByIds(env, [itemA, itemB]);
  if (items.length !== 2) throw new HttpError(404, "Both duplicate items must exist");
  const [a, b] = orderedPair(itemA, itemB);
  await env.MEDIA_LOG_DB.prepare(`
    INSERT INTO duplicate_decisions (pair_key, item_a_id, item_b_id, decision, actor_email, metadata_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(pair_key) DO UPDATE SET
      decision = excluded.decision, actor_email = excluded.actor_email,
      metadata_json = excluded.metadata_json, updated_at = excluded.updated_at
  `).bind(pairKey(a, b), a, b, decision, actor.email, JSON.stringify(metadata || {})).run();
  return { pairKey: pairKey(a, b), decision, dataChanged: false };
}

export async function previewDuplicateMerge(env: Env, targetItemId: unknown, sourceItemId: unknown) {
  const [targetId, sourceId] = validatePairIds(targetItemId, sourceItemId);
  const [target, source] = await getPairItems(env, targetId, sourceId);
  return buildMergePreview(target, source);
}

export async function applyDuplicateMerge(
  env: Env,
  actor: Actor,
  input: {
    targetItemId?: unknown;
    sourceItemId?: unknown;
    expectedTargetUpdatedAt?: unknown;
    expectedSourceUpdatedAt?: unknown;
    resolutions?: unknown;
    confirmed?: unknown;
  }
) {
  if (input.confirmed !== true) throw new HttpError(400, "confirmed=true is required after preview");
  const [targetId, sourceId] = validatePairIds(input.targetItemId, input.sourceItemId);
  const [target, source] = await getPairItems(env, targetId, sourceId);
  if (target.updated_at !== input.expectedTargetUpdatedAt || source.updated_at !== input.expectedSourceUpdatedAt) {
    throw new HttpError(409, "Duplicate merge preview is stale");
  }
  const preview = buildMergePreview(target, source);
  const resolutions = validateConflictResolutions(input.resolutions, preview.conflicts);
  const mergedInput = { ...preview.suggestedInput } as ItemInput;
  for (const conflict of preview.conflicts) {
    if (resolutions[conflict.field] === "source") (mergedInput as Record<string, unknown>)[conflict.field] = conflict.sourceValue;
  }
  const mergeId = newId("duplicate_merge");
  const [a, b] = orderedPair(target.id, source.id);
  const key = pairKey(a, b);
  const snapshotStatement = env.MEDIA_LOG_DB.prepare(`
    INSERT INTO duplicate_merge_snapshots (
      id, pair_key, target_item_id, source_item_id, target_before_json, source_before_json, actor_email, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `).bind(mergeId, key, target.id, source.id, JSON.stringify(target), JSON.stringify(source), actor.email);
  const decisionStatement = duplicateDecisionStatement(env, actor, key, a, b, "merged", { mergeId });
  const sourceDeleted = {
    ...itemToInput(source),
    code: null,
    normalized_code: null,
    status: "deleted" as const,
    media_status: "已刪除" as const,
    favorite_level: "已刪" as const,
    collection_level: "discard" as const,
    favorite: false,
    used: false
  };
  await batchUpdateItems(env, actor, [
    { id: target.id, input: mergedInput },
    { id: source.id, input: sourceDeleted }
  ], { additionalStatements: [snapshotStatement, decisionStatement] });
  return { mergeId, pairKey: key, targetItemId: target.id, sourceItemId: source.id, merged: true, recoveryAvailable: true };
}

export async function rollbackDuplicateMerge(env: Env, actor: Actor, mergeId: unknown, confirmed: unknown) {
  if (confirmed !== true) throw new HttpError(400, "confirmed=true is required for rollback");
  if (typeof mergeId !== "string" || !mergeId.trim()) throw new HttpError(400, "mergeId is required");
  const snapshot = await env.MEDIA_LOG_DB.prepare(`
    SELECT id, pair_key, target_before_json, source_before_json, rolled_back_at
    FROM duplicate_merge_snapshots WHERE id = ?
  `).bind(mergeId.trim()).first<{ id: string; pair_key: string; target_before_json: string; source_before_json: string; rolled_back_at: string | null }>();
  if (!snapshot) throw new HttpError(404, "Duplicate merge recovery snapshot not found");
  if (snapshot.rolled_back_at) throw new HttpError(409, "Duplicate merge was already rolled back");
  const target = JSON.parse(snapshot.target_before_json) as ItemRecord;
  const source = JSON.parse(snapshot.source_before_json) as ItemRecord;
  await batchUpdateItems(env, actor, [
    { id: target.id, input: itemToInput(target) },
    { id: source.id, input: itemToInput(source) }
  ], {
    includeDeleted: true,
    allowDuplicateNormalizedCodes: true,
    additionalStatements: [
      env.MEDIA_LOG_DB.prepare("UPDATE duplicate_merge_snapshots SET rolled_back_at = datetime('now') WHERE id = ?").bind(snapshot.id),
      env.MEDIA_LOG_DB.prepare("DELETE FROM duplicate_decisions WHERE pair_key = ? AND decision = 'merged'").bind(snapshot.pair_key)
    ]
  });
  return { mergeId: snapshot.id, rolledBack: true, restoredItemIds: [target.id, source.id] };
}

function scoreCandidate(itemA: ItemRecord, itemB: ItemRecord) {
  const evidence: Array<{ code: string; label: string; weight: number }> = [];
  let score = 0;
  const codeA = itemA.normalized_code || "";
  const codeB = itemB.normalized_code || "";
  const sourceA = normalizedString(itemA.source_url);
  const sourceB = normalizedString(itemB.source_url);
  const titleA = normalizeEntityKey(itemA.official_title || itemA.raw_title);
  const titleB = normalizeEntityKey(itemB.official_title || itemB.raw_title);
  const titleSimilarity = diceSimilarity(titleA, titleB);
  if (codeA && codeA === codeB) { score = Math.max(score, 100); evidence.push({ code: "normalized_code", label: "Normalized code 相同", weight: 100 }); }
  if (sourceA && sourceA === sourceB) { score = Math.max(score, 95); evidence.push({ code: "source_identity", label: "來源 identity 相同", weight: 95 }); }
  if (titleA && titleA === titleB) { score += 55; evidence.push({ code: "exact_title", label: "正規化標題相同", weight: 55 }); }
  else if (titleSimilarity >= 0.7) { const weight = Math.round(titleSimilarity * 50); score += weight; evidence.push({ code: "title_similarity", label: `標題相似 ${Math.round(titleSimilarity * 100)}%`, weight }); }
  if (sameNonEmpty(itemA.maker, itemB.maker)) { score += 15; evidence.push({ code: "maker", label: "片商相同", weight: 15 }); }
  if (sameNonEmpty(itemA.platform, itemB.platform)) { score += 10; evidence.push({ code: "platform", label: "平台相同", weight: 10 }); }
  const peopleOverlap = overlapRatio(itemA.people, itemB.people);
  if (peopleOverlap >= 0.5) { const weight = Math.round(peopleOverlap * 20); score += weight; evidence.push({ code: "people", label: `人物重疊 ${Math.round(peopleOverlap * 100)}%`, weight }); }
  if (itemA.collection_level && itemA.collection_level === itemB.collection_level) { score += 5; evidence.push({ code: "collection", label: "收藏狀態相同", weight: 5 }); }
  score = Math.min(100, score);
  const confidence: DuplicateConfidence = score >= 90 ? "high" : score >= 65 ? "medium" : "low";
  return { pairKey: pairKey(itemA.id, itemB.id), itemA, itemB, score, confidence, evidence };
}

function buildMergePreview(target: ItemRecord, source: ItemRecord) {
  const suggestedInput = itemToInput(target);
  const targetInput = itemToInput(target) as Record<string, unknown>;
  const sourceInput = itemToInput(source) as Record<string, unknown>;
  const merged = suggestedInput as Record<string, unknown>;
  const conflicts: MergeConflict[] = [];
  for (const { field, label } of mergeScalarFields) {
    const targetValue = targetInput[field];
    const sourceValue = sourceInput[field];
    if (emptyValue(targetValue) && !emptyValue(sourceValue)) merged[field] = sourceValue;
    else if (!emptyValue(targetValue) && !emptyValue(sourceValue) && !sameValue(targetValue, sourceValue)) {
      conflicts.push({ field, label, targetValue, sourceValue });
    }
  }
  suggestedInput.tags = unionStrings(target.tags, source.tags);
  suggestedInput.people = unionStrings(target.people, source.people);
  suggestedInput.collections = unionStrings(target.collections, source.collections);
  suggestedInput.favorite = target.favorite || source.favorite;
  suggestedInput.used = target.used || source.used;
  suggestedInput.quick_note = mergeNotes(target.quick_note, source.quick_note);
  suggestedInput.long_note = mergeNotes(target.long_note, source.long_note);
  suggestedInput.metadata_json = mergeJson(target.metadata_json, source.metadata_json);
  return {
    target,
    source,
    suggestedInput,
    conflicts,
    expectedTargetUpdatedAt: target.updated_at,
    expectedSourceUpdatedAt: source.updated_at,
    union: { tags: suggestedInput.tags, people: suggestedInput.people, collections: suggestedInput.collections },
    requiresConfirmation: true
  };
}

async function getPairItems(env: Env, targetId: string, sourceId: string) {
  const items = await getItemsByIds(env, [targetId, sourceId]);
  if (items.length !== 2) throw new HttpError(404, "Both duplicate items must exist");
  return [items[0], items[1]] as const;
}

function validateConflictResolutions(value: unknown, conflicts: MergeConflict[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Conflict resolutions are required");
  const resolutions = value as Record<string, unknown>;
  const missing = conflicts.filter((conflict) => resolutions[conflict.field] !== "target" && resolutions[conflict.field] !== "source");
  if (missing.length) throw new HttpError(400, "Every metadata conflict must be resolved", { fields: missing.map((conflict) => conflict.field) });
  return resolutions as Record<string, ConflictResolution>;
}

function duplicateDecisionStatement(env: Env, actor: Actor, key: string, itemAId: string, itemBId: string, decision: "merged", metadata: unknown) {
  return env.MEDIA_LOG_DB.prepare(`
    INSERT INTO duplicate_decisions (pair_key, item_a_id, item_b_id, decision, actor_email, metadata_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(pair_key) DO UPDATE SET decision = excluded.decision, actor_email = excluded.actor_email,
      metadata_json = excluded.metadata_json, updated_at = excluded.updated_at
  `).bind(key, itemAId, itemBId, decision, actor.email, JSON.stringify(metadata));
}

function validatePairIds(first: unknown, second: unknown) {
  if (typeof first !== "string" || !first.trim() || typeof second !== "string" || !second.trim()) throw new HttpError(400, "Two item IDs are required");
  if (first.trim() === second.trim()) throw new HttpError(400, "Duplicate pair items must differ");
  return [first.trim(), second.trim()] as const;
}

function orderedPair(first: string, second: string) {
  return first < second ? [first, second] as const : [second, first] as const;
}

function pairKey(first: string, second: string) {
  const [a, b] = orderedPair(first, second);
  return `${a}::${b}`;
}

function normalizedTitleSql(alias: string) {
  return `lower(replace(replace(replace(replace(replace(replace(
    coalesce(nullif(trim(${alias}.official_title), ''), nullif(trim(${alias}.raw_title), ''), ''),
    ' ', ''), '　', ''), '-', ''), '_', ''), '：', ''), ':', ''))`;
}

function diceSimilarity(first: string, second: string) {
  if (!first || !second) return 0;
  if (first === second) return 1;
  const a = bigrams(first);
  const b = bigrams(second);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const gram of a) if (b.has(gram)) intersection += 1;
  return (2 * intersection) / (a.size + b.size);
}

function bigrams(value: string) {
  const result = new Set<string>();
  for (let index = 0; index < value.length - 1; index += 1) result.add(value.slice(index, index + 2));
  return result;
}

function overlapRatio(first: string[], second: string[]) {
  const a = new Set(first.map(normalizeEntityKey).filter(Boolean));
  const b = new Set(second.map(normalizeEntityKey).filter(Boolean));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / Math.min(a.size, b.size);
}

function sameNonEmpty(first: unknown, second: unknown) {
  const a = normalizeEntityKey(first);
  const b = normalizeEntityKey(second);
  return Boolean(a && a === b);
}

function unionStrings(first: string[], second: string[]) {
  const values = new Map<string, string>();
  for (const value of [...first, ...second]) {
    const key = normalizeEntityKey(value);
    if (key && !values.has(key)) values.set(key, value.trim());
  }
  return Array.from(values.values());
}

function mergeNotes(target: string | null | undefined, source: string | null | undefined) {
  const a = trimText(target);
  const b = trimText(source);
  if (!a) return b || null;
  if (!b || a === b) return a;
  return `${a}\n\n${b}`;
}

function mergeJson(target: string | null | undefined, source: string | null | undefined) {
  const targetRaw = trimText(target);
  const sourceRaw = trimText(source);
  if (!targetRaw) return sourceRaw || null;
  if (!sourceRaw || targetRaw === sourceRaw) return targetRaw;
  const a = parseJson(targetRaw);
  const b = parseJson(sourceRaw);
  if (a && b) return JSON.stringify({ ...b, ...a, _duplicate_merge_source: b });
  return JSON.stringify({ _duplicate_merge_target_raw: targetRaw, _duplicate_merge_source_raw: sourceRaw });
}

function parseJson(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

function emptyValue(value: unknown) {
  return value === null || value === undefined || value === "";
}

function sameValue(first: unknown, second: unknown) {
  return JSON.stringify(first) === JSON.stringify(second);
}

function normalizedString(value: unknown) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
}

function trimText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function itemToInput(item: ItemRecord): ItemInput {
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, deleted_at: _deletedAt, ...input } = item;
  return input;
}
