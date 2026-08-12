import { normalizeTags, parseTagInput } from "./tags";

const RECENT_TAGS_KEY = "private-recent-tags-v1";
const TAG_ALIASES_KEY = "private-tag-aliases-v1";
const MAX_RECENT_TAGS = 12;

export type TagAliases = Record<string, string>;

export function readRecentTags(): string[] {
  return readJson<string[]>(RECENT_TAGS_KEY, []).filter((value): value is string => typeof value === "string").slice(0, MAX_RECENT_TAGS);
}
export function rememberRecentTags(tags: readonly string[]) {
  const next = normalizeTags([...tags, ...readRecentTags()]).slice(0, MAX_RECENT_TAGS);
  writeJson(RECENT_TAGS_KEY, next);
  return next;
}

export function readTagAliases(): TagAliases {
  const aliases = readJson<Record<string, unknown>>(TAG_ALIASES_KEY, {});
  return Object.fromEntries(
    Object.entries(aliases)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[0].trim()) && Boolean(entry[1].trim()))
      .map(([alias, canonical]) => [tagKey(alias), canonical.trim()])
  );
}

export function saveTagAlias(alias: string, canonical: string) {
  const aliasKey = tagKey(alias);
  const canonicalTag = parseTagInput(canonical)[0] || "";
  if (!aliasKey || !canonicalTag || aliasKey === tagKey(canonicalTag)) return false;
  writeJson(TAG_ALIASES_KEY, { ...readTagAliases(), [aliasKey]: canonicalTag });
  return true;
}

export function canonicalizeTagInput(input: string, knownTags: readonly string[] = [], aliases = readTagAliases()) {
  const canonicalByKey = new Map(normalizeTags(knownTags).map((tag) => [tagKey(tag), tag]));
  return normalizeTags(parseTagInput(input).map((tag) => {
    const aliased = aliases[tagKey(tag)] || tag;
    return canonicalByKey.get(tagKey(aliased)) || aliased;
  }));
}

export function rankTagSuggestions(
  knownTags: readonly string[],
  query: string,
  recentTags: readonly string[] = readRecentTags(),
  aliases = readTagAliases()
) {
  const needle = tagKey(query);
  const candidates = canonicalizeTagInput([...recentTags, ...knownTags, ...Object.values(aliases)].join(","), knownTags, aliases);
  return candidates
    .filter((tag) => !needle || tagKey(tag).includes(needle) || Object.entries(aliases).some(([alias, canonical]) => tagKey(canonical) === tagKey(tag) && alias.includes(needle)))
    .slice(0, 12);
}

function tagKey(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Device-local workflow hints are optional.
  }
}
