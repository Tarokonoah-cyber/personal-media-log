import { HttpError } from "./http";
import { inboxWhereSql } from "./organization";
import { hasPrivateSignalValues, isPrivateMarker as isPrivateMarkerValue, privateItemWhereSql, publicItemWhereSql } from "./privacy";
import { newId, nowIso } from "./ids";
import type { Actor, Env, ItemInput, ItemListParams, ItemRecord, ItemStatus } from "./types";

type Row = Record<string, unknown>;

const itemColumns = [
  "id",
  "raw_title",
  "official_title",
  "original_title",
  "code",
  "type",
  "category",
  "platform",
  "release_year",
  "watched_at",
  "started_at",
  "completed_at",
  "planned_at",
  "rating",
  "rewatch_score",
  "favorite",
  "is_private",
  "status",
  "quick_note",
  "long_note",
  "source_url",
  "cover_url",
  "metadata_json",
  "progress_json",
  "created_at",
  "updated_at",
  "deleted_at"
].join(", ");

export async function listItems(env: Env, params: ItemListParams) {
  const where: string[] = [];
  const bind: unknown[] = [];

  if (params.status && params.status !== "all") {
    if (params.status === "inbox") {
      where.push(inboxWhereSql("items"));
    } else if (params.status === "organized") {
      where.push("items.status = 'complete'");
    } else {
      where.push("items.status = ?");
      bind.push(params.status);
    }
  } else {
    where.push("items.status != 'deleted'");
  }

  if (params.favorite) where.push("items.favorite = 1");
  if (params.privateOnly) where.push(privateItemWhereSql("items"));
  else if (!params.includePrivate) where.push(publicItemWhereSql("items"));
  if (params.highRated) where.push("items.rating >= 4");
  if (params.type) {
    where.push("items.type = ?");
    bind.push(params.type);
  }
  if (params.year) {
    where.push("items.release_year = ?");
    bind.push(params.year);
  }
  if (params.platform) {
    where.push("items.platform = ?");
    bind.push(params.platform);
  }
  if (params.watchedFrom) {
    where.push("items.watched_at >= ?");
    bind.push(params.watchedFrom);
  }
  if (params.watchedTo) {
    where.push("items.watched_at <= ?");
    bind.push(params.watchedTo);
  }
  if (params.tag) {
    where.push(`EXISTS (
      SELECT 1 FROM item_tags it
      JOIN tags t ON t.id = it.tag_id
      WHERE it.item_id = items.id AND t.name = ? COLLATE NOCASE
    )`);
    bind.push(params.tag);
  }
  if (params.query) {
    const like = `%${params.query.trim().toLowerCase()}%`;
    where.push(`(
      lower(coalesce(items.raw_title, '')) LIKE ?
      OR lower(coalesce(items.official_title, '')) LIKE ?
      OR lower(coalesce(items.original_title, '')) LIKE ?
      OR lower(coalesce(items.code, '')) LIKE ?
      OR lower(coalesce(items.quick_note, '')) LIKE ?
      OR lower(coalesce(items.long_note, '')) LIKE ?
      OR lower(coalesce(items.platform, '')) LIKE ?
      OR EXISTS (
        SELECT 1 FROM item_tags it
        JOIN tags t ON t.id = it.tag_id
        WHERE it.item_id = items.id AND lower(t.name) LIKE ?
      )
      OR EXISTS (
        SELECT 1 FROM item_people ip
        JOIN people p ON p.id = ip.person_id
        WHERE ip.item_id = items.id AND lower(p.name) LIKE ?
      )
    )`);
    bind.push(like, like, like, like, like, like, like, like, like);
  }

  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const offset = (page - 1) * pageSize;
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countStmt = env.MEDIA_LOG_DB.prepare(`SELECT COUNT(*) AS count FROM items ${whereSql}`).bind(...bind);
  const listStmt = env.MEDIA_LOG_DB
    .prepare(`SELECT ${itemColumns} FROM items ${whereSql} ORDER BY datetime(updated_at) DESC LIMIT ? OFFSET ?`)
    .bind(...bind, pageSize, offset);
  const [countResult, listResult] = await Promise.all([countStmt.first<{ count: number }>(), listStmt.all<Row>()]);
  const items = await hydrateItems(env, listResult.results || []);
  return {
    items,
    page,
    pageSize,
    total: countResult?.count || 0
  };
}

export async function getItem(env: Env, id: string) {
  const row = await env.MEDIA_LOG_DB.prepare(`SELECT ${itemColumns} FROM items WHERE id = ?`).bind(id).first<Row>();
  if (!row || row.status === "deleted") throw new HttpError(404, "Item not found");
  const [item] = await hydrateItems(env, [row]);
  return item;
}

export async function createItem(env: Env, actor: Actor, input: ItemInput) {
  const rawTitle = cleanString(input.raw_title);
  if (!rawTitle) throw new HttpError(400, "raw_title is required");

  const id = newId("item");
  const timestamp = nowIso();
  const normalized = normalizeInput(input);
  const status = normalized.status || "raw";

  await env.MEDIA_LOG_DB.batch([
    env.MEDIA_LOG_DB
      .prepare(`INSERT INTO items (
        id, raw_title, official_title, original_title, code, type, category, platform,
        release_year, watched_at, started_at, completed_at, planned_at, rating, rewatch_score,
        favorite, is_private, status, quick_note, long_note, source_url, cover_url, metadata_json,
        progress_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id,
        rawTitle,
        normalized.official_title,
        normalized.original_title,
        normalized.code,
        normalized.type,
        normalized.category,
        normalized.platform,
        normalized.release_year,
        normalized.watched_at,
        normalized.started_at,
        normalized.completed_at,
        normalized.planned_at,
        normalized.rating,
        normalized.rewatch_score,
        normalized.favorite ? 1 : 0,
        normalized.is_private ? 1 : 0,
        status,
        normalized.quick_note,
        normalized.long_note,
        normalized.source_url,
        normalized.cover_url,
        normalized.metadata_json,
        normalized.progress_json,
        timestamp,
        timestamp
      ),
    audit(env, actor, "create", "item", id, { raw_title: rawTitle })
  ]);

  await replaceRelations(env, id, normalized.tags, normalized.people, normalized.collections);
  return getItem(env, id);
}

export async function updateItem(env: Env, actor: Actor, id: string, input: ItemInput) {
  await getItem(env, id);
  const rawTitle = cleanString(input.raw_title);
  if (!rawTitle) throw new HttpError(400, "raw_title is required");
  const normalized = normalizeInput(input);
  const status = normalized.status || inferStatus(normalized);

  await env.MEDIA_LOG_DB.batch([
    env.MEDIA_LOG_DB
      .prepare(`UPDATE items SET
        raw_title = ?, official_title = ?, original_title = ?, code = ?, type = ?,
        category = ?, platform = ?, release_year = ?, watched_at = ?, started_at = ?,
        completed_at = ?, planned_at = ?, rating = ?, rewatch_score = ?, favorite = ?,
        is_private = ?, status = ?, quick_note = ?, long_note = ?, source_url = ?, cover_url = ?,
        metadata_json = ?, progress_json = ?, updated_at = ?
        WHERE id = ?`)
      .bind(
        rawTitle,
        normalized.official_title,
        normalized.original_title,
        normalized.code,
        normalized.type,
        normalized.category,
        normalized.platform,
        normalized.release_year,
        normalized.watched_at,
        normalized.started_at,
        normalized.completed_at,
        normalized.planned_at,
        normalized.rating,
        normalized.rewatch_score,
        normalized.favorite ? 1 : 0,
        normalized.is_private ? 1 : 0,
        status,
        normalized.quick_note,
        normalized.long_note,
        normalized.source_url,
        normalized.cover_url,
        normalized.metadata_json,
        normalized.progress_json,
        nowIso(),
        id
      ),
    audit(env, actor, "update", "item", id, { status })
  ]);

  await replaceRelations(env, id, normalized.tags, normalized.people, normalized.collections);
  return getItem(env, id);
}

export async function softDeleteItem(env: Env, actor: Actor, id: string) {
  await getItem(env, id);
  await env.MEDIA_LOG_DB.batch([
    env.MEDIA_LOG_DB
      .prepare("UPDATE items SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ?")
      .bind(nowIso(), nowIso(), id),
    audit(env, actor, "soft_delete", "item", id, {})
  ]);
}

export async function exportItems(env: Env) {
  const rows = await env.MEDIA_LOG_DB.prepare(`SELECT ${itemColumns} FROM items WHERE status != 'deleted' ORDER BY datetime(created_at) ASC`).all<Row>();
  return hydrateItems(env, rows.results || []);
}

export async function getStats(env: Env, includePrivate = false) {
  const year = new Date().getFullYear().toString();
  const visibleSql = includePrivate ? "items.status != 'deleted'" : `items.status != 'deleted' AND ${publicItemWhereSql("items")}`;
  const visibleItemsSql = visibleSql;
  const inboxSql = includePrivate ? inboxWhereSql("items") : `${inboxWhereSql("items")} AND ${publicItemWhereSql("items")}`;
  const [
    total,
    currentYear,
    average,
    inbox,
    top,
    recent,
    monthly,
    categories,
    platforms,
    tags
  ] = await Promise.all([
    env.MEDIA_LOG_DB.prepare(`SELECT COUNT(*) AS value FROM items WHERE ${visibleSql}`).first<{ value: number }>(),
    env.MEDIA_LOG_DB.prepare(`SELECT COUNT(*) AS value FROM items WHERE ${visibleSql} AND substr(coalesce(watched_at, created_at), 1, 4) = ?`).bind(year).first<{ value: number }>(),
    env.MEDIA_LOG_DB.prepare(`SELECT AVG(rating) AS value FROM items WHERE ${visibleSql} AND rating IS NOT NULL`).first<{ value: number }>(),
    env.MEDIA_LOG_DB.prepare(`SELECT COUNT(*) AS value FROM items WHERE ${inboxSql}`).first<{ value: number }>(),
    env.MEDIA_LOG_DB.prepare(`SELECT ${itemColumns} FROM items WHERE ${visibleSql} AND rating IS NOT NULL ORDER BY rating DESC, datetime(updated_at) DESC LIMIT 20`).all<Row>(),
    env.MEDIA_LOG_DB.prepare(`SELECT ${itemColumns} FROM items WHERE ${visibleSql} ORDER BY datetime(coalesce(watched_at, updated_at)) DESC LIMIT 12`).all<Row>(),
    env.MEDIA_LOG_DB.prepare(`SELECT substr(coalesce(watched_at, created_at), 1, 7) AS month, COUNT(*) AS count FROM items WHERE ${visibleSql} GROUP BY month ORDER BY month DESC LIMIT 18`).all(),
    env.MEDIA_LOG_DB.prepare(`SELECT coalesce(category, '未分類') AS name, COUNT(*) AS count FROM items WHERE ${visibleSql} GROUP BY coalesce(category, '未分類') ORDER BY count DESC`).all(),
    env.MEDIA_LOG_DB.prepare(`SELECT coalesce(platform, '未設定') AS name, COUNT(*) AS count FROM items WHERE ${visibleSql} GROUP BY coalesce(platform, '未設定') ORDER BY count DESC`).all(),
    env.MEDIA_LOG_DB.prepare(`SELECT tags.name AS name, COUNT(*) AS count FROM tags JOIN item_tags ON item_tags.tag_id = tags.id JOIN items ON items.id = item_tags.item_id WHERE ${visibleItemsSql} GROUP BY tags.id ORDER BY count DESC, tags.name ASC LIMIT 100`).all()
  ]);

  return {
    total: total?.value || 0,
    currentYear: currentYear?.value || 0,
    averageRating: Number((average?.value || 0).toFixed(2)),
    inbox: inbox?.value || 0,
    top: await hydrateItems(env, top.results || []),
    recent: await hydrateItems(env, recent.results || []),
    monthly: monthly.results || [],
    categories: categories.results || [],
    platforms: platforms.results || [],
    tags: tags.results || []
  };
}
export async function importItems(env: Env, actor: Actor, rows: ItemInput[], sourceName: string, sourceType: "csv" | "json") {
  const jobId = newId("import");
  let imported = 0;
  let skipped = 0;
  const duplicates: string[] = [];

  await env.MEDIA_LOG_DB.prepare("INSERT INTO import_jobs (id, source_name, source_type, row_count) VALUES (?, ?, ?, ?)")
    .bind(jobId, sourceName, sourceType, rows.length)
    .run();

  for (const row of rows) {
    const rawTitle = cleanString(row.raw_title);
    if (!rawTitle) {
      skipped += 1;
      continue;
    }
    if (await isLikelyDuplicate(env, row)) {
      skipped += 1;
      duplicates.push(rawTitle);
      continue;
    }
    await createItem(env, actor, { ...row, raw_title: rawTitle, status: row.status || inferStatus(normalizeInput(row)) });
    imported += 1;
  }

  const summary = { duplicates: duplicates.slice(0, 50) };
  await env.MEDIA_LOG_DB.prepare(`UPDATE import_jobs SET imported_count = ?, skipped_count = ?, completed_at = ?, summary_json = ? WHERE id = ?`)
    .bind(imported, skipped, nowIso(), JSON.stringify(summary), jobId)
    .run();

  return { jobId, imported, skipped, duplicates };
}

export async function isLikelyDuplicate(env: Env, input: ItemInput) {
  const code = cleanString(input.code);
  const rawTitle = cleanString(input.raw_title)?.toLowerCase();
  const officialTitle = cleanString(input.official_title)?.toLowerCase();
  const watchedAt = cleanString(input.watched_at);

  if (code) {
    const existing = await env.MEDIA_LOG_DB.prepare("SELECT id FROM items WHERE status != 'deleted' AND code = ? LIMIT 1").bind(code).first();
    if (existing) return true;
  }

  if ((rawTitle || officialTitle) && watchedAt) {
    const existing = await env.MEDIA_LOG_DB
      .prepare(`SELECT id FROM items WHERE status != 'deleted' AND watched_at = ? AND (
        lower(raw_title) IN (?, ?) OR lower(coalesce(official_title, '')) IN (?, ?)
      ) LIMIT 1`)
      .bind(watchedAt, rawTitle || "", officialTitle || "", rawTitle || "", officialTitle || "")
      .first();
    return Boolean(existing);
  }

  return false;
}

async function hydrateItems(env: Env, rows: Row[]): Promise<ItemRecord[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => String(row.id));
  const placeholders = ids.map(() => "?").join(", ");
  const [tagRows, peopleRows, collectionRows] = await Promise.all([
    env.MEDIA_LOG_DB.prepare(`SELECT item_tags.item_id, tags.name FROM item_tags JOIN tags ON tags.id = item_tags.tag_id WHERE item_tags.item_id IN (${placeholders}) ORDER BY tags.name`).bind(...ids).all<{ item_id: string; name: string }>(),
    env.MEDIA_LOG_DB.prepare(`SELECT item_people.item_id, people.name FROM item_people JOIN people ON people.id = item_people.person_id WHERE item_people.item_id IN (${placeholders}) ORDER BY people.name`).bind(...ids).all<{ item_id: string; name: string }>(),
    env.MEDIA_LOG_DB.prepare(`SELECT collection_items.item_id, collections.name FROM collection_items JOIN collections ON collections.id = collection_items.collection_id WHERE collection_items.item_id IN (${placeholders}) ORDER BY collections.name`).bind(...ids).all<{ item_id: string; name: string }>()
  ]);

  const tags = groupByItem(tagRows.results || []);
  const people = groupByItem(peopleRows.results || []);
  const collections = groupByItem(collectionRows.results || []);

  return rows.map((row) => ({
    id: String(row.id),
    raw_title: String(row.raw_title || ""),
    official_title: nullableString(row.official_title),
    original_title: nullableString(row.original_title),
    code: nullableString(row.code),
    type: nullableString(row.type),
    category: nullableString(row.category),
    platform: nullableString(row.platform),
    release_year: nullableNumber(row.release_year),
    watched_at: nullableString(row.watched_at),
    started_at: nullableString(row.started_at),
    completed_at: nullableString(row.completed_at),
    planned_at: nullableString(row.planned_at),
    rating: nullableNumber(row.rating),
    rewatch_score: nullableNumber(row.rewatch_score),
    favorite: Boolean(row.favorite),
    is_private: Boolean(row.is_private),
    status: String(row.status || "raw") as ItemStatus,
    quick_note: nullableString(row.quick_note),
    long_note: nullableString(row.long_note),
    source_url: nullableString(row.source_url),
    cover_url: nullableString(row.cover_url),
    metadata_json: nullableString(row.metadata_json),
    progress_json: nullableString(row.progress_json),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    deleted_at: nullableString(row.deleted_at),
    tags: tags.get(String(row.id)) || [],
    people: people.get(String(row.id)) || [],
    collections: collections.get(String(row.id)) || []
  }));
}

function groupByItem(rows: { item_id: string; name: string }[]) {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.item_id) || [];
    list.push(row.name);
    map.set(row.item_id, list);
  }
  return map;
}

async function replaceRelations(env: Env, itemId: string, tags: string[], people: string[], collections: string[]) {
  const statements: D1PreparedStatement[] = [
    env.MEDIA_LOG_DB.prepare("DELETE FROM item_tags WHERE item_id = ?").bind(itemId),
    env.MEDIA_LOG_DB.prepare("DELETE FROM item_people WHERE item_id = ?").bind(itemId),
    env.MEDIA_LOG_DB.prepare("DELETE FROM collection_items WHERE item_id = ?").bind(itemId)
  ];

  for (const tag of uniqueClean(tags)) {
    const tagId = newId("tag");
    statements.push(env.MEDIA_LOG_DB.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)").bind(tagId, tag));
    statements.push(env.MEDIA_LOG_DB.prepare("INSERT OR IGNORE INTO item_tags (item_id, tag_id) SELECT ?, id FROM tags WHERE name = ? COLLATE NOCASE").bind(itemId, tag));
  }
  for (const person of uniqueClean(people)) {
    const personId = newId("person");
    statements.push(env.MEDIA_LOG_DB.prepare("INSERT OR IGNORE INTO people (id, name) VALUES (?, ?)").bind(personId, person));
    statements.push(env.MEDIA_LOG_DB.prepare("INSERT OR IGNORE INTO item_people (item_id, person_id, role) SELECT ?, id, '' FROM people WHERE name = ? COLLATE NOCASE").bind(itemId, person));
  }
  let position = 0;
  for (const collection of uniqueClean(collections)) {
    const collectionId = newId("collection");
    statements.push(env.MEDIA_LOG_DB.prepare("INSERT OR IGNORE INTO collections (id, name) VALUES (?, ?)").bind(collectionId, collection));
    statements.push(env.MEDIA_LOG_DB.prepare("INSERT OR IGNORE INTO collection_items (collection_id, item_id, position) SELECT id, ?, ? FROM collections WHERE name = ? COLLATE NOCASE").bind(itemId, position, collection));
    position += 1;
  }

  await env.MEDIA_LOG_DB.batch(statements);
}

function normalizeInput(input: ItemInput): Required<ItemInput> {
  return {
    raw_title: cleanString(input.raw_title) || "",
    official_title: cleanString(input.official_title),
    original_title: cleanString(input.original_title),
    code: cleanString(input.code),
    type: cleanString(input.type),
    category: cleanString(input.category),
    platform: cleanString(input.platform),
    release_year: nullableNumber(input.release_year),
    watched_at: cleanString(input.watched_at),
    started_at: cleanString(input.started_at),
    completed_at: cleanString(input.completed_at),
    planned_at: cleanString(input.planned_at),
    rating: clampNumber(input.rating, 0, 5),
    rewatch_score: clampNumber(input.rewatch_score, 0, 5),
    favorite: Boolean(input.favorite),
    is_private: Boolean(input.is_private) || hasPrivateSignal(input),
    status: input.status || "raw",
    quick_note: cleanString(input.quick_note),
    long_note: cleanString(input.long_note),
    source_url: cleanString(input.source_url),
    cover_url: cleanString(input.cover_url),
    metadata_json: cleanString(input.metadata_json),
    progress_json: cleanString(input.progress_json),
    tags: (input.tags || []).filter((tag) => !isPrivateMarkerValue(tag)),
    people: input.people || [],
    collections: input.collections || []
  };
}

function hasPrivateSignal(input: ItemInput) {
  const genres = (input as { genres?: any }).genres;
  return hasPrivateSignalValues([
    input.type,
    input.category,
    input.platform,
    input.metadata_json,
    ...(input.tags || []),
    ...(Array.isArray(genres) ? genres.map(String) : typeof genres === "string" ? [genres] : [])
  ]);
  const text = [
    input.type,
    input.category,
    input.platform,
    input.metadata_json,
    ...(input.tags || []),
    ...(Array.isArray(genres) ? genres.map(String) : typeof genres === "string" ? [genres] : [])
  ].filter(Boolean).join(" ").toLowerCase();
  return ["adult", "nsfw", "private", "?犖", "蝘?"].some((term) => text.includes(term.toLowerCase()));
}

function isPrivateMarker(value: string) {
  const text = value.trim().toLowerCase();
  return text === "adult" || text === "nsfw" || text === "private" || text === "成人" || text === "私密";
}

function inferStatus(input: Required<ItemInput>): ItemStatus {
  const hasOrganizedTitle = Boolean(input.official_title || input.original_title || input.code);
  const hasClassification = Boolean(input.type || input.category || input.platform || input.tags.length || input.people.length);
  if (hasOrganizedTitle && hasClassification) return "complete";
  if (hasOrganizedTitle || hasClassification || input.rating || input.long_note) return "partial";
  return "raw";
}

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length ? cleaned : null;
}

function uniqueClean(values: string[]) {
  return Array.from(new Set(values.map(cleanString).filter((value): value is string => Boolean(value))));
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampNumber(value: unknown, min: number, max: number) {
  const number = nullableNumber(value);
  if (number === null) return null;
  return Math.min(max, Math.max(min, number));
}

function audit(env: Env, actor: Actor, action: string, entityType: string, entityId: string, metadata: unknown) {
  return env.MEDIA_LOG_DB
    .prepare("INSERT INTO audit_logs (id, actor_email, action, entity_type, entity_id, metadata_json) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(newId("audit"), actor.email, action, entityType, entityId, JSON.stringify(metadata));
}
