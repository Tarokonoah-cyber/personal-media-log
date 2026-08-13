import type { BackupJob, BatchUpdateOperation, BatchUpdateResponse, EntityMergePreview, ImportPreview, ItemInput, ItemListResponse, ListFilters, MediaItem, MetadataSuggestionListResponse, MetadataSuggestionPreviewResponse, MetadataSuggestionStatus, NormalizationEntityType, NormalizationOverview, PrivateCodeConflictResponse, PrivateFacetSearchResponse, PrivateFacets, PrivateIssueType, PrivateQualityResponse, PublicAggregateResponse, SmartAddResponse, StatsResponse, TmdbSearchResponse } from "../types";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText })) as {
      error?: string;
      details?: { inputCode?: string; normalizedCode?: string; existing?: { code?: string; title?: string } };
    };
    if (response.status === 409 && body.details?.normalizedCode) {
      throw new Error(formatDuplicateCodeError(body.details));
    }
    throw new Error(body.error || response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function listItems(filters: ListFilters, signal?: AbortSignal) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value !== false && value !== null && value !== undefined) params.set(key, String(value));
  });
  return request<ItemListResponse>(`/api/items?${params.toString()}`, { signal });
}

export function formatDuplicateCodeError(details: { inputCode?: string; normalizedCode?: string; existing?: { code?: string; title?: string } }) {
  const code = details.existing?.code || details.normalizedCode || details.inputCode || "此番號";
  return `番號「${code}」已有其他紀錄；請確認是否為重複作品。`;
}

export function listPrivateItems(filters: ListFilters, signal?: AbortSignal) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value !== false && value !== null && value !== undefined) params.set(key, String(value));
  });
  return request<ItemListResponse>(`/api/private/items?${params.toString()}`, { signal });
}

export function getItem(id: string) {
  return request<MediaItem>(`/api/items/${id}`);
}

export function getPrivateFacets(filters: ListFilters) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, page: 1, pageSize: 1, privateOnly: true, includePrivate: true, includeFacets: false }).forEach(([key, value]) => {
    if (value !== "" && value !== false && value !== null && value !== undefined) params.set(key, String(value));
  });
  return request<PrivateFacets>(`/api/private/facets?${params}`);
}

export function searchPrivateFacet(facet: "actress" | "tag" | "studio", query = "", limit = 30, signal?: AbortSignal) {
  const params = new URLSearchParams({ facet, q: query.trim(), limit: String(Math.min(50, Math.max(1, limit))) });
  return request<PrivateFacetSearchResponse>(`/api/private/facets?${params}`, { signal });
}

export function checkPrivateCodeConflict(code: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ code: code.trim() });
  return request<PrivateCodeConflictResponse>(`/api/private/code-conflict?${params}`, { signal });
}

export function getPrivateQuality(issueType?: PrivateIssueType, page = 1, pageSize = 50, ignored = false) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ignored: String(ignored) });
  if (issueType) params.set("issueType", issueType);
  return request<PrivateQualityResponse>(`/api/private/quality?${params}`);
}

export function ignorePrivateQualityIssue(itemId: string, issueType: PrivateIssueType, issueKey: string) {
  return request<{ id: string }>("/api/private/quality/ignores", { method: "POST", body: JSON.stringify({ itemId, issueType, issueKey }) });
}

export function unignorePrivateQualityIssue(itemId: string, issueType: PrivateIssueType, issueKey: string) {
  return request<void>("/api/private/quality/ignores", { method: "DELETE", body: JSON.stringify({ itemId, issueType, issueKey }) });
}

export function refreshMetadataSuggestions() {
  return request<{ generated: number }>("/api/private/suggestions/refresh", { method: "POST", body: "{}" });
}

export function listMetadataSuggestions(status: MetadataSuggestionStatus = "pending", page = 1, pageSize = 50, itemId?: string) {
  const params = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) });
  if (itemId) params.set("itemId", itemId);
  return request<MetadataSuggestionListResponse>(`/api/private/suggestions?${params}`);
}

export function previewMetadataSuggestions(ids: string[]) {
  return request<MetadataSuggestionPreviewResponse>("/api/private/suggestions/preview", { method: "POST", body: JSON.stringify({ ids }) });
}

export function applyMetadataSuggestions(ids: string[]) {
  return request<BatchUpdateResponse & { acceptedSuggestionIds: string[] }>("/api/private/suggestions/apply", {
    method: "POST",
    body: JSON.stringify({ ids, confirmed: true })
  });
}

export function decideMetadataSuggestions(ids: string[], decision: "rejected" | "ignored") {
  return request<{ decision: string; requested: number; changed: number }>("/api/private/suggestions/decision", {
    method: "POST",
    body: JSON.stringify({ ids, decision })
  });
}

export function getNormalizationOverview(entityType: NormalizationEntityType, query = "", limit = 500) {
  const params = new URLSearchParams({ entityType, q: query, limit: String(limit) });
  return request<NormalizationOverview>(`/api/private/normalization?${params}`);
}

export function registerEntityAlias(entityType: NormalizationEntityType, canonicalValue: string, aliasValue: string) {
  return request<{ canonical: string; alias: string; dataChanged: false }>("/api/private/normalization/aliases", {
    method: "POST",
    body: JSON.stringify({ entityType, canonicalValue, aliasValue })
  });
}

export function previewEntityMerge(entityType: "tag" | "person", sourceValue: string, targetValue: string) {
  return request<EntityMergePreview>("/api/private/normalization/merge/preview", {
    method: "POST",
    body: JSON.stringify({ entityType, sourceValue, targetValue })
  });
}

export function applyEntityMerge(entityType: "tag" | "person", sourceValue: string, targetValue: string) {
  return request<EntityMergePreview & { mergeId: string; applied: true; recoveryAvailable: true }>("/api/private/normalization/merge/apply", {
    method: "POST",
    body: JSON.stringify({ entityType, sourceValue, targetValue, confirmed: true })
  });
}

export function rollbackEntityMerge(mergeId: string) {
  return request<{ mergeId: string; rolledBack: true }>("/api/private/normalization/merge/rollback", {
    method: "POST",
    body: JSON.stringify({ mergeId, confirmed: true })
  });
}

export function createItem(input: ItemInput) {
  return request<MediaItem>("/api/items", { method: "POST", body: JSON.stringify(input) });
}

export function updateItem(id: string, input: ItemInput) {
  return request<MediaItem>(`/api/items/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function batchUpdateItems(operations: BatchUpdateOperation[]) {
  return request<BatchUpdateResponse>("/api/items/batch", { method: "POST", body: JSON.stringify({ operations }) });
}

export function quickUpdateItem(id: string, field: "collection_level" | "rating" | "used" | "private_status", value: unknown) {
  return request<MediaItem>(`/api/items/${id}/quick`, { method: "PATCH", body: JSON.stringify({ field, value }) });
}

export function deleteItem(id: string) {
  return request<void>(`/api/items/${id}`, { method: "DELETE" });
}

export function getStats(includePrivate = false) {
  return request<StatsResponse>(`/api/stats?includePrivate=${includePrivate}`);
}

export function getPublicAggregate() {
  const timezoneOffsetMinutes = new Date().getTimezoneOffset();
  return request<PublicAggregateResponse>(`/api/public/aggregate?timezoneOffsetMinutes=${timezoneOffsetMinutes}`);
}

export function previewImport(content: string, sourceType: "csv" | "json", sourceName: string) {
  return request<ImportPreview>("/api/import/preview", { method: "POST", body: JSON.stringify({ content, sourceType, sourceName }) });
}

export function commitImport(rows: ItemInput[], sourceType: "csv" | "json", sourceName: string) {
  return request<{ jobId: string; imported: number; skipped: number; duplicates: string[] }>("/api/import/commit", {
    method: "POST",
    body: JSON.stringify({ rows, sourceType, sourceName })
  });
}

export function listBackups() {
  return request<BackupJob[]>("/api/backups");
}

export function createBackup() {
  return request<{ id: string; key: string; itemCount: number }>("/api/backups", { method: "POST", body: "{}" });
}

export function restoreBackup(id: string) {
  return request<{ imported: number; skipped: number }>(`/api/backups/${id}/restore`, { method: "POST", body: "{}" });
}

export function searchMetadata(itemId: string, query?: string) {
  return request<TmdbSearchResponse>("/api/metadata/search", {
    method: "POST",
    body: JSON.stringify({ itemId, query })
  });
}

export function applyMetadata(itemId: string, tmdb_id: number, media_type: "movie" | "tv") {
  return request<MediaItem>("/api/metadata/apply", {
    method: "POST",
    body: JSON.stringify({ itemId, tmdb_id, media_type })
  });
}

export function parseSmartAdd(text: string) {
  return request<SmartAddResponse>("/api/smart-add/parse", {
    method: "POST",
    body: JSON.stringify({ text })
  });
}

export function exportJsonUrl() {
  return "/api/export/json";
}

export function exportCsvUrl() {
  return "/api/export/csv";
}
