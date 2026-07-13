export function parseTagInput(value: string) {
  return Array.from(new Set(
    value
      .split(/[#,\uFF0C\u3001;\uFF1B\n\r\t]+/)
      .map((tag) => normalizeTag(tag))
      .filter(Boolean)
  ));
}

export function normalizeTags(tags: readonly string[]) {
  return Array.from(new Set(tags.map((tag) => normalizeTag(tag)).filter(Boolean)));
}

export function addTags(current: readonly string[], value: string) {
  return normalizeTags([...current, ...parseTagInput(value)]);
}

function normalizeTag(value: string) {
  return value.trim().replace(/^#+/, "").replace(/\s+/g, " ");
}
