import { useEffect, useMemo, useState } from "react";
import { listItems } from "../lib/api";
import { classifyItem } from "../lib/taxonomy";
import { getWatchStatus, isSeriesLike, watchStatusLabel } from "../lib/watch";
import type { MediaItem } from "../types";

export function StatsPanel() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listItems({
      query: "",
      status: "all",
      favorite: false,
      highRated: false,
      type: "",
      tag: "",
      year: "",
      platform: "",
      watchedFrom: "",
      watchedTo: "",
      page: 1,
      pageSize: 100
    }).then((result) => setItems(result.items)).catch((err) => setError(err instanceof Error ? err.message : "Failed to load stats"));
  }, []);

  const stats = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    const rated = items.filter((item) => item.rating !== null);
    const typeCounts = countBy(items, (item) => classifyItem(item).type);
    const statusCounts = countBy(items, (item) => watchStatusLabel(getWatchStatus(item)));
    return {
      total: items.length,
      plan: items.filter((item) => getWatchStatus(item) === "plan_to_watch").length,
      watching: items.filter((item) => getWatchStatus(item) === "watching").length,
      completed: items.filter((item) => getWatchStatus(item) === "completed").length,
      monthAdded: items.filter((item) => item.created_at.startsWith(month)).length,
      average: rated.length ? (rated.reduce((sum, item) => sum + (item.rating || 0), 0) / rated.length).toFixed(2) : "-",
      top: [...rated].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10),
      typeCounts,
      statusCounts,
      watchingSeries: items.filter((item) => isSeriesLike(item) && getWatchStatus(item) === "watching").length
    };
  }, [items]);

  if (error) return <div className="notice danger">{error}</div>;
  if (items.length === 0) return <div className="empty">No records yet.</div>;

  return (
    <div className="stats-grid">
      <Metric label="Total" value={stats.total} />
      <Metric label="Plan to Watch" value={stats.plan} />
      <Metric label="Watching" value={stats.watching} />
      <Metric label="Completed" value={stats.completed} />
      <Metric label="Added This Month" value={stats.monthAdded} />
      <Metric label="Average Rating" value={stats.average} />
      <Metric label="Watching Series" value={stats.watchingSeries} />
      <Panel title="High Rated Top 10" rows={stats.top.map((item) => `${item.rating ?? "-"} · ${item.official_title || item.raw_title}`)} />
      <Panel title="By Type" rows={Object.entries(stats.typeCounts).map(([name, count]) => `${name} · ${count}`)} />
      <Panel title="By Watch Status" rows={Object.entries(stats.statusCounts).map(([name, count]) => `${name} · ${count}`)} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <section className="metric"><span>{label}</span><strong>{value}</strong></section>;
}

function Panel({ title, rows }: { title: string; rows: string[] }) {
  return <section><h2>{title}</h2><ol className="rank-list">{rows.slice(0, 20).map((row) => <li key={row}>{row}</li>)}</ol></section>;
}

function countBy(items: MediaItem[], fn: (item: MediaItem) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = fn(item) || "Other";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
