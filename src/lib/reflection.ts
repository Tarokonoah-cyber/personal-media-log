import type { MediaItem } from "../types";

export type ReflectionField = "mood" | "rewatch_intent" | "collection_level";

export const moodOptions = ["爽", "普通", "失望", "神作"] as const;
export const rewatchIntentOptions = ["想重看", "可重看", "不會重看"] as const;
export const collectionLevelOptions = ["一般", "喜歡", "私藏"] as const;

export type ItemReflection = Record<ReflectionField, string>;

const emptyReflection: ItemReflection = {
  mood: "",
  rewatch_intent: "",
  collection_level: ""
};

export function getItemReflection(item: MediaItem) {
  return getReflectionFromMetadata(parseMetadata(item.metadata_json));
}

export function getReflectionFromMetadata(metadata: Record<string, unknown>): ItemReflection {
  const nested = metadata.reflection && typeof metadata.reflection === "object" && !Array.isArray(metadata.reflection)
    ? metadata.reflection as Record<string, unknown>
    : {};
  return {
    mood: stringValue(nested.mood ?? metadata.mood),
    rewatch_intent: stringValue(nested.rewatch_intent ?? metadata.rewatch_intent),
    collection_level: stringValue(nested.collection_level ?? metadata.collection_level)
  };
}

export function mergeReflectionMetadata(value: string | null, reflection: ItemReflection) {
  const metadata = parseMetadata(value);
  const nextReflection = {
    ...(metadata.reflection && typeof metadata.reflection === "object" && !Array.isArray(metadata.reflection)
      ? metadata.reflection as Record<string, unknown>
      : {})
  };

  setOrDelete(nextReflection, "mood", reflection.mood);
  setOrDelete(nextReflection, "rewatch_intent", reflection.rewatch_intent);
  setOrDelete(nextReflection, "collection_level", reflection.collection_level);

  if (Object.keys(nextReflection).length > 0) metadata.reflection = nextReflection;
  else delete metadata.reflection;

  delete metadata.mood;
  delete metadata.rewatch_intent;
  delete metadata.collection_level;

  return metadata;
}

export function reflectionFromText(input: string): ItemReflection {
  return {
    mood: firstMatch(input, moodOptions),
    rewatch_intent: firstMatch(input, rewatchIntentOptions),
    collection_level: firstMatch(input, collectionLevelOptions)
  };
}

export function hasReflection(reflection: ItemReflection) {
  return Boolean(reflection.mood || reflection.rewatch_intent || reflection.collection_level);
}

function parseMetadata(value: string | null) {
  if (!value) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function setOrDelete(metadata: Record<string, unknown>, key: string, value: string) {
  if (value.trim()) metadata[key] = value.trim();
  else delete metadata[key];
}

function firstMatch(input: string, options: readonly string[]) {
  return options.find((option) => input.includes(option)) || "";
}
