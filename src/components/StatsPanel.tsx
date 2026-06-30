import { useEffect, useMemo, useState } from "react";
import { getStats } from "../lib/api";
import type { StatsResponse } from "../types";

export function StatsPanel({ includePrivate }: { includePrivate: boolean }) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getStats(includePrivate).then(setStats).catch((err) => setError(err instanceof Error ? err.message : "讀取統計失敗"));
  }, [includePrivate]);

  const metrics = useMemo(() => ({
    plan: stats?.watchStatuses.find((row) => row.name === "plan_to_watch")?.count || 0,
    watching: stats?.watchStatuses.find((row) => row.name === "watching")?.count || 0,
    completed: stats?.watchStatuses.find((row) => row.name === "completed")?.count || 0,
    monthAdded: stats?.monthly[0]?.count || 0,
    watchingSeries: stats?.watching.length || 0
  }), [stats]);

  if (error) return <div className="notice danger">{error}</div>;
  if (!stats) return <div className="empty">統計載入中...</div>;
  if (stats.total === 0) return <div className="empty">還沒有紀錄。</div>;

  return (
    <div className="stats-grid">
      <Metric label="總數" value={stats.total} />
      <Metric label="待觀看" value={metrics.plan} />
      <Metric label="觀看中" value={metrics.watching} />
      <Metric label="看完" value={metrics.completed} />
      <Metric label="最近月份" value={metrics.monthAdded} />
      <Metric label="平均評分" value={stats.averageRating || "-"} />
      <Metric label="追劇中" value={metrics.watchingSeries} />
      <Panel title="高分 Top 10" rows={stats.top.map((item) => `${item.rating ?? "-"} · ${item.official_title || item.raw_title}`)} />
      <Panel title="各類型數量" rows={stats.types.map((row) => `${row.name} · ${row.count}`)} />
      <Panel title="各觀看狀態數量" rows={stats.watchStatuses.map((row) => `${row.label} · ${row.count}`)} />
      <Panel title="每月紀錄" rows={stats.monthly.map((row) => `${row.month} · ${row.count}`)} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <section className="metric"><span>{label}</span><strong>{value}</strong></section>;
}

function Panel({ title, rows }: { title: string; rows: string[] }) {
  return <section><h2>{title}</h2><ol className="rank-list">{rows.slice(0, 20).map((row) => <li key={row}>{row}</li>)}</ol></section>;
}
