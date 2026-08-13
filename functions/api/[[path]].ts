import { createBackup, listBackups, restoreBackup } from "../_lib/backup";
import { error, handleError, json, noContent, notFound, readJson, requireAccess } from "../_lib/http";
import { parseCsv, parseJsonItems, toCsv } from "../_lib/importExport";
import { batchUpdateItems, createItem, exportItems, findNormalizedCodeConflict, getItem, getPrivateFacetsForFilters, getPublicAggregate, getStats, importItems, isLikelyDuplicate, listItems, quickUpdateItem, searchPrivateFacet, softDeleteItem, updateItem } from "../_lib/items";
import { applyMetadataSuggestions, decideMetadataSuggestions, isMetadataSuggestionStatus, listMetadataSuggestions, previewMetadataSuggestions, refreshMetadataSuggestions } from "../_lib/metadataSuggestions";
import { applyEntityMerge, getNormalizationOverview, isEntityType, previewEntityMerge, registerEntityAlias, rollbackEntityMerge } from "../_lib/normalization";
import { getOrganizationInboxSummary, isOrganizationInboxCategory, listOrganizationInbox, setOrganizationInboxState } from "../_lib/organizationInbox";
import { applyDuplicateMerge, decideDuplicatePair, isDuplicateDecision, listDuplicateCandidates, previewDuplicateMerge, refreshDuplicateSignatures, rollbackDuplicateMerge } from "../_lib/duplicates";
import { parseSmartAdd } from "../_lib/smartAdd";
import { applyTmdbMetadata, searchTmdb } from "../_lib/tmdb";
import { getPrivateQuality, ignorePrivateIssue, isPrivateIssueType, unignorePrivateIssue } from "../_lib/privateQuality";
import type { Env, FavoriteLevel, ItemInput, ItemListParams, ItemStatus, MediaStatus, WatchStatus } from "../_lib/types";
import type { PrivateCollectionLevel } from "../../shared/privateModel";
import { isPrivateStatus } from "../../shared/privateStatus";

export const onRequest: PagesFunction<Env, "path"> = async (context) => {
  try {
    const actor = requireAccess(context.request, context.env);
    const url = new URL(context.request.url);
    const path = getPath(context.params.path);
    const method = context.request.method.toUpperCase();

    if (method === "GET" && path.length === 1 && path[0] === "health") {
      return json({ ok: true });
    }

    if (method === "GET" && path.length === 2 && path[0] === "private" && path[1] === "items") {
      return json(await listItems(context.env, {
        ...getListParams(url),
        includePrivate: true,
        privateOnly: true,
        includeFacets: false
      }), { headers: { "cache-control": "private, no-store" } });
    }

    if (method === "GET" && path.length === 2 && path[0] === "private" && path[1] === "code-conflict") {
      const code = optional(url.searchParams.get("code"));
      if (!code) return error(400, "code is required");
      return json(
        { conflict: await findNormalizedCodeConflict(context.env, code) },
        { headers: { "cache-control": "private, no-store" } }
      );
    }

    if (path[0] === "items") {
      if (method === "GET" && path.length === 1) return json(await listItems(context.env, getListParams(url)));
      if (method === "POST" && path.length === 1) return json(await createItem(context.env, actor, await readJson<ItemInput>(context.request)), { status: 201 });
      if (method === "POST" && path.length === 2 && path[1] === "batch") {
        const body = await readJson<{ operations?: unknown }>(context.request);
        return json(await batchUpdateItems(context.env, actor, body.operations));
      }
      if (path.length === 2) {
        if (method === "GET") return json(await getItem(context.env, path[1]));
        if (method === "PUT") return json(await updateItem(context.env, actor, path[1], await readJson<ItemInput>(context.request)));
        if (method === "DELETE") {
          await softDeleteItem(context.env, actor, path[1]);
          return noContent();
        }
      }
      if (method === "PATCH" && path.length === 3 && path[2] === "quick") {
        const body = await readJson<{ field?: string; value?: unknown }>(context.request);
        return json(await quickUpdateItem(context.env, actor, path[1], body.field || "", body.value), { headers: { "cache-control": "private, no-store" } });
      }
    }

    if (method === "GET" && path.length === 1 && path[0] === "stats") {
      return json(await getStats(context.env, url.searchParams.get("includePrivate") === "true"));
    }

    if (method === "GET" && path.length === 2 && path[0] === "public" && path[1] === "aggregate") {
      return json(await getPublicAggregate(context.env, optionalNumber(url.searchParams.get("timezoneOffsetMinutes")) || 0));
    }

    if (method === "GET" && path[0] === "private" && path[1] === "facets") {
      const facet = url.searchParams.get("facet");
      if (!facet) return json(await getPrivateFacetsForFilters(context.env, getListParams(url)), { headers: { "cache-control": "private, no-store" } });
      if (facet !== "actress" && facet !== "tag" && facet !== "studio") return error(400, "Invalid facet type");
      const limit = Math.min(50, Math.max(1, optionalNumber(url.searchParams.get("limit")) || 30));
      return json({ facet, items: await searchPrivateFacet(context.env, facet, optional(url.searchParams.get("q")) || "", limit) }, {
        headers: { "cache-control": "private, no-store" }
      });
    }

    if (path[0] === "private" && path[1] === "quality") {
      const issueType = url.searchParams.get("issueType");
      if (method === "GET" && path.length === 2) {
        if (issueType && !isPrivateIssueType(issueType)) return error(400, "Invalid issue type");
        return json(await getPrivateQuality(context.env, isPrivateIssueType(issueType) ? issueType : undefined, optionalNumber(url.searchParams.get("page")) || 1, optionalNumber(url.searchParams.get("pageSize")) || 50, url.searchParams.get("ignored") === "true"), { headers: { "cache-control": "private, no-store" } });
      }
      if (path[2] === "ignores") {
        const body = await readJson<{ itemId?: string; issueType?: string; issueKey?: string }>(context.request);
        if (!isPrivateIssueType(body.issueType)) return error(400, "Invalid issue type");
        if (method === "POST") return json(await ignorePrivateIssue(context.env, actor, body.itemId || "", body.issueType, body.issueKey || ""), { status: 201 });
        if (method === "DELETE") {
          await unignorePrivateIssue(context.env, body.itemId || "", body.issueType, body.issueKey || "");
          return noContent();
        }
      }
    }

    if (path[0] === "private" && path[1] === "suggestions") {
      if (method === "GET" && path.length === 2) {
        const status = url.searchParams.get("status") || "pending";
        if (!isMetadataSuggestionStatus(status)) return error(400, "Invalid suggestion status");
        return json(await listMetadataSuggestions(
          context.env,
          status,
          optionalNumber(url.searchParams.get("page")) || 1,
          optionalNumber(url.searchParams.get("pageSize")) || 50,
          optional(url.searchParams.get("itemId"))
        ), { headers: { "cache-control": "private, no-store" } });
      }
      if (method === "POST" && path[2] === "refresh") {
        return json(await refreshMetadataSuggestions(context.env));
      }
      if (method === "POST" && path[2] === "preview") {
        const body = await readJson<{ ids?: unknown }>(context.request);
        return json(await previewMetadataSuggestions(context.env, body.ids));
      }
      if (method === "POST" && path[2] === "apply") {
        const body = await readJson<{ ids?: unknown; confirmed?: unknown }>(context.request);
        return json(await applyMetadataSuggestions(context.env, actor, body.ids, body.confirmed));
      }
      if (method === "POST" && path[2] === "decision") {
        const body = await readJson<{ ids?: unknown; decision?: unknown }>(context.request);
        return json(await decideMetadataSuggestions(context.env, actor, body.ids, body.decision));
      }
    }

    if (path[0] === "private" && path[1] === "normalization") {
      if (method === "GET" && path.length === 2) {
        const entityType = url.searchParams.get("entityType");
        if (!isEntityType(entityType)) return error(400, "Invalid entity type");
        return json(await getNormalizationOverview(
          context.env,
          entityType,
          optional(url.searchParams.get("q")) || "",
          optionalNumber(url.searchParams.get("limit")) || 500
        ), { headers: { "cache-control": "private, no-store" } });
      }
      if (method === "POST" && path[2] === "aliases") {
        const body = await readJson<{ entityType?: unknown; canonicalValue?: unknown; aliasValue?: unknown }>(context.request);
        if (!isEntityType(body.entityType)) return error(400, "Invalid entity type");
        return json(await registerEntityAlias(context.env, actor, body.entityType, body.canonicalValue, body.aliasValue), { status: 201 });
      }
      if (method === "POST" && path[2] === "merge" && path[3] === "preview") {
        const body = await readJson<{ entityType?: unknown; sourceValue?: unknown; targetValue?: unknown }>(context.request);
        if (body.entityType !== "tag" && body.entityType !== "person") return error(400, "Only tags and people can be merged");
        return json(await previewEntityMerge(context.env, body.entityType, body.sourceValue, body.targetValue));
      }
      if (method === "POST" && path[2] === "merge" && path[3] === "apply") {
        const body = await readJson<{ entityType?: unknown; sourceValue?: unknown; targetValue?: unknown; confirmed?: unknown }>(context.request);
        if (body.entityType !== "tag" && body.entityType !== "person") return error(400, "Only tags and people can be merged");
        return json(await applyEntityMerge(context.env, actor, body.entityType, body.sourceValue, body.targetValue, body.confirmed));
      }
      if (method === "POST" && path[2] === "merge" && path[3] === "rollback") {
        const body = await readJson<{ mergeId?: string; confirmed?: unknown }>(context.request);
        if (!body.mergeId?.trim()) return error(400, "mergeId is required");
        return json(await rollbackEntityMerge(context.env, actor, body.mergeId.trim(), body.confirmed));
      }
    }

    if (path[0] === "private" && path[1] === "inbox") {
      if (method === "GET" && path[2] === "summary") {
        return json(await getOrganizationInboxSummary(context.env), { headers: { "cache-control": "private, no-store" } });
      }
      if (method === "GET" && path.length === 2) {
        const category = url.searchParams.get("category") || "missing_metadata";
        if (!isOrganizationInboxCategory(category)) return error(400, "Invalid inbox category");
        return json(await listOrganizationInbox(
          context.env,
          category,
          optionalNumber(url.searchParams.get("page")) || 1,
          optionalNumber(url.searchParams.get("pageSize")) || 50
        ), { headers: { "cache-control": "private, no-store" } });
      }
      if (method === "POST" && path[2] === "state") {
        const body = await readJson<{ itemIds?: unknown; state?: unknown }>(context.request);
        return json(await setOrganizationInboxState(context.env, actor, body.itemIds, body.state));
      }
    }

    if (path[0] === "private" && path[1] === "duplicates") {
      if (method === "GET" && path.length === 2) {
        return json(await listDuplicateCandidates(
          context.env,
          optionalNumber(url.searchParams.get("page")) || 1,
          optionalNumber(url.searchParams.get("pageSize")) || 50
        ), { headers: { "cache-control": "private, no-store" } });
      }
      if (method === "POST" && path[2] === "refresh") return json(await refreshDuplicateSignatures(context.env));
      if (method === "POST" && path[2] === "decision") {
        const body = await readJson<{ itemAId?: unknown; itemBId?: unknown; decision?: unknown; metadata?: unknown }>(context.request);
        if (!isDuplicateDecision(body.decision)) return error(400, "Invalid duplicate decision");
        return json(await decideDuplicatePair(context.env, actor, body.itemAId, body.itemBId, body.decision, body.metadata));
      }
      if (method === "POST" && path[2] === "merge" && path[3] === "preview") {
        const body = await readJson<{ targetItemId?: unknown; sourceItemId?: unknown }>(context.request);
        return json(await previewDuplicateMerge(context.env, body.targetItemId, body.sourceItemId));
      }
      if (method === "POST" && path[2] === "merge" && path[3] === "apply") {
        return json(await applyDuplicateMerge(context.env, actor, await readJson(context.request)));
      }
      if (method === "POST" && path[2] === "merge" && path[3] === "rollback") {
        const body = await readJson<{ mergeId?: unknown; confirmed?: unknown }>(context.request);
        return json(await rollbackDuplicateMerge(context.env, actor, body.mergeId, body.confirmed));
      }
    }

    if (path[0] === "smart-add" && method === "POST" && path[1] === "parse") {
      const body = await readJson<{ text?: string }>(context.request);
      if (!body.text?.trim()) return error(400, "text is required");
      return json(await parseSmartAdd(context.env, body.text));
    }

    if (path[0] === "export") {
      const items = await exportItems(context.env);
      if (method === "GET" && path[1] === "json") {
        return json({ version: 1, exported_at: new Date().toISOString(), items });
      }
      if (method === "GET" && path[1] === "csv") {
        return new Response(toCsv(items as unknown as Record<string, unknown>[]), {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": `attachment; filename="media-log-${new Date().toISOString().slice(0, 10)}.csv"`,
            "cache-control": "private, no-store",
            "x-content-type-options": "nosniff"
          }
        });
      }
    }

    if (path[0] === "import") {
      if (method === "POST" && path[1] === "preview") {
        return json(await previewImport(context.request, context.env));
      }
      if (method === "POST" && path[1] === "commit") {
        const body = await readJson<{ rows: ItemInput[]; sourceName?: string; sourceType?: "csv" | "json" }>(context.request);
        if (!Array.isArray(body.rows)) return error(400, "rows must be an array");
        return json(await importItems(context.env, actor, body.rows, body.sourceName || "manual-import", body.sourceType || "csv"));
      }
    }

    if (path[0] === "metadata") {
      if (method === "POST" && path[1] === "search") {
        const body = await readJson<{ itemId?: string; query?: string }>(context.request);
        return json(await searchTmdb(context.env, body.itemId, body.query));
      }
      if (method === "POST" && path[1] === "apply") {
        const body = await readJson<{ itemId?: string; tmdb_id?: number; media_type?: "movie" | "tv" }>(context.request);
        if (!body.itemId || !body.tmdb_id || (body.media_type !== "movie" && body.media_type !== "tv")) {
          return error(400, "itemId, tmdb_id, and media_type are required");
        }
        return json(await applyTmdbMetadata(context.env, actor, body.itemId, body.tmdb_id, body.media_type));
      }
    }

    if (path[0] === "backups") {
      if (method === "GET" && path.length === 1) return json(await listBackups(context.env));
      if (method === "POST" && path.length === 1) return json(await createBackup(context.env, actor, "manual"), { status: 201 });
      if (method === "POST" && path.length === 3 && path[2] === "restore") return json(await restoreBackup(context.env, actor, path[1]));
      if (method === "POST" && path.length === 2 && path[1] === "run-scheduled") return json(await createBackup(context.env, actor, "scheduled"), { status: 201 });
    }

    return notFound();
  } catch (err) {
    return handleError(err);
  }
};

async function previewImport(request: Request, env: Env) {
  const body = await readJson<{ content: string; sourceName?: string; sourceType: "csv" | "json" }>(request);
  if (!body.content) return error(400, "content is required");

  if (body.sourceType === "json") {
    const rows = parseJsonItems(body.content);
    return {
      sourceName: body.sourceName || "import.json",
      sourceType: "json",
      columns: Object.keys(rows[0] || {}),
      sampleRows: rows.slice(0, 10),
      duplicatePreview: await duplicatePreview(env, rows.slice(0, 50)),
      suggestedMapping: defaultMapping(Object.keys(rows[0] || {}))
    };
  }

  const parsed = parseCsv(body.content);
  return {
    sourceName: body.sourceName || "import.csv",
    sourceType: "csv",
    columns: parsed.columns,
    sampleRows: parsed.records.slice(0, 10),
    duplicatePreview: await duplicatePreview(env, parsed.records.slice(0, 50) as ItemInput[]),
    suggestedMapping: defaultMapping(parsed.columns)
  };
}

async function duplicatePreview(env: Env, rows: ItemInput[]) {
  const result: { index: number; raw_title?: string; duplicate: boolean }[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    result.push({ index: i, raw_title: rows[i].raw_title, duplicate: await isLikelyDuplicate(env, rows[i]) });
  }
  return result;
}

function defaultMapping(columns: string[]) {
  const known = [
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
    "genres",
    "tags",
    "people",
    "collections"
  ];
  const mapping: Record<string, string> = {};
  for (const column of columns) {
    const normalized = column.trim().toLowerCase().replace(/\s+/g, "_");
    if (known.includes(normalized)) mapping[column] = normalized;
    if (normalized === "title" || normalized === "name") mapping[column] = "raw_title";
    if (normalized === "note") mapping[column] = "quick_note";
  }
  return mapping;
}

function getPath(path?: string | string[]) {
  if (Array.isArray(path)) return path;
  if (!path) return [];
  return path.split("/").filter(Boolean);
}

function getListParams(url: URL): ItemListParams {
  const status = url.searchParams.get("status");
  const sort = url.searchParams.get("sort");
  const order = url.searchParams.get("order");
  const privateStatus = url.searchParams.get("privateStatus");
  return {
    query: optional(url.searchParams.get("query")),
    status: isStatusFilter(status) ? status : "all",
    favorite: url.searchParams.get("favorite") === "true",
    highRated: url.searchParams.get("highRated") === "true",
    ratingMin: optionalNumber(url.searchParams.get("ratingMin")),
    ratingMax: optionalNumber(url.searchParams.get("ratingMax")),
    unrated: url.searchParams.get("unrated") === "true",
    usedFilter: isUsedFilter(url.searchParams.get("usedFilter")) ? url.searchParams.get("usedFilter") as "all" | "used" | "unused" : "all",
    privateStatus: isPrivateStatus(privateStatus) ? privateStatus : "all",
    collectionLevel: optional(url.searchParams.get("collectionLevel")),
    favoriteLevel: isFavoriteLevelFilter(url.searchParams.get("favoriteLevel")) ? url.searchParams.get("favoriteLevel") as FavoriteLevel | "all" : "all",
    mediaStatus: isMediaStatusFilter(url.searchParams.get("mediaStatus")) ? url.searchParams.get("mediaStatus") as MediaStatus | "all" : "all",
    includePrivate: url.searchParams.get("includePrivate") === "true",
    privateOnly: url.searchParams.get("privateOnly") === "true",
    includeFacets: url.searchParams.get("includeFacets") === "true",
    platformFilters: csvValues(url.searchParams.get("platformFilters")),
    makerFilters: csvValues(url.searchParams.get("makerFilters")),
    favoriteLevelFilters: csvValues(url.searchParams.get("favoriteLevelFilters")).filter(isCollectionLevelFilter) as PrivateCollectionLevel[],
    personFilters: csvValues(url.searchParams.get("personFilters")),
    missingPeople: url.searchParams.get("missingPeople") === "true",
    qualityView: isPrivateQualityView(url.searchParams.get("qualityView")) ? url.searchParams.get("qualityView") as ItemListParams["qualityView"] : undefined,
    hasNote: isTriState(url.searchParams.get("hasNote")) ? url.searchParams.get("hasNote") as "all" | "yes" | "no" : "all",
    hasCover: isTriState(url.searchParams.get("hasCover")) ? url.searchParams.get("hasCover") as "all" | "yes" | "no" : "all",
    watchStatus: isWatchStatusFilter(url.searchParams.get("watchStatus")) ? url.searchParams.get("watchStatus") as WatchStatus | "all" : "all",
    type: optional(url.searchParams.get("type")),
    category: optional(url.searchParams.get("category")),
    tag: optional(url.searchParams.get("tag")),
    excludeTag: optional(url.searchParams.get("excludeTag")),
    year: optionalNumber(url.searchParams.get("year")),
    platform: optional(url.searchParams.get("platform")),
    maker: optional(url.searchParams.get("maker")),
    series: optional(url.searchParams.get("series")),
    codeQuery: optional(url.searchParams.get("codeQuery")),
    titleQuery: optional(url.searchParams.get("titleQuery")),
    person: optional(url.searchParams.get("person")),
    studio: optional(url.searchParams.get("studio")),
    watchedFrom: optional(url.searchParams.get("watchedFrom")),
    watchedTo: optional(url.searchParams.get("watchedTo")),
    viewedFrom: optional(url.searchParams.get("viewedFrom")),
    viewedTo: optional(url.searchParams.get("viewedTo")),
    updatedFrom: optional(url.searchParams.get("updatedFrom")),
    updatedTo: optional(url.searchParams.get("updatedTo")),
    sort: sort === "displayName" || sort === "rating" || sort === "releaseDate" ? sort : undefined,
    order: isSortOrder(order) ? order as "asc" | "desc" : undefined,
    page: optionalNumber(url.searchParams.get("page")) || 1,
    pageSize: optionalNumber(url.searchParams.get("pageSize")) || 50
  };
}

function isPrivateQualityView(value: string | null): value is NonNullable<ItemListParams["qualityView"]> {
  return value === "missing_tags" || value === "incomplete_metadata" || value === "suspected_duplicate";
}

function optional(value: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function csvValues(value: string | null) {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function optionalNumber(value: string | null) {
  const number = Number(value);
  return Number.isFinite(number) && value !== null && value !== "" ? number : undefined;
}

function isStatusFilter(value: string | null): value is ItemStatus | "all" | "inbox" | "organized" {
  return value === "all" || value === "inbox" || value === "organized" || value === "raw" || value === "partial" || value === "complete" || value === "archived" || value === "deleted";
}

function isWatchStatusFilter(value: string | null): value is WatchStatus | "all" {
  return value === "all" || value === "plan_to_watch" || value === "watching" || value === "completed" || value === "paused" || value === "dropped" || value === "rewatching";
}

function isUsedFilter(value: string | null): value is "all" | "used" | "unused" {
  return value === "all" || value === "used" || value === "unused";
}

function isTriState(value: string | null): value is "all" | "yes" | "no" {
  return value === "all" || value === "yes" || value === "no";
}

function isFavoriteLevelFilter(value: string | null): value is FavoriteLevel | "all" {
  return value === "all" || value === "已使用" || value === "神作" || value === "收藏" || value === "一般" || value === "雷片" || value === "已刪";
}

function isCollectionLevelFilter(value: string | null): value is PrivateCollectionLevel {
  return value === "unset" || value === "masterpiece" || value === "normal" || value === "used" || value === "discard";
}

function isMediaStatusFilter(value: string | null): value is MediaStatus | "all" {
  return value === "all" || value === "待觀看" || value === "已觀看" || value === "想重看" || value === "已刪除";
}

function isSortOrder(value: string | null): value is "asc" | "desc" {
  return value === "asc" || value === "desc";
}
