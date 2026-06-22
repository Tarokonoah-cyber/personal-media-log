import type { BackupJob, ImportPreview, ItemInput, ItemListResponse, ListFilters, MediaItem, StatsResponse } from "../types";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function listItems(filters: ListFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value !== false && value !== null && value !== undefined) params.set(key, String(value));
  });
  return request<ItemListResponse>(`/api/items?${params.toString()}`);
}

export function createItem(input: ItemInput) {
  return request<MediaItem>("/api/items", { method: "POST", body: JSON.stringify(input) });
}

export function updateItem(id: string, input: ItemInput) {
  return request<MediaItem>(`/api/items/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteItem(id: string) {
  return request<void>(`/api/items/${id}`, { method: "DELETE" });
}

export function getStats() {
  return request<StatsResponse>("/api/stats");
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

export function exportJsonUrl() {
  return "/api/export/json";
}

export function exportCsvUrl() {
  return "/api/export/csv";
}
