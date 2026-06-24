import { useEffect, useMemo, useState } from "react";
import { listItems } from "../lib/api";
import { classifyItem } from "../lib/taxonomy";
import { getWatchStatus, isSeriesLike, watchStatusLabel } from "../lib/watch";
import type { MediaItem } from "../types";

export function StatsPanel({ includePrivate }: { includePrivate: boolean }) {
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
      codeQuery: "",
      titleQuery: "",
      person: "",
      studio: "",
      watchedFrom: "",
      watchedTo: "",
      updatedFrom: "",
      updatedTo: "",
      page: 1,
      pageSize: 100,
      includePrivate
    }).then((result) => setItems(result.items)).catch((err) => setError(err instanceof Error ? err.message : "讀取統計失敗"));
  }, [includePrivate]);

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
  if (items.length === 0) return <div className="empty">還沒有紀錄。</div>;

  return (
    <div className="stats-grid">
      <Metric label="總數" value={stats.total} />
      <Metric label="待觀看" value={stats.plan} />
      <Metric label="觀看中" value={stats.watching} />
      <Metric label="看完" value={stats.completed} />
      <Metric label="本月新增" value={stats.monthAdded} />
      <Metric label="平均評分" value={stats.average} />
      <Metric label="追劇中" value={stats.watchingSeries} />
      <Panel title="高分 Top 10" rows={stats.top.map((item) => `${item.rating ?? "-"} · ${item.official_title || item.raw_title}`)} />
      <Panel title="各類型數量" rows={Object.entries(stats.typeCounts).map(([name, count]) => `${name} · ${count}`)} />
      <Panel title="各觀看狀態數量" rows={Object.entries(stats.statusCounts).map(([name, count]) => `${name} · ${count}`)} />
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
    const key = fn(item) || "其他";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
