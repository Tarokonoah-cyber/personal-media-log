import { HttpError } from "./http";
import { inboxWhereSql } from "./organization";
import { isPrivateMarker as isPrivateMarkerValue, privateItemWhereSql, publicItemWhereSql } from "./privacy";
import { newId, nowIso } from "./ids";
import { isCollectionLevel, normalizeCollectionLevel, normalizePlatform as normalizePrivatePlatform, normalizeWorkCode, validateQuickEdit } from "../../shared/privateModel";
import { privateStatusToFields } from "../../shared/privateStatus";
import type { Actor, Env, FavoriteLevel, ItemInput, ItemListParams, ItemRecord, ItemStatus, MediaStatus, WatchStatus, PrivateFacets, PrivateSummary } from "./types";

type Row = Record<string, unknown>;
type NormalizedInput = Required<ItemInput> & { search_text: string };

const itemColumns = [
  "id",
  "raw_title",
  "official_title",
  "original_title",
  "code",
  "type",
  "category",
  "platform",
  "maker",
  "series",
  "release_year",
  "release_date",
  "year",
  "watched_at",
  "started_at",
  "completed_at",
  "planned_at",
  "rating",
  "rewatch_score",
  "favorite",
  "favorite_level",
  "collection_level",
  "normalized_code",
  "used",
  "is_private",
  "status",
  "media_status",
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

const listItemColumns = itemColumns
  .split(", ")
  .filter((column) => column !== "long_note")
  .join(", ");

export async function listItems(env: Env, params: ItemListParams) {
  const { whereSql, bind } = buildItemWhere(params);
  const page = Math.max(1, params.page);
  const pageSize = Math.min(200, Math.max(1, params.pageSize));
  const offset = (page - 1) * pageSize;
  const orderSql = listOrderSql(params);

  const countStmt = env.MEDIA_LOG_DB.prepare(`SELECT COUNT(*) AS count FROM items ${whereSql}`).bind(...bind);
  const listStmt = env.MEDIA_LOG_DB
    .prepare(`SELECT ${listItemColumns} FROM items ${whereSql} ${orderSql} LIMIT ? OFFSET ?`)
    .bind(...bind, pageSize, offset);
  const summaryPromise = params.privateOnly
    ? getPrivateSummary(env, whereSql, bind).catch((error) => {
      console.error("Private summary query failed", error);
      return undefined;
    })
    : Promise.resolve(undefined);
  const facetsPromise = params.privateOnly && params.includeFacets
    ? getPrivateFacets(env, whereSql, bind).catch((error) => {
      console.error("Private facets query failed", error);
      return undefined;
    })
    : Promise.resolve(undefined);
  const [countResult, listResult, privateSummary, privateFacets] = await Promise.all([
    countStmt.first<{ count: number }>(),
    listStmt.all<Row>(),
    summaryPromise,
    facetsPromise
  ]);
  const items = await hydrateItems(env, listResult.results || []);
  return {
    items,
    page,
    pageSize,
    total: countResult?.count || 0,
    ...(privateSummary ? { privateSummary } : {}),
    ...(privateFacets ? { privateFacets } : {})
  };
}

export function buildItemWhere(params: ItemListParams) {
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
  if (params.watchStatus && params.watchStatus !== "all") {
    where.push(watchStatusWhereSql(params.watchStatus));
  }
  if (params.highRated) where.push("items.rating >= 9");
  if (params.ratingMin !== undefined) {
    where.push("items.rating >= ?");
    bind.push(params.ratingMin);
  }
  if (params.ratingMax !== undefined) {
    where.push("items.rating <= ?");
    bind.push(params.ratingMax);
  }
  if (params.unrated) where.push("items.rating IS NULL");
  if (params.privateStatus && params.privateStatus !== "all") {
    where.push(`${privateStatusSql("items")} = ?`);
    bind.push(params.privateStatus);
  } else {
    if (params.usedFilter === "used") {
      where.push("items.used = 1");
    } else if (params.usedFilter === "unused") {
      where.push("items.used = 0");
    }
    if (params.mediaStatus && params.mediaStatus !== "all") {
      where.push("items.media_status = ?");
      bind.push(params.mediaStatus);
    }
  }
  if (params.favoriteLevel && params.favoriteLevel !== "all") {
    where.push("items.favorite_level = ?");
    bind.push(params.favoriteLevel);
  }
  if (params.collectionLevel) {
    where.push(`(
      items.favorite_level = ?
      OR (
        json_valid(items.metadata_json) AND coalesce(
          json_extract(items.metadata_json, '$.reflection.collection_level'),
          json_extract(items.metadata_json, '$.collection_level')
        ) = ?
      )
    )`);
    bind.push(params.collectionLevel);
    bind.push(params.collectionLevel);
  }
  if (params.type) {
    where.push(typeWhereSql(params.type));
    bind.push(params.type, params.type, ...typeAliases(params.type).map((alias) => `%${alias.toLowerCase()}%`), ...typeAliases(params.type).map((alias) => `%${alias.toLowerCase()}%`));
  }
  if (params.category) {
    where.push("lower(coalesce(items.category, '')) = ?");
    bind.push(params.category.toLowerCase());
  }
  if (params.year) {
    where.push("coalesce(items.year, items.release_year) = ?");
    bind.push(params.year);
  }
  if (params.platform) {
    where.push("items.platform = ?");
    bind.push(params.platform);
  }
  if (params.platformFilters?.length) {
    const clauses: string[] = [];
    const directPlatforms = params.platformFilters.filter((value) => value !== "其他");
    if (directPlatforms.length) {
      clauses.push(`items.platform IN (${directPlatforms.map(() => "?").join(", ")})`);
      bind.push(...directPlatforms);
    }
    if (params.platformFilters.includes("其他")) {
      clauses.push("(items.platform IS NULL OR items.platform = '' OR items.platform NOT IN ('FC2', 'JAV'))");
    }
    if (clauses.length) where.push(`(${clauses.join(" OR ")})`);
  }
  if (params.maker) {
    where.push("items.maker = ?");
    bind.push(params.maker);
  }
  if (params.makerFilters?.length) {
    where.push(`items.maker IN (${params.makerFilters.map(() => "?").join(", ")})`);
    bind.push(...params.makerFilters);
  }
  if (params.favoriteLevelFilters?.length) {
    const includesUsed = params.favoriteLevelFilters.includes("used");
    const levels = params.favoriteLevelFilters.filter((level) => level !== "used");
    const clauses: string[] = [];
    if (includesUsed) clauses.push("items.used = 1");
    if (levels.length) {
      clauses.push(`(items.used = 0 AND items.collection_level IN (${levels.map(() => "?").join(", ")}))`);
      bind.push(...levels);
    }
    where.push(`(${clauses.join(" OR ")})`);
  }
  if (params.personFilters?.length) {
    const includesAmateur = params.personFilters.includes("素人");
    const namedPeople = params.personFilters.filter((person) => person !== "素人");
    const clauses: string[] = [];
    if (includesAmateur) clauses.push(`NOT EXISTS (SELECT 1 FROM item_people amateur_ip WHERE amateur_ip.item_id = items.id)`);
    if (includesAmateur || namedPeople.length) {
      const people = includesAmateur ? ["素人", ...namedPeople] : namedPeople;
      clauses.push(`EXISTS (
        SELECT 1 FROM item_people selected_ip
        JOIN people selected_people ON selected_people.id = selected_ip.person_id
        WHERE selected_ip.item_id = items.id AND selected_people.name IN (${people.map(() => "?").join(", ")})
      )`);
      bind.push(...people);
    }
    where.push(`(${clauses.join(" OR ")})`);
  }
  if (params.missingPeople) {
    where.push(`NOT EXISTS (
      SELECT 1 FROM item_people missing_ip
      WHERE missing_ip.item_id = items.id
    )`);
  }
  if (params.hasNote === "yes") {
    where.push("(coalesce(nullif(trim(items.quick_note), ''), nullif(trim(items.long_note), '')) IS NOT NULL)");
  } else if (params.hasNote === "no") {
    where.push("(coalesce(nullif(trim(items.quick_note), ''), nullif(trim(items.long_note), '')) IS NULL)");
  }
  if (params.hasCover === "yes") {
    where.push("(items.cover_url IS NOT NULL AND trim(items.cover_url) != '')");
  } else if (params.hasCover === "no") {
    where.push("(items.cover_url IS NULL OR trim(items.cover_url) = '')");
  }
  if (params.series) {
    where.push("items.series = ?");
    bind.push(params.series);
  }
  if (params.codeQuery) {
    const like = `%${params.codeQuery.trim().toLowerCase()}%`;
    where.push(`(
      lower(coalesce(items.code, '')) LIKE ?
      OR lower(coalesce(items.original_title, '')) LIKE ?
      OR lower(coalesce(items.raw_title, '')) LIKE ?
      OR lower(coalesce(items.metadata_json, '')) LIKE ?
    )`);
    bind.push(like, like, like, like);
  }
  if (params.titleQuery) {
    const like = `%${params.titleQuery.trim().toLowerCase()}%`;
    where.push(`(
      lower(coalesce(items.raw_title, '')) LIKE ?
      OR lower(coalesce(items.official_title, '')) LIKE ?
      OR lower(coalesce(items.original_title, '')) LIKE ?
      OR lower(coalesce(items.metadata_json, '')) LIKE ?
    )`);
    bind.push(like, like, like, like);
  }
  if (params.person) {
    const like = `%${params.person.trim().toLowerCase()}%`;
    where.push(`(
      lower(coalesce(items.metadata_json, '')) LIKE ?
      OR EXISTS (
        SELECT 1 FROM item_people ip
        JOIN people p ON p.id = ip.person_id
        WHERE ip.item_id = items.id AND lower(p.name) LIKE ?
      )
    )`);
    bind.push(like, like);
  }
  if (params.studio) {
    const like = `%${params.studio.trim().toLowerCase()}%`;
    where.push(`(
      lower(coalesce(items.maker, '')) LIKE ?
      OR lower(coalesce(items.platform, '')) LIKE ?
      OR lower(coalesce(items.metadata_json, '')) LIKE ?
    )`);
    bind.push(like, like, like);
  }
  if (params.watchedFrom) {
    where.push("items.watched_at >= ?");
    bind.push(params.watchedFrom);
  }
  if (params.watchedTo) {
    where.push("items.watched_at <= ?");
    bind.push(params.watchedTo);
  }
  if (params.viewedFrom) {
    where.push("date(coalesce(items.watched_at, items.created_at)) >= date(?)");
    bind.push(params.viewedFrom);
  }
  if (params.viewedTo) {
    where.push("date(coalesce(items.watched_at, items.created_at)) <= date(?)");
    bind.push(params.viewedTo);
  }
  if (params.updatedFrom) {
    where.push("date(items.updated_at) >= date(?)");
    bind.push(params.updatedFrom);
  }
  if (params.updatedTo) {
    where.push("date(items.updated_at) <= date(?)");
    bind.push(params.updatedTo);
  }
  if (params.tag) {
    where.push(`EXISTS (
      SELECT 1 FROM item_tags it
      JOIN tags t ON t.id = it.tag_id
      WHERE it.item_id = items.id AND t.name = ? COLLATE NOCASE
    )`);
    bind.push(params.tag);
  }
  if (params.excludeTag) {
    where.push(`NOT EXISTS (
      SELECT 1 FROM item_tags excluded_it
      JOIN tags excluded_t ON excluded_t.id = excluded_it.tag_id
      WHERE excluded_it.item_id = items.id AND excluded_t.name = ? COLLATE NOCASE
    )`);
    bind.push(params.excludeTag);
  }
  if (params.query) {
    const like = `%${params.query.trim().toLowerCase()}%`;
    const fts = toFtsQuery(params.query);
    where.push(`(
      ${fts ? `EXISTS (
        SELECT 1 FROM items_search_fts
        WHERE items_search_fts.item_id = items.id
          AND items_search_fts MATCH ?
      ) OR` : ""}
      lower(coalesce(items.raw_title, '')) LIKE ?
      OR lower(coalesce(items.official_title, '')) LIKE ?
      OR lower(coalesce(items.original_title, '')) LIKE ?
      OR lower(coalesce(items.code, '')) LIKE ?
      OR lower(coalesce(items.quick_note, '')) LIKE ?
      OR lower(coalesce(items.platform, '')) LIKE ?
      OR lower(coalesce(items.maker, '')) LIKE ?
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
    if (fts) bind.push(fts);
    bind.push(like, like, like, like, like, like, like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return { whereSql, bind };
}

async function getPrivateSummary(env: Env, whereSql: string, bind: unknown[]): Promise<PrivateSummary> {
  const usedSql = "items.used = 1";
  const collectionWhereSql = whereSql
    ? `${whereSql} AND items.collection_level IS NOT NULL`
    : "WHERE items.collection_level IS NOT NULL";
  const totalsStmt = env.MEDIA_LOG_DB.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN ${usedSql} THEN 1 ELSE 0 END) AS used,
      AVG(items.rating) AS averageRating
    FROM items ${whereSql}
  `).bind(...bind);
  const collectionStmt = env.MEDIA_LOG_DB.prepare(`
    SELECT CASE WHEN items.used = 1 THEN 'used' ELSE items.collection_level END AS level, COUNT(*) AS count
    FROM items ${collectionWhereSql}
    GROUP BY level
    ORDER BY CASE level
      WHEN 'used' THEN 1
      WHEN 'masterpiece' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'discard' THEN 5
      ELSE 4
    END
  `).bind(...bind);
  const [totals, collections] = await Promise.all([
    totalsStmt.first<{ total: number; used: number | null; averageRating: number | null }>(),
    collectionStmt.all<{ level: string; count: number }>()
  ]);
  const total = Number(totals?.total || 0);
  const used = Number(totals?.used || 0);
  return {
    total,
    used,
    unused: Math.max(0, total - used),
    averageRating: totals?.averageRating === null || totals?.averageRating === undefined ? null : Number(totals.averageRating),
    collectionCounts: (collections.results || []).map((row) => ({
      level: String(row.level),
      count: Number(row.count)
    }))
  };
}

export async function getPrivateFacets(env: Env, whereSql = "WHERE items.is_private = 1", bind: unknown[] = []): Promise<PrivateFacets> {
  const query = { whereSql, bind };
  return getPrivateFacetsFromQueries(env, {
    source: query,
    maker: query,
    series: query,
    actress: query,
    javMaker: query,
    tags: query,
    ratingBuckets: query,
    favoriteLevel: query,
    used: query,
    status: query
  });
}

type FacetQuery = { whereSql: string; bind: unknown[] };
type PrivateFacetKind = keyof PrivateFacets;

async function getPrivateFacetsFromQueries(env: Env, queries: Record<PrivateFacetKind, FacetQuery>): Promise<PrivateFacets> {
  const bindRepeated = (query: FacetQuery, count: number) => Array.from({ length: count }).flatMap(() => query.bind);
  const facetRows = (rows: Array<{ value: string | null; count: number }>) =>
    rows
      .map((row) => ({ value: String(row.value || "未設定"), count: Number(row.count || 0) }))
      .filter((row) => row.value.trim().length > 0);
  const appendWhere = (query: FacetQuery, clause: string) => query.whereSql ? `${query.whereSql} AND ${clause}` : `WHERE ${clause}`;

  const sourceStmt = env.MEDIA_LOG_DB.prepare(`
    SELECT
      CASE
        WHEN items.platform IN ('FC2', 'JAV', '糖心') THEN items.platform
        ELSE '其他'
      END AS value,
      COUNT(*) AS count
    FROM items ${queries.source.whereSql}
    GROUP BY value
    ORDER BY CASE value
      WHEN 'FC2' THEN 1
      WHEN 'JAV' THEN 2
      WHEN '糖心' THEN 3
      ELSE 4
    END
  `).bind(...queries.source.bind);

  const makerStmt = env.MEDIA_LOG_DB.prepare(`
    SELECT coalesce(nullif(trim(items.maker), ''), '未設定') AS value, COUNT(*) AS count
    FROM items ${queries.maker.whereSql}
    GROUP BY value
    ORDER BY count DESC, value ASC
    LIMIT 20
  `).bind(...queries.maker.bind);

  const seriesStmt = env.MEDIA_LOG_DB.prepare(`
    SELECT coalesce(nullif(trim(items.series), ''), '未設定') AS value, COUNT(*) AS count
    FROM items ${queries.series.whereSql}
    GROUP BY value
    ORDER BY count DESC, value ASC
    LIMIT 20
  `).bind(...queries.series.bind);

  const actressStmt = env.MEDIA_LOG_DB.prepare(`
    SELECT value, SUM(count) AS count FROM (
      SELECT people.name AS value, COUNT(*) AS count
      FROM people
      JOIN item_people ON item_people.person_id = people.id
      JOIN items ON items.id = item_people.item_id
      ${queries.actress.whereSql}
      GROUP BY people.id
      UNION ALL
      SELECT '素人' AS value, COUNT(*) AS count
      FROM items ${appendWhere(queries.actress, "NOT EXISTS (SELECT 1 FROM item_people empty_ip WHERE empty_ip.item_id = items.id)")}
    )
    GROUP BY value
    ORDER BY count DESC, value ASC
    LIMIT 20
  `).bind(...queries.actress.bind, ...queries.actress.bind);

  const tagsStmt = env.MEDIA_LOG_DB.prepare(`
    SELECT tags.name AS value, COUNT(*) AS count
    FROM tags
    JOIN item_tags ON item_tags.tag_id = tags.id
    JOIN items ON items.id = item_tags.item_id
    ${queries.tags.whereSql}
    GROUP BY tags.id
    ORDER BY count DESC, tags.name ASC
    LIMIT 30
  `).bind(...queries.tags.bind);

  const javMakerStmt = env.MEDIA_LOG_DB.prepare(`
    SELECT coalesce(nullif(trim(items.maker), ''), '未分類') AS value, COUNT(*) AS count
    FROM items ${appendWhere(queries.javMaker, "items.platform = 'JAV'")}
    GROUP BY value
    ORDER BY CASE value
      WHEN 'S1' THEN 1
      WHEN 'SOD' THEN 2
      WHEN 'Prestige' THEN 3
      WHEN 'Moodyz' THEN 4
      WHEN 'FALENO' THEN 5
      WHEN '未分類' THEN 99
      ELSE 20
    END, count DESC, value ASC
    LIMIT 30
  `).bind(...queries.javMaker.bind);

  const ratingStmt = env.MEDIA_LOG_DB.prepare(`
    SELECT '5 星' AS value, SUM(CASE WHEN items.rating >= 9 THEN 1 ELSE 0 END) AS count FROM items ${queries.ratingBuckets.whereSql}
    UNION ALL
    SELECT '4 星' AS value, SUM(CASE WHEN items.rating >= 7 AND items.rating <= 8 THEN 1 ELSE 0 END) AS count FROM items ${queries.ratingBuckets.whereSql}
    UNION ALL
    SELECT '3 星' AS value, SUM(CASE WHEN items.rating >= 5 AND items.rating <= 6 THEN 1 ELSE 0 END) AS count FROM items ${queries.ratingBuckets.whereSql}
    UNION ALL
    SELECT '1–2 星' AS value, SUM(CASE WHEN items.rating >= 1 AND items.rating <= 4 THEN 1 ELSE 0 END) AS count FROM items ${queries.ratingBuckets.whereSql}
    UNION ALL
    SELECT '未評分' AS value, SUM(CASE WHEN items.rating IS NULL THEN 1 ELSE 0 END) AS count FROM items ${queries.ratingBuckets.whereSql}
  `).bind(...bindRepeated(queries.ratingBuckets, 5));

  const favoriteStmt = env.MEDIA_LOG_DB.prepare(`
    SELECT CASE WHEN items.used = 1 THEN 'used' ELSE items.collection_level END AS value, COUNT(*) AS count
    FROM items ${appendWhere(queries.favoriteLevel, "items.collection_level IN ('unset', 'masterpiece', 'normal', 'discard')")}
    GROUP BY value
    ORDER BY CASE value
      WHEN 'used' THEN 1
      WHEN 'masterpiece' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'discard' THEN 5
      ELSE 4
    END
  `).bind(...queries.favoriteLevel.bind);

  const usedStmt = env.MEDIA_LOG_DB.prepare(`
    SELECT '已閱' AS value, SUM(CASE WHEN items.used = 1 THEN 1 ELSE 0 END) AS count FROM items ${queries.used.whereSql}
    UNION ALL
    SELECT '未閱' AS value, SUM(CASE WHEN items.used = 0 THEN 1 ELSE 0 END) AS count FROM items ${queries.used.whereSql}
  `).bind(...bindRepeated(queries.used, 2));

  const statusStmt = env.MEDIA_LOG_DB.prepare(`
    SELECT items.media_status AS value, COUNT(*) AS count
    FROM items ${appendWhere(queries.status, "items.media_status IS NOT NULL AND items.media_status != ''")}
    GROUP BY items.media_status
    ORDER BY CASE items.media_status
      WHEN '待觀看' THEN 1
      WHEN '已觀看' THEN 2
      WHEN '想重看' THEN 3
      WHEN '已刪除' THEN 4
      ELSE 5
    END
  `).bind(...queries.status.bind);

  const [source, maker, series, actress, javMaker, tags, ratingBuckets, favoriteLevel, used, status] = await Promise.all([
    sourceStmt.all<{ value: string; count: number }>(),
    makerStmt.all<{ value: string; count: number }>(),
    seriesStmt.all<{ value: string; count: number }>(),
    actressStmt.all<{ value: string; count: number }>(),
    javMakerStmt.all<{ value: string; count: number }>(),
    tagsStmt.all<{ value: string; count: number }>(),
    ratingStmt.all<{ value: string; count: number }>(),
    favoriteStmt.all<{ value: string; count: number }>(),
    usedStmt.all<{ value: string; count: number }>(),
    statusStmt.all<{ value: string; count: number }>()
  ]);

  return {
    source: facetRows(source.results || []),
    maker: facetRows(maker.results || []),
    series: facetRows(series.results || []),
    actress: facetRows(actress.results || []),
    javMaker: facetRows(javMaker.results || []),
    tags: facetRows(tags.results || []),
    ratingBuckets: facetRows(ratingBuckets.results || []),
    favoriteLevel: facetRows(favoriteLevel.results || []),
    used: facetRows(used.results || []),
    status: facetRows(status.results || [])
  };
}

export async function getPrivateFacetsForFilters(env: Env, params: ItemListParams) {
  const base = { ...params, privateOnly: true, includePrivate: true, includeFacets: false, page: 1, pageSize: 1 };
  const queryFor = (facet: PrivateFacetKind) => buildItemWhere(filtersExcludingFacet(base, facet));
  return getPrivateFacetsFromQueries(env, {
    source: queryFor("source"),
    maker: queryFor("maker"),
    series: queryFor("series"),
    actress: queryFor("actress"),
    javMaker: queryFor("javMaker"),
    tags: queryFor("tags"),
    ratingBuckets: queryFor("ratingBuckets"),
    favoriteLevel: queryFor("favoriteLevel"),
    used: queryFor("used"),
    status: queryFor("status")
  });
}

export function filtersExcludingFacet(params: ItemListParams, facet: PrivateFacetKind): ItemListParams {
  const next = { ...params };
  if (facet === "source") next.platformFilters = [];
  if (facet === "maker" || facet === "javMaker") next.makerFilters = [];
  if (facet === "favoriteLevel") next.favoriteLevelFilters = [];
  if (facet === "actress") {
    next.personFilters = [];
    next.missingPeople = false;
  }
  if (facet === "tags") next.tag = undefined;
  if (facet === "ratingBuckets") {
    next.ratingMin = undefined;
    next.ratingMax = undefined;
    next.unrated = false;
  }
  if (facet === "used") {
    next.usedFilter = "all";
    next.privateStatus = "all";
  }
  if (facet === "status") {
    next.mediaStatus = "all";
    next.privateStatus = "all";
  }
  return next;
}

export function privateStatusSql(alias: string) {
  return `(CASE
    WHEN ${alias}.media_status = '想重看' THEN 'rewatch'
    WHEN ${alias}.media_status = '已刪除' THEN 'excluded'
    WHEN ${alias}.used = 0 OR ${alias}.media_status = '待觀看' THEN 'pending'
    ELSE 'done'
  END)`;
}

export async function searchPrivateFacet(env: Env, facet: "actress" | "tag" | "studio", query: string, limit: number) {
  const safeLimit = Math.min(50, Math.max(1, limit));
  const normalizedQuery = query.trim().toLowerCase();
  const like = `%${normalizedQuery.replace(/[\\%_]/g, "\\$&")}%`;
  if (facet === "actress") {
    const result = await env.MEDIA_LOG_DB.prepare(`
      SELECT people.name AS value, COUNT(DISTINCT item_people.item_id) AS count
      FROM people
      JOIN item_people ON item_people.person_id = people.id
      JOIN items ON items.id = item_people.item_id
      WHERE items.is_private = 1 AND items.status != 'deleted'
        AND (? = '' OR lower(trim(people.name)) LIKE ? ESCAPE '\\')
      GROUP BY people.id, people.name
      ORDER BY count DESC, value COLLATE NOCASE
      LIMIT ?
    `).bind(normalizedQuery, like, safeLimit).all<{ value: string; count: number }>();
    return (result.results || []).map((row) => ({ value: row.value, label: row.value, count: Number(row.count) }));
  }
  if (facet === "tag") {
    const result = await env.MEDIA_LOG_DB.prepare(`
      SELECT tags.name AS value, COUNT(DISTINCT item_tags.item_id) AS count
      FROM tags
      JOIN item_tags ON item_tags.tag_id = tags.id
      JOIN items ON items.id = item_tags.item_id
      WHERE items.is_private = 1 AND items.status != 'deleted'
        AND (? = '' OR lower(trim(tags.name)) LIKE ? ESCAPE '\\')
      GROUP BY tags.id, tags.name
      ORDER BY count DESC, value COLLATE NOCASE
      LIMIT ?
    `).bind(normalizedQuery, like, safeLimit).all<{ value: string; count: number }>();
    return (result.results || []).map((row) => ({ value: row.value, label: row.value, count: Number(row.count) }));
  }
  const result = await env.MEDIA_LOG_DB.prepare(`
    SELECT items.maker AS value, COUNT(*) AS count
    FROM items
    WHERE items.is_private = 1 AND items.status != 'deleted'
      AND items.maker IS NOT NULL AND trim(items.maker) != ''
      AND (? = '' OR lower(trim(items.maker)) LIKE ? ESCAPE '\\')
    GROUP BY items.maker
    ORDER BY count DESC, value COLLATE NOCASE
    LIMIT ?
  `).bind(normalizedQuery, like, safeLimit).all<{ value: string; count: number }>();
  return (result.results || []).map((row) => ({ value: row.value, label: row.value, count: Number(row.count) }));
}

function listOrderSql(params: ItemListParams) {
  if (params.sort === "displayName") {
    const direction = params.order === "desc" ? "DESC" : "ASC";
    const codeSql = "coalesce(nullif(trim(items.normalized_code), ''), nullif(trim(items.code), ''), '')";
    const rawTitleSql = "coalesce(nullif(trim(json_extract(items.metadata_json, '$.title')), ''), nullif(trim(items.official_title), ''), nullif(trim(items.raw_title), ''), '')";
    const displaySql = `CASE
      WHEN ${rawTitleSql} = '' THEN ${codeSql}
      WHEN ${rawTitleSql} IN ('-', '—') THEN ${codeSql}
      WHEN lower(replace(replace(${rawTitleSql}, '-', ''), ' ', '')) = lower(replace(replace(${codeSql}, '-', ''), ' ', '')) THEN ${codeSql}
      ELSE ${rawTitleSql}
    END`;
    const codePrefixSql = `lower(rtrim(${codeSql}, '0123456789'))`;
    const codeNumberSql = `CAST(nullif(substr(${codeSql}, length(rtrim(${codeSql}, '0123456789')) + 1), '') AS INTEGER)`;
    return `ORDER BY lower(trim(${displaySql})) COLLATE NOCASE ${direction}, ${codePrefixSql} COLLATE NOCASE ${direction}, ${codeNumberSql} ${direction}, lower(${codeSql}) COLLATE NOCASE ${direction}, items.id ${direction}`;
  }
  if (params.mediaStatus === "待觀看") return "ORDER BY datetime(coalesce(planned_at, created_at)) DESC, id DESC";
  if (params.mediaStatus === "已觀看" || params.mediaStatus === "想重看") return "ORDER BY datetime(coalesce(watched_at, updated_at, created_at)) DESC, id DESC";
  return "ORDER BY datetime(updated_at) DESC, id DESC";
}

function toFtsQuery(value: string) {
  const tokens = value
    .trim()
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0)
    .slice(0, 8);
  if (tokens.length === 0) return "";
  return tokens.map((token) => `${token}*`).join(" AND ");
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
  if (input.collection_level !== undefined && !isCollectionLevel(input.collection_level)) throw new HttpError(400, "Invalid collection_level");

  const id = newId("item");
  const timestamp = nowIso();
  const normalized = normalizeInput(input);
  await assertUniqueNormalizedCode(env, normalized.normalized_code, undefined, input.code);
  const status = normalized.status || "raw";

  await env.MEDIA_LOG_DB.batch([
    env.MEDIA_LOG_DB
      .prepare(`INSERT INTO items (
        id, raw_title, official_title, original_title, code, type, category, platform, maker, series,
        release_year, release_date, year, watched_at, started_at, completed_at, planned_at, rating, rewatch_score,
        favorite, favorite_level, collection_level, normalized_code, used, is_private, status, media_status, quick_note, long_note,
        source_url, cover_url, metadata_json, progress_json, search_text, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id,
        rawTitle,
        normalized.official_title,
        normalized.original_title,
        normalized.code,
        normalized.type,
        normalized.category,
        normalized.platform,
        normalized.maker,
        normalized.series,
        normalized.release_year,
        normalized.release_date,
        normalized.year,
        normalized.watched_at,
        normalized.started_at,
        normalized.completed_at,
        normalized.planned_at,
        normalized.rating,
        normalized.rewatch_score,
        normalized.favorite ? 1 : 0,
        normalized.favorite_level,
        normalized.collection_level,
        normalized.normalized_code,
        normalized.used ? 1 : 0,
        normalized.is_private ? 1 : 0,
        status,
        normalized.media_status,
        normalized.quick_note,
        normalized.long_note,
        normalized.source_url,
        normalized.cover_url,
        normalized.metadata_json,
        normalized.progress_json,
        normalized.search_text,
        timestamp,
        timestamp
      ),
    audit(env, actor, "create", "item", id, { raw_title: rawTitle })
  ]);

  await replaceRelations(env, id, normalized.tags, normalized.people, normalized.collections);
  return getItem(env, id);
}

export async function updateItem(env: Env, actor: Actor, id: string, input: ItemInput) {
  const current = await getItem(env, id);
  const rawTitle = cleanString(input.raw_title);
  if (!rawTitle) throw new HttpError(400, "raw_title is required");
  if (input.collection_level !== undefined && !isCollectionLevel(input.collection_level)) throw new HttpError(400, "Invalid collection_level");
  const normalized = normalizeInput(input);
  if (shouldValidateNormalizedCode(current.normalized_code, normalized.normalized_code)) {
    await assertUniqueNormalizedCode(env, normalized.normalized_code, id, input.code);
  }
  const status = normalized.status || inferStatus(normalized);

  await env.MEDIA_LOG_DB.batch([
    env.MEDIA_LOG_DB
      .prepare(`UPDATE items SET
        raw_title = ?, official_title = ?, original_title = ?, code = ?, type = ?,
        category = ?, platform = ?, maker = ?, series = ?, release_year = ?, release_date = ?, year = ?, watched_at = ?, started_at = ?,
        completed_at = ?, planned_at = ?, rating = ?, rewatch_score = ?, favorite = ?,
        favorite_level = ?, collection_level = ?, normalized_code = ?, used = ?, is_private = ?, status = ?, media_status = ?,
        quick_note = ?, long_note = ?, source_url = ?, cover_url = ?,
        metadata_json = ?, progress_json = ?, search_text = ?, updated_at = ?
        WHERE id = ?`)
      .bind(
        rawTitle,
        normalized.official_title,
        normalized.original_title,
        normalized.code,
        normalized.type,
        normalized.category,
        normalized.platform,
        normalized.maker,
        normalized.series,
        normalized.release_year,
        normalized.release_date,
        normalized.year,
        normalized.watched_at,
        normalized.started_at,
        normalized.completed_at,
        normalized.planned_at,
        normalized.rating,
        normalized.rewatch_score,
        normalized.favorite ? 1 : 0,
        normalized.favorite_level,
        normalized.collection_level,
        normalized.normalized_code,
        normalized.used ? 1 : 0,
        normalized.is_private ? 1 : 0,
        status,
        normalized.media_status,
        normalized.quick_note,
        normalized.long_note,
        normalized.source_url,
        normalized.cover_url,
        normalized.metadata_json,
        normalized.progress_json,
        normalized.search_text,
        nowIso(),
        id
      ),
    audit(env, actor, "update", "item", id, { status })
  ]);

  await replaceRelations(env, id, normalized.tags, normalized.people, normalized.collections);
  return getItem(env, id);
}

function insertItemStatement(env: Env, id: string, timestamp: string, normalized: NormalizedInput) {
  return env.MEDIA_LOG_DB
    .prepare(`INSERT INTO items (
      id, raw_title, official_title, original_title, code, type, category, platform, maker, series,
      release_year, release_date, year, watched_at, started_at, completed_at, planned_at, rating, rewatch_score,
      favorite, favorite_level, collection_level, normalized_code, used, is_private, status, media_status, quick_note, long_note,
      source_url, cover_url, metadata_json, progress_json, search_text, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      id,
      normalized.raw_title,
      normalized.official_title,
      normalized.original_title,
      normalized.code,
      normalized.type,
      normalized.category,
      normalized.platform,
      normalized.maker,
      normalized.series,
      normalized.release_year,
      normalized.release_date,
      normalized.year,
      normalized.watched_at,
      normalized.started_at,
      normalized.completed_at,
      normalized.planned_at,
      normalized.rating,
      normalized.rewatch_score,
      normalized.favorite ? 1 : 0,
      normalized.favorite_level,
      normalized.collection_level,
      normalized.normalized_code,
      normalized.used ? 1 : 0,
      normalized.is_private ? 1 : 0,
      normalized.status,
      normalized.media_status,
      normalized.quick_note,
      normalized.long_note,
      normalized.source_url,
      normalized.cover_url,
      normalized.metadata_json,
      normalized.progress_json,
      normalized.search_text,
      timestamp,
      timestamp
    );
}

export async function softDeleteItem(env: Env, actor: Actor, id: string) {
  await getItem(env, id);
  await env.MEDIA_LOG_DB.batch([
    env.MEDIA_LOG_DB
      .prepare("UPDATE items SET status = 'deleted', media_status = '已刪除', favorite_level = '已刪', collection_level = 'discard', deleted_at = ?, updated_at = ? WHERE id = ?")
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
    watching,
    plan,
    monthly,
    watchStatuses,
    types,
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
    env.MEDIA_LOG_DB.prepare(`SELECT ${itemColumns} FROM items WHERE ${visibleSql} AND ${watchStatusWhereSql("watching")} ORDER BY datetime(updated_at) DESC LIMIT 12`).all<Row>(),
    env.MEDIA_LOG_DB.prepare(`SELECT ${itemColumns} FROM items WHERE ${visibleSql} AND ${watchStatusWhereSql("plan_to_watch")} ORDER BY datetime(coalesce(planned_at, updated_at)) DESC LIMIT 12`).all<Row>(),
    env.MEDIA_LOG_DB.prepare(`SELECT substr(coalesce(watched_at, created_at), 1, 7) AS month, COUNT(*) AS count FROM items WHERE ${visibleSql} GROUP BY month ORDER BY month DESC LIMIT 18`).all(),
    env.MEDIA_LOG_DB.prepare(`SELECT ${watchStatusCaseSql()} AS name, COUNT(*) AS count FROM items WHERE ${visibleSql} GROUP BY name ORDER BY count DESC`).all(),
    env.MEDIA_LOG_DB.prepare(`SELECT coalesce(type, '其他') AS name, COUNT(*) AS count FROM items WHERE ${visibleSql} GROUP BY coalesce(type, '其他') ORDER BY count DESC`).all(),
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
    watching: await hydrateItems(env, watching.results || []),
    plan: await hydrateItems(env, plan.results || []),
    monthly: monthly.results || [],
    watchStatuses: normalizeWatchStatusCounts(watchStatuses.results || []),
    types: types.results || [],
    categories: categories.results || [],
    platforms: platforms.results || [],
    tags: tags.results || []
  };
}

function typeWhereSql(type: string) {
  const aliases = typeAliases(type);
  const aliasChecks = aliases.map(() => "lower(coalesce(items.type, '') || ' ' || coalesce(items.category, '') || ' ' || coalesce(items.platform, '') || ' ' || coalesce(items.metadata_json, '')) LIKE ?");
  const tagChecks = aliases.map(() => `EXISTS (
    SELECT 1 FROM item_tags it
    JOIN tags t ON t.id = it.tag_id
    WHERE it.item_id = items.id AND lower(t.name) LIKE ?
  )`);
  return `(items.type = ? OR items.category = ? OR ${[...aliasChecks, ...tagChecks].join(" OR ")})`;
}

function typeAliases(type: string) {
  const normalized = type.trim().toLowerCase();
  const aliases: Record<string, string[]> = {
    "電影": ["電影", "movie", "film", "cinema"],
    "影集": ["影集", "劇集", "劇", "series", "tv", "tv show", "drama"],
    "動畫": ["動畫", "動漫", "anime", "animation"],
    "沙雕动画": ["沙雕动画", "沙雕動畫", "b站", "bilibili", "修仙"],
    "youtube": ["youtube", "yt"],
    "其他": ["其他", "other"]
  };
  return aliases[type] || aliases[normalized] || [type];
}

function watchStatusWhereSql(status: WatchStatus) {
  const explicit = watchStatusExprSql();
  if (status === "completed") {
    return `((${explicit}) = 'completed' OR (${progressCompleteSql()}) OR ((${explicit}) IS NULL AND items.status = 'complete'))`;
  }
  return `((${explicit}) = '${status}' OR ((${explicit}) IS NULL AND items.status = '${watchStatusLegacy(status)}'))`;
}

function watchStatusCaseSql() {
  const explicit = watchStatusExprSql();
  return `CASE
    WHEN (${progressCompleteSql()}) THEN 'completed'
    WHEN (${explicit}) IN ('plan_to_watch', 'watching', 'completed', 'paused', 'dropped', 'rewatching') THEN (${explicit})
    WHEN items.status = 'complete' THEN 'completed'
    WHEN items.status = 'partial' THEN 'watching'
    WHEN items.status = 'archived' THEN 'dropped'
    ELSE 'plan_to_watch'
  END`;
}

function watchStatusExprSql() {
  return "CASE WHEN json_valid(coalesce(items.progress_json, '')) THEN json_extract(items.progress_json, '$.watch_status') END";
}

function progressCompleteSql() {
  return `(
    json_valid(coalesce(items.progress_json, ''))
    AND CAST(json_extract(items.progress_json, '$.total_episodes') AS REAL) > 0
    AND CAST(json_extract(items.progress_json, '$.current_episode') AS REAL) >= CAST(json_extract(items.progress_json, '$.total_episodes') AS REAL)
  )`;
}

function watchStatusLegacy(status: WatchStatus): ItemStatus {
  if (status === "completed") return "complete";
  if (status === "dropped") return "archived";
  if (status === "watching" || status === "paused" || status === "rewatching") return "partial";
  return "raw";
}

function normalizeWatchStatusCounts(rows: Row[]) {
  const labels: Record<WatchStatus, string> = {
    plan_to_watch: "待觀看",
    watching: "觀看中",
    completed: "看完",
    paused: "暫停",
    dropped: "已放棄",
    rewatching: "重看中"
  };
  return (Object.keys(labels) as WatchStatus[]).map((name) => ({
    name,
    label: labels[name],
    count: Number(rows.find((row) => row.name === name)?.count || 0)
  }));
}

export async function importItems(env: Env, actor: Actor, rows: ItemInput[], sourceName: string, sourceType: "csv" | "json") {
  const jobId = newId("import");
  let imported = 0;
  let skipped = 0;
  const duplicates: string[] = [];
  const chunkSize = 100;

  await env.MEDIA_LOG_DB.prepare("INSERT INTO import_jobs (id, source_name, source_type, row_count) VALUES (?, ?, ?, ?)")
    .bind(jobId, sourceName, sourceType, rows.length)
    .run();

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const normalizedRows = chunk
      .map((row) => {
        const rawTitle = cleanString(row.raw_title);
        if (!rawTitle) return null;
        const normalized = normalizeInput({ ...row, raw_title: rawTitle });
        return { row, rawTitle, normalized };
      })
      .filter((entry): entry is { row: ItemInput; rawTitle: string; normalized: NormalizedInput } => Boolean(entry));

    skipped += chunk.length - normalizedRows.length;
    const duplicateCodes = await existingCodes(env, normalizedRows.map((entry) => entry.normalized.code).filter((code): code is string => Boolean(code)));
    const statements: D1PreparedStatement[] = [];

    for (const entry of normalizedRows) {
      if (entry.normalized.code && duplicateCodes.has(entry.normalized.code)) {
        skipped += 1;
        duplicates.push(entry.rawTitle);
        continue;
      }
      const id = newId("item");
      const timestamp = nowIso();
      const status = entry.normalized.status || inferStatus(entry.normalized);
      statements.push(insertItemStatement(env, id, timestamp, { ...entry.normalized, status }));
      appendRelationStatements(env, statements, id, entry.normalized.tags, entry.normalized.people, entry.normalized.collections, false);
      statements.push(audit(env, actor, "create", "item", id, { raw_title: entry.rawTitle, import_job_id: jobId }));
      imported += 1;
    }

    if (statements.length > 0) await env.MEDIA_LOG_DB.batch(statements);
  }

  const summary = { duplicates: duplicates.slice(0, 50) };
  await env.MEDIA_LOG_DB.prepare(`UPDATE import_jobs SET imported_count = ?, skipped_count = ?, completed_at = ?, summary_json = ? WHERE id = ?`)
    .bind(imported, skipped, nowIso(), JSON.stringify(summary), jobId)
    .run();

  return { jobId, imported, skipped, duplicates };
}

async function existingCodes(env: Env, codes: string[]) {
  const uniqueCodes = Array.from(new Set(codes));
  if (uniqueCodes.length === 0) return new Set<string>();
  const result = new Set<string>();
  for (let index = 0; index < uniqueCodes.length; index += 100) {
    const chunk = uniqueCodes.slice(index, index + 100);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = await env.MEDIA_LOG_DB
      .prepare(`SELECT code FROM items WHERE status != 'deleted' AND code IN (${placeholders})`)
      .bind(...chunk)
      .all<{ code: string }>();
    for (const row of rows.results || []) result.add(row.code);
  }
  return result;
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
    maker: nullableString(row.maker),
    series: nullableString(row.series),
    release_year: nullableNumber(row.release_year),
    release_date: nullableString(row.release_date),
    year: nullableNumber(row.year),
    watched_at: nullableString(row.watched_at),
    started_at: nullableString(row.started_at),
    completed_at: nullableString(row.completed_at),
    planned_at: nullableString(row.planned_at),
    rating: nullableNumber(row.rating),
    rewatch_score: nullableNumber(row.rewatch_score),
    favorite: Boolean(row.favorite),
    favorite_level: normalizeFavoriteLevel(nullableString(row.favorite_level), Boolean(row.favorite), row.rating),
    collection_level: normalizeCollectionLevel(row.collection_level ?? row.favorite_level ?? row.favorite),
    normalized_code: nullableString(row.normalized_code) || normalizeWorkCode(row.code) || null,
    used: Boolean(row.used),
    is_private: Boolean(row.is_private),
    status: String(row.status || "raw") as ItemStatus,
    media_status: normalizeMediaStatus(nullableString(row.media_status), String(row.status || "raw") as ItemStatus, nullableString(row.progress_json)),
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

  appendRelationStatements(env, statements, itemId, tags, people, collections, true);
  await env.MEDIA_LOG_DB.batch(statements);
}

function appendRelationStatements(env: Env, statements: D1PreparedStatement[], itemId: string, tags: string[], people: string[], collections: string[], replace: boolean) {
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
  void replace;
}

function normalizeInput(input: ItemInput): NormalizedInput {
  const rawTitle = cleanString(input.raw_title) || "";
  const normalizedCode = normalizeWorkCode(input.code);
  const code = normalizedCode || cleanString(input.code);
  const metadata = parseMetadata(input.metadata_json);
  const parsed = parseCode(code || rawTitle);
  const makerValue = cleanString(input.maker) || metadataString(metadata, ["maker", "studio"]) || (input.is_private ? cleanString(input.platform) : null);
  const platformValue = cleanString(input.platform);
  const privatePlatform = normalizePrivatePlatform({ code, title: rawTitle, platform: platformValue, maker: makerValue });
  const platform = input.is_private ? privatePlatform : normalizePlatform(platformValue, parsed);
  const maker = normalizeMaker(makerValue, parsed);
  const series = cleanString(input.series) || metadataString(metadata, ["series"]) || parsed.series;
  const releaseDate = cleanString(input.release_date) || metadataString(metadata, ["release_date", "released_at"]);
  const releaseDateYear = releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(releaseDate) ? Number(releaseDate.slice(0, 4)) : null;
  const year = nullableNumber(input.year ?? input.release_year ?? metadataNumber(metadata, ["year", "releaseYear"])) ?? releaseDateYear;
  const favoriteLevel = normalizeFavoriteLevel(input.favorite_level || metadataString(metadata, ["favorite_level", "collection_level"]) || reflectionString(metadata, "collection_level"), input.favorite, input.rating);
  const privateUsedLevel = favoriteLevel === "已使用";
  const collectionLevel = privateUsedLevel ? "masterpiece" : normalizeCollectionLevel(input.collection_level ?? input.favorite_level ?? input.favorite);
  const used = privateUsedLevel || (input.used ?? metadataBool(metadata, ["used", "is_used", "viewed"]));
  const mediaStatus = normalizeMediaStatus(input.media_status, input.status, input.progress_json);
  const quickNote = cleanString(input.quick_note);
  const longNote = cleanString(input.long_note);
  const tags = (input.tags || []).filter((tag) => !isPrivateMarkerValue(tag));
  const people = input.is_private && !(input.people || []).some((person) => person.trim()) ? ["素人"] : input.people || [];
  const normalized = {
    raw_title: rawTitle,
    official_title: cleanString(input.official_title),
    original_title: cleanString(input.original_title),
    code,
    type: cleanString(input.type),
    category: cleanString(input.category),
    platform,
    maker,
    series,
    release_year: nullableNumber(input.release_year) ?? year,
    release_date: releaseDate,
    year,
    watched_at: cleanString(input.watched_at),
    started_at: cleanString(input.started_at),
    completed_at: cleanString(input.completed_at),
    planned_at: cleanString(input.planned_at),
    rating: clampNumber(input.rating, 0, 10),
    rewatch_score: clampNumber(input.rewatch_score, 0, 10),
    favorite: Boolean(input.favorite),
    favorite_level: favoriteLevel,
    collection_level: collectionLevel,
    normalized_code: normalizedCode || null,
    used: Boolean(used),
    is_private: Boolean(input.is_private),
    status: input.status || "raw",
    media_status: mediaStatus,
    quick_note: quickNote,
    long_note: longNote,
    source_url: cleanString(input.source_url),
    cover_url: cleanString(input.cover_url),
    metadata_json: cleanString(input.metadata_json),
    progress_json: cleanString(input.progress_json),
    tags,
    people,
    collections: input.collections || []
  };
  return {
    ...normalized,
    search_text: buildSearchText(normalized)
  };
}

export function shouldValidateNormalizedCode(currentCode: string | null | undefined, nextCode: string | null | undefined) {
  return (currentCode || null) !== (nextCode || null);
}

export async function quickUpdateItem(env: Env, actor: Actor, id: string, field: string, value: unknown) {
  await getItem(env, id);
  const validated = validateQuickEdit(field, value);
  if (!validated) throw new HttpError(400, "Invalid quick update field or value");
  const timestamp = nowIso();
  let statement: D1PreparedStatement;
  if (validated.field === "collection_level") {
    const dbLevel = validated.value === "used" ? "masterpiece" : validated.value;
    const legacy = validated.value === "used" ? "已使用" : validated.value === "masterpiece" ? "神作" : validated.value === "discard" ? "已刪" : "一般";
    const favorite = validated.value === "used" || validated.value === "normal" || validated.value === "masterpiece";
    statement = env.MEDIA_LOG_DB.prepare("UPDATE items SET collection_level = ?, favorite_level = ?, favorite = ?, used = ?, updated_at = ? WHERE id = ?")
      .bind(dbLevel, legacy, favorite ? 1 : 0, validated.value === "used" ? 1 : 0, timestamp, id);
  } else if (validated.field === "rating") {
    statement = env.MEDIA_LOG_DB.prepare("UPDATE items SET rating = ?, updated_at = ? WHERE id = ?").bind(validated.value, timestamp, id);
  } else if (validated.field === "private_status") {
    const fields = privateStatusToFields(validated.value);
    statement = env.MEDIA_LOG_DB.prepare("UPDATE items SET used = ?, media_status = ?, updated_at = ? WHERE id = ?")
      .bind(fields.used ? 1 : 0, fields.media_status, timestamp, id);
  } else {
    const fields = privateStatusToFields(validated.value ? "done" : "pending");
    statement = env.MEDIA_LOG_DB.prepare("UPDATE items SET used = ?, media_status = ?, updated_at = ? WHERE id = ?")
      .bind(fields.used ? 1 : 0, fields.media_status, timestamp, id);
  }
  await env.MEDIA_LOG_DB.batch([statement, audit(env, actor, "quick_update", "item", id, { field: validated.field })]);
  return getItem(env, id);
}

export async function findNormalizedCodeConflict(env: Env, code: unknown, currentId?: string) {
  const normalizedCode = normalizeWorkCode(code);
  if (!normalizedCode) return null;
  const existing = await env.MEDIA_LOG_DB.prepare(`
    SELECT id, code, raw_title, official_title
    FROM items
    WHERE normalized_code = ? AND status != 'deleted' ${currentId ? "AND id != ?" : ""}
    LIMIT 1
  `).bind(normalizedCode, ...(currentId ? [currentId] : [])).first<Row>();
  if (!existing) return null;
  return {
    id: String(existing.id),
    code: nullableString(existing.code) || normalizedCode,
    title: nullableString(existing.official_title) || String(existing.raw_title || "")
  };
}

async function assertUniqueNormalizedCode(env: Env, normalizedCode: string | null, currentId?: string, inputCode?: unknown) {
  if (!normalizedCode) return;
  const existing = await findNormalizedCodeConflict(env, normalizedCode, currentId);
  if (!existing) return;
  throw new HttpError(409, "作品代號已存在", {
    inputCode: typeof inputCode === "string" ? inputCode : "",
    normalizedCode,
    existing
  });
}

function inferStatus(input: Required<ItemInput>): ItemStatus {
  const hasOrganizedTitle = Boolean(input.official_title || input.original_title || input.code);
  const hasClassification = Boolean(input.type || input.category || input.platform || input.tags.length || input.people.length);
  if (hasOrganizedTitle && hasClassification) return "complete";
  if (hasOrganizedTitle || hasClassification || input.rating || input.long_note) return "partial";
  return "raw";
}

function parseCode(value: string | null) {
  const text = (value || "").trim().toUpperCase();
  const compact = text.replace(/[\s_]+/g, "-");
  const prefixMatch = compact.match(/^([A-Z]+[A-Z0-9]*)(?:-|\d)/);
  const series = compact.startsWith("FC2-PPV") || compact.startsWith("FC2PPV") ? "FC2PPV" : prefixMatch?.[1] || null;
  return { text, series, platform: series === "FC2PPV" ? "FC2" : null };
}

function normalizePlatform(value: string | null, parsed: ReturnType<typeof parseCode>) {
  if (parsed.platform) return parsed.platform;
  return value || "其他";
}

function normalizeMaker(value: string | null, parsed: ReturnType<typeof parseCode>) {
  const series = (parsed.series || "").toUpperCase();
  if (["SSIS", "IPZZ", "SONE"].includes(series)) return "S1";
  if (["STARS", "SDAB", "SDDE"].includes(series)) return "SOD";
  if (["ABW", "CHN"].includes(series)) return "Prestige";
  return value || "";
}

function normalizeFavoriteLevel(value: unknown, favorite?: unknown, rating?: unknown): FavoriteLevel {
  const text = typeof value === "string" ? value.trim() : "";
  if (text === "已使用" || text === "神作" || text === "收藏" || text === "一般" || text === "雷片" || text === "已刪") return text;
  const numericRating = nullableNumber(rating);
  if (numericRating !== null && numericRating >= 9) return "神作";
  if (favorite) return "收藏";
  return "一般";
}

function normalizeMediaStatus(value: unknown, status?: ItemStatus, progressJson?: string | null): MediaStatus {
  const text = typeof value === "string" ? value.trim() : "";
  if (text === "待觀看" || text === "已觀看" || text === "想重看" || text === "已刪除") return text;
  const watchStatus = progressWatchStatus(progressJson);
  if (status === "deleted") return "已刪除";
  if (watchStatus === "rewatching") return "想重看";
  if (watchStatus === "completed" || status === "complete") return "已觀看";
  return "待觀看";
}

function progressWatchStatus(value: string | null | undefined) {
  const parsed = parseMetadata(value);
  const status = parsed.watch_status;
  return typeof status === "string" ? status : "";
}

function buildSearchText(input: Pick<NormalizedInput, "raw_title" | "official_title" | "original_title" | "code" | "platform" | "maker" | "series" | "quick_note" | "long_note" | "metadata_json" | "tags" | "people">) {
  return [
    input.raw_title,
    input.official_title,
    input.original_title,
    input.code,
    input.platform,
    input.maker,
    input.series,
    input.quick_note,
    input.long_note,
    input.metadata_json,
    ...input.tags,
    ...input.people
  ].filter(Boolean).join(" ").toLowerCase();
}

function metadataString(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function metadataNumber(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = nullableNumber(metadata[key]);
    if (value !== null) return value;
  }
  return null;
}

function metadataBool(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string" && ["true", "1", "yes", "y", "used"].includes(value.trim().toLowerCase())) return true;
  }
  return false;
}

function reflectionString(metadata: Record<string, unknown>, key: string) {
  const reflection = metadata.reflection;
  if (!reflection || typeof reflection !== "object" || Array.isArray(reflection)) return null;
  const value = (reflection as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function parseMetadata(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
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
