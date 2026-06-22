import { HttpError } from "./http";
import { newId, nowIso } from "./ids";
import { exportItems, importItems } from "./items";
import type { Actor, Env, ItemInput } from "./types";

export async function createBackup(env: Env, actor: Actor, kind: "manual" | "scheduled") {
  if (!env.MEDIA_LOG_BACKUPS) throw new HttpError(503, "R2 bucket binding is not configured");
  const items = await exportItems(env);
  const payload = JSON.stringify({
    version: 1,
    exported_at: nowIso(),
    item_count: items.length,
    items
  });
  const encrypted = await encrypt(payload, env);
  const key = `backups/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${kind}.json.enc`;
  await env.MEDIA_LOG_BACKUPS.put(key, encrypted, {
    httpMetadata: { contentType: "application/octet-stream" },
    customMetadata: { kind, encrypted: "aes-gcm", itemCount: String(items.length) }
  });

  const id = newId("backup");
  await env.MEDIA_LOG_DB.prepare("INSERT INTO backup_jobs (id, r2_key, kind, encrypted, item_count, status) VALUES (?, ?, ?, 1, ?, 'created')")
    .bind(id, key, kind, items.length)
    .run();
  await env.MEDIA_LOG_DB.prepare("INSERT INTO audit_logs (id, actor_email, action, entity_type, entity_id, metadata_json) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(newId("audit"), actor.email, "backup", "backup_job", id, JSON.stringify({ key, kind }))
    .run();

  return { id, key, itemCount: items.length };
}

export async function listBackups(env: Env) {
  const rows = await env.MEDIA_LOG_DB.prepare("SELECT id, r2_key, kind, encrypted, item_count, created_at, restored_at, status FROM backup_jobs ORDER BY datetime(created_at) DESC LIMIT 100").all();
  return rows.results || [];
}

export async function restoreBackup(env: Env, actor: Actor, backupId: string) {
  if (!env.MEDIA_LOG_BACKUPS) throw new HttpError(503, "R2 bucket binding is not configured");
  const backup = await env.MEDIA_LOG_DB.prepare("SELECT id, r2_key FROM backup_jobs WHERE id = ?").bind(backupId).first<{ id: string; r2_key: string }>();
  if (!backup) throw new HttpError(404, "Backup not found");
  const object = await env.MEDIA_LOG_BACKUPS.get(backup.r2_key);
  if (!object) throw new HttpError(404, "Backup object not found in R2");
  const encrypted = await object.arrayBuffer();
  const decrypted = await decrypt(encrypted, env);
  const parsed = JSON.parse(decrypted) as { items?: ItemInput[] };
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const result = await importItems(env, actor, items, backup.r2_key, "json");
  await env.MEDIA_LOG_DB.prepare("UPDATE backup_jobs SET restored_at = ?, status = 'restored' WHERE id = ?").bind(nowIso(), backupId).run();
  return result;
}

async function encrypt(plainText: string, env: Env) {
  const key = await getCryptoKey(env, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plainText);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const bytes = new Uint8Array(iv.byteLength + cipher.byteLength);
  bytes.set(iv, 0);
  bytes.set(new Uint8Array(cipher), iv.byteLength);
  return bytes;
}

async function decrypt(encrypted: ArrayBuffer, env: Env) {
  const bytes = new Uint8Array(encrypted);
  if (bytes.byteLength <= 12) throw new HttpError(400, "Backup payload is invalid");
  const key = await getCryptoKey(env, ["decrypt"]);
  const iv = bytes.slice(0, 12);
  const cipher = bytes.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

async function getCryptoKey(env: Env, usages: string[]) {
  const secret = env.BACKUP_ENCRYPTION_KEY_B64;
  if (!secret) throw new HttpError(503, "BACKUP_ENCRYPTION_KEY_B64 is not configured");
  const raw = base64ToBytes(secret);
  if (raw.byteLength !== 32) throw new HttpError(503, "BACKUP_ENCRYPTION_KEY_B64 must decode to 32 bytes");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, usages as never);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
