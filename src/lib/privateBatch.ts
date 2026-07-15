import type { ItemInput, MediaItem } from "../types";
import { normalizeTags, parseTagInput } from "./tags";

export type BatchOperationResult = {
  succeededIds: string[];
  failedIds: string[];
  cancelled?: boolean;
};

export function togglePageItemSelection(current: readonly string[], id: string) {
  return current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
}

export function togglePageSelection(current: readonly string[], items: readonly { id: string }[]) {
  return items.length > 0 && current.length === items.length ? [] : items.map((item) => item.id);
}

export function retainVisibleSelection(current: readonly string[], items: readonly { id: string }[]) {
  const visibleIds = new Set(items.map((item) => item.id));
  return current.filter((id) => visibleIds.has(id));
}

export async function runLimitedBatch<T extends { id: string }>(
  items: readonly T[],
  action: (item: T) => Promise<unknown>,
  concurrency = 5
): Promise<BatchOperationResult> {
  const succeededIds: string[] = [];
  const failedIds: string[] = [];
  let cursor = 0;
  const workerCount = Math.min(items.length, Math.max(1, concurrency));

  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        await action(item);
        succeededIds.push(item.id);
      } catch {
        failedIds.push(item.id);
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return { succeededIds, failedIds };
}

export function privateBatchTagPatch(item: MediaItem, input: string, mode: "add" | "remove"): Partial<ItemInput> {
  const tags = parseTagInput(input);
  if (mode === "add") return { tags: normalizeTags([...item.tags, ...tags]) };
  const removals = new Set(tags);
  return { tags: normalizeTags(item.tags.filter((tag) => !removals.has(tag))) };
}
