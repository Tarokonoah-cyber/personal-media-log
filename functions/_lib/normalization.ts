import { HttpError } from "./http";
import { newId } from "./ids";
import { normalizeEntityKey } from "./metadataQuality";
import type { Actor, Env } from "./types";

export const entityTypes = ["tag", "person", "maker", "platform"] as const;
export type EntityType = (typeof entityTypes)[number];
type MergeableEntityType = Extract<EntityType, "tag" | "person">;

type EntityValueRow = { value: string; count: number };
type RelationRow = { item_id: string; role?: string | null };

export function isEntityType(value: unknown): value is EntityType {
  return typeof value === "string" && entityTypes.includes(value as EntityType);
}

export async function getNormalizationOverview(env: Env, entityType: EntityType, query = "", limit = 500) {
  const safeLimit = Math.min(5000, Math.max(1, limit));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const values = await listEntityValues(env, entityType, normalizedQuery, safeLimit);
  const registered = await env.MEDIA_LOG_DB.prepare(`
    SELECT c.id, c.canonical_value, c.normalized_key, a.alias_value, a.normalized_key AS alias_key
    FROM entity_canonicals c
    LEFT JOIN entity_aliases a ON a.canonical_id = c.id
    WHERE c.entity_type = ?
    ORDER BY c.canonical_value, a.alias_value
  `).bind(entityType).all<{ id: string; canonical_value: string; normalized_key: string; alias_value: string | null; alias_key: string | null }>();

  const groups = new Map<string, EntityValueRow[]>();
  for (const row of values) {
    const key = normalizeEntityKey(row.value);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) || []), { value: row.value, count: Number(row.count || 0) }]);
  }
  const canonicals = new Map<string, { id: string; canonical: string; aliases: string[] }>();
  for (const row of registered.results || []) {
    const current = canonicals.get(row.normalized_key) || { id: row.id, canonical: row.canonical_value, aliases: [] };
    if (row.alias_value) current.aliases.push(row.alias_value);
    canonicals.set(row.normalized_key, current);
  }
  const keys = new Set([...groups.keys(), ...canonicals.keys()]);
  const clusters = Array.from(keys).map((key) => {
    const variants = groups.get(key) || [];
    const canonical = canonicals.get(key);
    return {
      normalizedKey: key,
      canonical: canonical?.canonical || preferredDisplayValue(variants.map((variant) => variant.value)),
      canonicalId: canonical?.id || null,
      aliases: Array.from(new Set([...(canonical?.aliases || []), ...variants.map((variant) => variant.value)])),
      variants,
      affectedItems: variants.reduce((sum, variant) => sum + variant.count, 0),
      needsReview: variants.length > 1 || Boolean(canonical && canonical.aliases.length > 0)
    };
  }).filter((cluster) => cluster.needsReview || normalizedQuery.length > 0)
    .sort((left, right) => right.affectedItems - left.affectedItems || left.canonical.localeCompare(right.canonical, "zh-Hant"));
  return { entityType, scanned: values.length, clusters: clusters.slice(0, safeLimit) };
}

export async function registerEntityAlias(
  env: Env,
  actor: Actor,
  entityType: EntityType,
  canonicalValue: unknown,
  aliasValue: unknown
) {
  const canonical = cleanRequired(canonicalValue, "canonicalValue");
  const alias = cleanRequired(aliasValue, "aliasValue");
  const canonicalKey = normalizeEntityKey(canonical);
  const aliasKey = normalizeEntityKey(alias);
  if (!canonicalKey || !aliasKey) throw new HttpError(400, "Canonical and alias values must contain searchable characters");
  const canonicalId = newId("canonical");
  await env.MEDIA_LOG_DB.batch([
    env.MEDIA_LOG_DB.prepare(`
      INSERT OR IGNORE INTO entity_canonicals (id, entity_type, canonical_value, normalized_key)
      VALUES (?, ?, ?, ?)
    `).bind(canonicalId, entityType, canonical, canonicalKey),
    env.MEDIA_LOG_DB.prepare(`
      INSERT OR IGNORE INTO entity_aliases (id, canonical_id, alias_value, normalized_key)
      SELECT ?, id, ?, ? FROM entity_canonicals WHERE entity_type = ? AND normalized_key = ?
    `).bind(newId("alias"), alias, aliasKey, entityType, canonicalKey),
    audit(env, actor, "register_entity_alias", entityType, canonicalKey, { canonical, alias, aliasKey })
  ]);
  return { entityType, canonical, canonicalKey, alias, aliasKey, dataChanged: false };
}

export async function previewEntityMerge(
  env: Env,
  entityType: MergeableEntityType,
  sourceValue: unknown,
  targetValue: unknown
) {
  const source = cleanRequired(sourceValue, "sourceValue");
  const target = cleanRequired(targetValue, "targetValue");
  if (source.toLocaleLowerCase() === target.toLocaleLowerCase()) throw new HttpError(400, "Source and target must differ");
  const sourceEntity = await getStoredEntity(env, entityType, source);
  const targetEntity = await getStoredEntity(env, entityType, target);
  if (!sourceEntity || !targetEntity) throw new HttpError(404, "Both source and target entities must already exist");
  const [sourceRelations, targetRelations] = await Promise.all([
    getEntityRelations(env, entityType, sourceEntity.id),
    getEntityRelations(env, entityType, targetEntity.id)
  ]);
  const relationKey = (row: RelationRow) => `${row.item_id}:${row.role || ""}`;
  const targetKeys = new Set(targetRelations.map(relationKey));
  return {
    entityType,
    source: sourceEntity,
    target: targetEntity,
    affectedItems: new Set(sourceRelations.map((row) => row.item_id)).size,
    sourceRelations: sourceRelations.length,
    targetRelations: targetRelations.length,
    duplicateRelationsAvoided: sourceRelations.filter((row) => targetKeys.has(relationKey(row))).length,
    before: { source, target },
    after: { canonical: target, aliasAdded: source },
    requiresConfirmation: true
  };
}

export async function applyEntityMerge(
  env: Env,
  actor: Actor,
  entityType: MergeableEntityType,
  sourceValue: unknown,
  targetValue: unknown,
  confirmed: unknown
) {
  if (confirmed !== true) throw new HttpError(400, "confirmed=true is required after preview");
  const preview = await previewEntityMerge(env, entityType, sourceValue, targetValue);
  const sourceRelations = await getEntityRelations(env, entityType, preview.source.id);
  const targetRelations = await getEntityRelations(env, entityType, preview.target.id);
  const registrationBefore = await getRegisteredAliasState(env, entityType, preview.source.name, preview.target.name);
  const mergeId = newId("entity_merge");
  const snapshot = {
    source: preview.source,
    target: preview.target,
    sourceRelations,
    targetRelations,
    registrationBefore
  };
  const canonicalKey = normalizeEntityKey(preview.target.name);
  const canonicalId = newId("canonical");
  const statements: D1PreparedStatement[] = [
    env.MEDIA_LOG_DB.prepare(`
      INSERT INTO entity_merge_jobs (id, entity_type, source_value, target_value, snapshot_json, actor_email)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(mergeId, entityType, preview.source.name, preview.target.name, JSON.stringify(snapshot), actor.email)
  ];

  if (entityType === "tag") {
    statements.push(
      env.MEDIA_LOG_DB.prepare("INSERT OR IGNORE INTO item_tags (item_id, tag_id) SELECT item_id, ? FROM item_tags WHERE tag_id = ?").bind(preview.target.id, preview.source.id),
      env.MEDIA_LOG_DB.prepare("DELETE FROM item_tags WHERE tag_id = ?").bind(preview.source.id),
      env.MEDIA_LOG_DB.prepare("DELETE FROM tags WHERE id = ?").bind(preview.source.id)
    );
  } else {
    statements.push(
      env.MEDIA_LOG_DB.prepare("INSERT OR IGNORE INTO item_people (item_id, person_id, role) SELECT item_id, ?, role FROM item_people WHERE person_id = ?").bind(preview.target.id, preview.source.id),
      env.MEDIA_LOG_DB.prepare("DELETE FROM item_people WHERE person_id = ?").bind(preview.source.id),
      env.MEDIA_LOG_DB.prepare("DELETE FROM people WHERE id = ?").bind(preview.source.id)
    );
  }
  statements.push(
    env.MEDIA_LOG_DB.prepare("INSERT OR IGNORE INTO entity_canonicals (id, entity_type, canonical_value, normalized_key) VALUES (?, ?, ?, ?)")
      .bind(canonicalId, entityType, preview.target.name, canonicalKey),
    env.MEDIA_LOG_DB.prepare(`
      INSERT OR IGNORE INTO entity_aliases (id, canonical_id, alias_value, normalized_key)
      SELECT ?, id, ?, ? FROM entity_canonicals WHERE entity_type = ? AND normalized_key = ?
    `).bind(newId("alias"), preview.source.name, normalizeEntityKey(preview.source.name), entityType, canonicalKey),
    audit(env, actor, "merge_entity", entityType, mergeId, {
      source: preview.source.name,
      target: preview.target.name,
      affectedItems: preview.affectedItems,
      recoveryJobId: mergeId
    })
  );
  await env.MEDIA_LOG_DB.batch(statements);
  return { ...preview, mergeId, applied: true, recoveryAvailable: true };
}

export async function rollbackEntityMerge(env: Env, actor: Actor, mergeId: string, confirmed: unknown) {
  if (confirmed !== true) throw new HttpError(400, "confirmed=true is required for rollback");
  const job = await env.MEDIA_LOG_DB.prepare(`
    SELECT id, entity_type, snapshot_json, status FROM entity_merge_jobs WHERE id = ?
  `).bind(mergeId).first<{ id: string; entity_type: MergeableEntityType; snapshot_json: string; status: string }>();
  if (!job) throw new HttpError(404, "Merge recovery snapshot not found");
  if (job.status !== "applied") throw new HttpError(409, "Merge was already rolled back");
  const snapshot = JSON.parse(job.snapshot_json) as {
    source: { id: string; name: string };
    target: { id: string; name: string };
    sourceRelations: RelationRow[];
    targetRelations: RelationRow[];
    registrationBefore?: { canonicalExisted: boolean; aliasAlreadyRegistered: boolean };
  };
  const targetKeys = new Set(snapshot.targetRelations.map((row) => `${row.item_id}:${row.role || ""}`));
  const movedOnly = snapshot.sourceRelations.filter((row) => !targetKeys.has(`${row.item_id}:${row.role || ""}`));
  const statements: D1PreparedStatement[] = [];
  if (job.entity_type === "tag") {
    statements.push(env.MEDIA_LOG_DB.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)").bind(snapshot.source.id, snapshot.source.name));
    if (movedOnly.length) {
      statements.push(env.MEDIA_LOG_DB.prepare(`
        DELETE FROM item_tags WHERE tag_id = ?
          AND item_id IN (SELECT json_extract(value, '$.item_id') FROM json_each(?))
      `).bind(snapshot.target.id, JSON.stringify(movedOnly)));
    }
    if (snapshot.sourceRelations.length) {
      statements.push(env.MEDIA_LOG_DB.prepare(`
        INSERT OR IGNORE INTO item_tags (item_id, tag_id)
        SELECT json_extract(value, '$.item_id'), tags.id FROM json_each(?)
        JOIN tags ON tags.name = ? COLLATE NOCASE
      `).bind(JSON.stringify(snapshot.sourceRelations), snapshot.source.name));
    }
  } else {
    statements.push(env.MEDIA_LOG_DB.prepare("INSERT OR IGNORE INTO people (id, name) VALUES (?, ?)").bind(snapshot.source.id, snapshot.source.name));
    for (const relation of movedOnly) {
      statements.push(env.MEDIA_LOG_DB.prepare("DELETE FROM item_people WHERE item_id = ? AND person_id = ? AND coalesce(role, '') = ?")
        .bind(relation.item_id, snapshot.target.id, relation.role || ""));
    }
    for (const relation of snapshot.sourceRelations) {
      statements.push(env.MEDIA_LOG_DB.prepare(`
        INSERT OR IGNORE INTO item_people (item_id, person_id, role)
        SELECT ?, id, ? FROM people WHERE name = ? COLLATE NOCASE
      `).bind(relation.item_id, relation.role || "", snapshot.source.name));
    }
  }
  const canonicalKey = normalizeEntityKey(snapshot.target.name);
  if (!snapshot.registrationBefore?.aliasAlreadyRegistered) {
    statements.push(env.MEDIA_LOG_DB.prepare(`
      DELETE FROM entity_aliases
      WHERE canonical_id IN (
        SELECT id FROM entity_canonicals WHERE entity_type = ? AND normalized_key = ?
      ) AND normalized_key = ?
    `).bind(job.entity_type, canonicalKey, normalizeEntityKey(snapshot.source.name)));
  }
  if (snapshot.registrationBefore && !snapshot.registrationBefore.canonicalExisted) {
    statements.push(env.MEDIA_LOG_DB.prepare(`
      DELETE FROM entity_canonicals
      WHERE entity_type = ? AND normalized_key = ?
        AND NOT EXISTS (SELECT 1 FROM entity_aliases WHERE entity_aliases.canonical_id = entity_canonicals.id)
    `).bind(job.entity_type, canonicalKey));
  }
  statements.push(
    env.MEDIA_LOG_DB.prepare("UPDATE entity_merge_jobs SET status = 'rolled_back', rolled_back_at = datetime('now') WHERE id = ?").bind(mergeId),
    audit(env, actor, "rollback_entity_merge", job.entity_type, mergeId, { source: snapshot.source.name, target: snapshot.target.name })
  );
  await env.MEDIA_LOG_DB.batch(statements);
  return { mergeId, rolledBack: true };
}

async function listEntityValues(env: Env, entityType: EntityType, query: string, limit: number) {
  const like = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const sql = entityType === "tag"
    ? `SELECT tags.name AS value, COUNT(item_tags.item_id) AS count FROM tags LEFT JOIN item_tags ON item_tags.tag_id = tags.id WHERE (? = '' OR lower(tags.name) LIKE ? ESCAPE '\\') GROUP BY tags.id, tags.name ORDER BY count DESC, value LIMIT ?`
    : entityType === "person"
      ? `SELECT people.name AS value, COUNT(item_people.item_id) AS count FROM people LEFT JOIN item_people ON item_people.person_id = people.id WHERE (? = '' OR lower(people.name) LIKE ? ESCAPE '\\') GROUP BY people.id, people.name ORDER BY count DESC, value LIMIT ?`
      : entityType === "maker"
        ? `SELECT items.maker AS value, COUNT(*) AS count FROM items WHERE items.is_private = 1 AND items.status != 'deleted' AND items.maker IS NOT NULL AND trim(items.maker) != '' AND (? = '' OR lower(items.maker) LIKE ? ESCAPE '\\') GROUP BY items.maker ORDER BY count DESC, value LIMIT ?`
        : `SELECT items.platform AS value, COUNT(*) AS count FROM items WHERE items.is_private = 1 AND items.status != 'deleted' AND items.platform IS NOT NULL AND trim(items.platform) != '' AND (? = '' OR lower(items.platform) LIKE ? ESCAPE '\\') GROUP BY items.platform ORDER BY count DESC, value LIMIT ?`;
  const result = await env.MEDIA_LOG_DB.prepare(sql).bind(query, like, limit).all<EntityValueRow>();
  return result.results || [];
}

async function getStoredEntity(env: Env, entityType: MergeableEntityType, value: string) {
  const table = entityType === "tag" ? "tags" : "people";
  return env.MEDIA_LOG_DB.prepare(`SELECT id, name FROM ${table} WHERE name = ? COLLATE NOCASE LIMIT 1`)
    .bind(value).first<{ id: string; name: string }>();
}

async function getEntityRelations(env: Env, entityType: MergeableEntityType, id: string) {
  const sql = entityType === "tag"
    ? "SELECT item_id, '' AS role FROM item_tags WHERE tag_id = ? ORDER BY item_id"
    : "SELECT item_id, coalesce(role, '') AS role FROM item_people WHERE person_id = ? ORDER BY item_id, role";
  const result = await env.MEDIA_LOG_DB.prepare(sql).bind(id).all<RelationRow>();
  return result.results || [];
}

async function getRegisteredAliasState(env: Env, entityType: MergeableEntityType, source: string, target: string) {
  const canonicalKey = normalizeEntityKey(target);
  const sourceKey = normalizeEntityKey(source);
  const row = await env.MEDIA_LOG_DB.prepare(`
    SELECT id, EXISTS(
      SELECT 1 FROM entity_aliases WHERE canonical_id = entity_canonicals.id AND normalized_key = ?
    ) AS alias_exists
    FROM entity_canonicals
    WHERE entity_type = ? AND normalized_key = ?
  `).bind(sourceKey, entityType, canonicalKey).first<{ id: string; alias_exists: number }>();
  return { canonicalExisted: Boolean(row), aliasAlreadyRegistered: Boolean(row?.alias_exists) };
}

function preferredDisplayValue(values: string[]) {
  return [...values].sort((left, right) => left.length - right.length || left.localeCompare(right, "zh-Hant"))[0] || "";
}

function cleanRequired(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new HttpError(400, `${field} is required`);
  return value.trim();
}

function audit(env: Env, actor: Actor, action: string, entityType: string, entityId: string, metadata: unknown) {
  return env.MEDIA_LOG_DB.prepare(`
    INSERT INTO audit_logs (id, actor_email, action, entity_type, entity_id, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(newId("audit"), actor.email, action, entityType, entityId, JSON.stringify(metadata));
}
