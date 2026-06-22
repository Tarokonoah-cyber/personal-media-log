import { createBackup, listBackups, restoreBackup } from "../_lib/backup";
import { error, handleError, json, noContent, notFound, readJson, requireAccess } from "../_lib/http";
import { parseCsv, parseJsonItems, toCsv } from "../_lib/importExport";
import { createItem, exportItems, getItem, getStats, importItems, isLikelyDuplicate, listItems, softDeleteItem, updateItem } from "../_lib/items";
import type { Env, ItemInput, ItemListParams, ItemStatus } from "../_lib/types";

export const onRequest: PagesFunction<Env, "path"> = async (context) => {
  try {
    const actor = requireAccess(context.request, context.env);
    const url = new URL(context.request.url);
    const path = getPath(context.params.path);
    const method = context.request.method.toUpperCase();

    if (method === "GET" && path.length === 1 && path[0] === "health") {
      return json({ ok: true });
    }

    if (path[0] === "items") {
      if (method === "GET" && path.length === 1) return json(await listItems(context.env, getListParams(url)));
      if (method === "POST" && path.length === 1) return json(await createItem(context.env, actor, await readJson<ItemInput>(context.request)), { status: 201 });
      if (path.length === 2) {
        if (method === "GET") return json(await getItem(context.env, path[1]));
        if (method === "PUT") return json(await updateItem(context.env, actor, path[1], await readJson<ItemInput>(context.request)));
        if (method === "DELETE") {
          await softDeleteItem(context.env, actor, path[1]);
          return noContent();
        }
      }
    }

    if (method === "GET" && path.length === 1 && path[0] === "stats") {
      return json(await getStats(context.env));
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
            "content-disposition": `attachment; filename="media-log-${new Date().toISOString().slice(0, 10)}.csv"`
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
    "release_year",
    "watched_at",
    "rating",
    "rewatch_score",
    "favorite",
    "status",
    "quick_note",
    "long_note",
    "source_url",
    "cover_url",
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
  return {
    query: optional(url.searchParams.get("query")),
    status: isStatusFilter(status) ? status : "all",
    favorite: url.searchParams.get("favorite") === "true",
    highRated: url.searchParams.get("highRated") === "true",
    type: optional(url.searchParams.get("type")),
    tag: optional(url.searchParams.get("tag")),
    year: optionalNumber(url.searchParams.get("year")),
    platform: optional(url.searchParams.get("platform")),
    watchedFrom: optional(url.searchParams.get("watchedFrom")),
    watchedTo: optional(url.searchParams.get("watchedTo")),
    page: optionalNumber(url.searchParams.get("page")) || 1,
    pageSize: optionalNumber(url.searchParams.get("pageSize")) || 25
  };
}

function optional(value: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function optionalNumber(value: string | null) {
  const number = Number(value);
  return Number.isFinite(number) && value !== null && value !== "" ? number : undefined;
}

function isStatusFilter(value: string | null): value is ItemStatus | "all" | "inbox" | "organized" {
  return value === "all" || value === "inbox" || value === "organized" || value === "raw" || value === "partial" || value === "complete" || value === "archived" || value === "deleted";
}
