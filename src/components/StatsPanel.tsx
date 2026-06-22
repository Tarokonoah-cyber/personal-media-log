import { useEffect, useState } from "react";
import { getStats } from "../lib/api";
import type { StatsResponse } from "../types";

export function StatsPanel() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getStats().then(setStats).catch((err) => setError(err instanceof Error ? err.message : "讀取失敗"));
  }, []);

  if (error) return <div className="notice danger">{error}</div>;
  if (!stats) return <div className="empty">讀取中</div>;

  return (
    <div className="stats-grid">
      <Metric label="總筆數" value={stats.total} />
      <Metric label="今年" value={stats.currentYear} />
      <Metric label="平均評分" value={stats.averageRating || "-"} />
      <Metric label="待整理" value={stats.inbox} />
      <section className="span-2">
        <h2>每月觀看數</h2>
        <div className="bars">
          {stats.monthly.map((row) => <Bar key={row.month} label={row.month} value={row.count} max={Math.max(...stats.monthly.map((item) => item.count), 1)} />)}
        </div>
      </section>
      <Panel title="最高分 Top 20" rows={stats.top.map((item) => `${item.rating ?? "-"} · ${item.official_title || item.raw_title}`)} />
      <Panel title="最近觀看" rows={stats.recent.map((item) => `${item.watched_at || item.updated_at.slice(0, 10)} · ${item.official_title || item.raw_title}`)} />
      <Panel title="各分類數量" rows={stats.categories.map((row) => `${row.name} · ${row.count}`)} />
      <Panel title="各平台數量" rows={stats.platforms.map((row) => `${row.name} · ${row.count}`)} />
      <Panel title="標籤出現次數" rows={stats.tags.map((row) => `#${row.name} · ${row.count}`)} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <section className="metric"><span>{label}</span><strong>{value}</strong></section>;
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return <div className="bar"><span>{label}</span><i style={{ width: `${Math.max(8, (value / max) * 100)}%` }} /><b>{value}</b></div>;
}

function Panel({ title, rows }: { title: string; rows: string[] }) {
  return <section><h2>{title}</h2><ol className="rank-list">{rows.slice(0, 20).map((row) => <li key={row}>{row}</li>)}</ol></section>;
}
