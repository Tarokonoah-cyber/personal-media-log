import { writeFile } from "node:fs/promises";

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, "").split("=");
  return [key, rest.join("=") || true];
}));
const baseUrl = String(args.baseUrl || "http://127.0.0.1:8788").replace(/\/$/, "");
const datasetSize = Number(args.dataset || 0);
const samples = Math.max(5, Number(args.samples || 15));
const warmups = Math.max(1, Number(args.warmups || 2));
const output = args.output ? String(args.output) : "";

if (![1200, 10000, 50000].includes(datasetSize)) throw new Error("--dataset must be 1200, 10000, or 50000");

async function request(path, init) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(120000) });
  const body = await response.json().catch(() => null);
  const durationMs = performance.now() - started;
  if (!response.ok) throw new Error(`${init?.method || "GET"} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  return { durationMs, body };
}

function percentile(values, value) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(value * sorted.length) - 1);
  return Number(sorted[index].toFixed(2));
}

async function measure(name, run, count = samples) {
  for (let index = 0; index < warmups; index += 1) await run(index, true);
  const durations = [];
  for (let index = 0; index < count; index += 1) durations.push((await run(index, false)).durationMs);
  return {
    name,
    samples: count,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    minMs: Number(Math.min(...durations).toFixed(2)),
    maxMs: Number(Math.max(...durations).toFixed(2))
  };
}

const privatePage = (await request("/api/private/items?page=1&pageSize=30&sort=code&order=asc")).body;
const safeItems = privatePage.items.filter((item) => !String(item.code || "").startsWith("DUP-")).slice(0, 10);
if (safeItems.length < 10) throw new Error("Benchmark requires ten non-duplicate private items");
const itemInput = (item, quickNote = item.quick_note) => {
  const { id: _id, created_at: _created, updated_at: _updated, deleted_at: _deleted, ...input } = item;
  return { ...input, quick_note: quickNote };
};

const metrics = [];
const endpoints = [
  ["initial_library", "/api/items?page=1&pageSize=100"],
  ["private_library", "/api/private/items?page=1&pageSize=100&sort=updated&order=desc"],
  ["search", "/api/private/items?page=1&pageSize=100&query=%E5%A4%A7%E9%87%8F%E6%95%B4%E7%90%86%E6%B8%AC%E8%A9%A6%E4%BD%9C%E5%93%81%20499"],
  ["sort_code", "/api/private/items?page=1&pageSize=100&sort=code&order=asc"],
  ["sort_people", "/api/private/items?page=1&pageSize=100&sort=people&order=asc"],
  ["pagination", "/api/private/items?page=10&pageSize=100&sort=code&order=asc"],
  ["filter", "/api/private/items?page=1&pageSize=100&platformFilters=FC2"],
  ["aggregate", "/api/public/aggregate?timezoneOffsetMinutes=-480"],
  ["data_quality", "/api/private/quality?page=1&pageSize=50"],
  ["missing_tags", "/api/private/quality?issueType=missing_tags&page=1&pageSize=50"],
  ["inbox_summary", "/api/private/inbox/summary"],
  ["inbox", "/api/private/inbox?category=missing_tags&page=1&pageSize=50"],
  ["duplicates", "/api/private/duplicates?page=1&pageSize=50"],
  ["entity_alias_lookup", "/api/private/normalization?entityType=maker&query=studio&limit=100"],
  ["open_item", `/api/items/${safeItems[0].id}`],
  ["next_item", `/api/items/${safeItems[1].id}`]
];

for (const [name, path] of endpoints) metrics.push(await measure(name, () => request(path)));

metrics.push(await measure("batch_update_10", async (index) => {
  const marker = `benchmark-${datasetSize}-${index}-${Date.now()}`;
  const apply = await request("/api/items/batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operations: safeItems.map((item) => ({ id: item.id, input: itemInput(item, marker) })) })
  });
  await request("/api/items/batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operations: safeItems.map((item) => ({ id: item.id, input: itemInput(item) })) })
  });
  return apply;
}, Math.min(samples, 10)));

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  datasetSize,
  samples,
  warmups,
  metrics
};
const json = `${JSON.stringify(report, null, 2)}\n`;
if (output) await writeFile(output, json, "utf8");
process.stdout.write(json);
