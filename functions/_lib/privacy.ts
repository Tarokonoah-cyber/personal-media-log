const PRIVATE_CONTAINS_TERMS = [
  "adult",
  "nsfw",
  "private",
  "porn",
  "porno",
  "pornography",
  "jav",
  "r18",
  "18+",
  "xxx",
  "\u6210\u4eba",
  "\u79c1\u5bc6"
];

const PRIVATE_TOKEN_TERMS = ["av"];

export function privateItemWhereSql(alias = "items") {
  const textSql = `lower(coalesce(${alias}.type, '') || ' ' || coalesce(${alias}.category, '') || ' ' || coalesce(${alias}.platform, '') || ' ' || coalesce(${alias}.metadata_json, ''))`;
  const paddedTextSql = `(' ' || replace(replace(replace(replace(${textSql}, '-', ' '), '_', ' '), '/', ' '), '.', ' ') || ' ')`;
  const containsSql = PRIVATE_CONTAINS_TERMS.map((term) => `${textSql} LIKE '%${sqlText(term)}%'`).join(" OR ");
  const tokenSql = PRIVATE_TOKEN_TERMS.map((term) => `${paddedTextSql} LIKE '% ${sqlText(term)} %'`).join(" OR ");
  const tagSql = `EXISTS (
    SELECT 1
    FROM item_tags privacy_it
    JOIN tags privacy_tags ON privacy_tags.id = privacy_it.tag_id
    WHERE privacy_it.item_id = ${alias}.id
      AND (${privateTagSql("privacy_tags.name")})
  )`;

  return `(${alias}.is_private = 1 OR ${containsSql} OR ${tokenSql} OR ${tagSql})`;
}

export function publicItemWhereSql(alias = "items") {
  return `(NOT ${privateItemWhereSql(alias)})`;
}

export function hasPrivateSignalValues(values: unknown[]) {
  const text = values.flatMap(flattenValue).filter(Boolean).join(" ");
  return hasPrivateSignalText(text);
}

export function isPrivateMarker(value: string) {
  const normalized = normalize(value);
  return PRIVATE_CONTAINS_TERMS.includes(normalized) || PRIVATE_TOKEN_TERMS.includes(normalized);
}

function privateTagSql(column: string) {
  const lowered = `lower(${column})`;
  const exactTerms = [...PRIVATE_CONTAINS_TERMS, ...PRIVATE_TOKEN_TERMS].map((term) => `'${sqlText(term)}'`).join(", ");
  const containsSql = PRIVATE_CONTAINS_TERMS.map((term) => `${lowered} LIKE '%${sqlText(term)}%'`).join(" OR ");
  return `${lowered} IN (${exactTerms}) OR ${containsSql}`;
}

function hasPrivateSignalText(value: string) {
  const normalized = normalize(value);
  const padded = ` ${normalized.replace(/[^a-z0-9\u4e00-\u9fff+]+/g, " ")} `;
  return PRIVATE_CONTAINS_TERMS.some((term) => normalized.includes(term)) || PRIVATE_TOKEN_TERMS.some((term) => padded.includes(` ${term} `));
}

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function flattenValue(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(flattenValue);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(flattenValue);
  return [String(value)];
}

function sqlText(value: string) {
  return value.toLowerCase().replace(/'/g, "''");
}
