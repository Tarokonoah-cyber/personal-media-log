export function newId(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const body = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${body}`;
}

export function nowIso() {
  return new Date().toISOString();
}
