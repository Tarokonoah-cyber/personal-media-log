const PRIVATE_MARKERS = ["adult", "nsfw", "private", "\u6210\u4eba", "\u79c1\u5bc6"];

export function privateItemWhereSql(alias = "items") {
  return `(${alias}.is_private = 1)`;
}

export function publicItemWhereSql(alias = "items") {
  return `(coalesce(${alias}.is_private, 0) = 0)`;
}

export function isPrivateMarker(value: string) {
  const normalized = normalize(value);
  return PRIVATE_MARKERS.includes(normalized);
}

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}
