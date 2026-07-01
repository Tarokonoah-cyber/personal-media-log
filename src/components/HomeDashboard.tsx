import { isThisWeek, isToday } from "../lib/date";
import { getStats } from "../lib/api";
import { getWatchStatus, progressLabel, watchStatusLabel } from "../lib/watch";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { MediaItem, StatsResponse, WatchStatus } from "../types";

const hiddenHomeTypes = new Set(["沙雕动画"]);

export function HomeDashboard({
  items = [],
  inboxTotal = 0,
  variant = "sidebar",
  includePrivate = false,
  onView,
  onSelect
}: {
  items?: MediaItem[];
  inboxTotal?: number;
  favoriteTotal?: number;
  variant?: "sidebar" | "main";
  includePrivate?: boolean;
  onView?: (view: string) => void;
  onSelect?: (item: MediaItem) => void;
}) {
  if (variant === "main") return <MainDashboard includePrivate={includePrivate} onView={onView} onSelect={onSelect} />;

  const todayCount = items.filter((item) => isToday(item.created_at)).length;
  const weekCount = items.filter((item) => isThisWeek(item.created_at)).length;

  return (
    <section className="summary-line" aria-label="觀看摘要">
      <span>今天 <b>{todayCount}</b></span>
      <span>本週 <b>{weekCount}</b></span>
      <span>待整理 <b>{inboxTotal}</b></span>
    </section>
  );
}

function MainDashboard({
  includePrivate,
  onView,
  onSelect
}: {
  includePrivate: boolean;
  onView?: (view: string) => void;
  onSelect?: (item: MediaItem) => void;
}) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getStats(includePrivate)
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "首頁資料載入失敗");
      });
    return () => {
      cancelled = true;
    };
  }, [includePrivate]);

  const monthlyTotal = useMemo(() => stats?.monthly.slice(0, 3).reduce((sum, row) => sum + Number(row.count || 0), 0) || 0, [stats]);

  if (error) return <div className="notice danger">{error}</div>;
  if (!stats) return <div className="empty">首頁載入中...</div>;

  return (
    <section className="home-dashboard-main" aria-label="首頁總覽">
      <header className="home-hero">
        <div>
          <p className="eyebrow">Today / 日常總覽</p>
          <h1>今天想整理哪一段觀看生活？</h1>
        </div>
        <div className="home-hero-actions">
          <button className="primary" onClick={() => onView?.("watching")}>繼續觀看</button>
          <button onClick={() => onView?.("plan_to_watch")}>待觀看</button>
          <button onClick={() => onView?.("database")}>全部資料</button>
        </div>
      </header>

      <div className="home-metrics">
        <DashboardMetric label="總紀錄" value={stats.total} onClick={() => onView?.("database")} />
        <DashboardMetric label="待整理" value={stats.inbox} onClick={() => onView?.("database")} />
        <DashboardMetric label="今年觀看" value={stats.currentYear} />
        <DashboardMetric label="平均評分" value={stats.averageRating || "-"} />
        <DashboardMetric label="近三月紀錄" value={monthlyTotal} />
      </div>

      <div className="home-dashboard-grid">
        <DashboardPanel title="觀看中" action="查看全部" onAction={() => onView?.("watching")}>
          <ItemRows items={stats.watching} empty="目前沒有觀看中的項目。" onSelect={onSelect} />
        </DashboardPanel>
        <DashboardPanel title="待觀看" action="查看全部" onAction={() => onView?.("plan_to_watch")}>
          <ItemRows items={stats.plan} empty="待觀看清單是空的。" onSelect={onSelect} />
        </DashboardPanel>
        <DashboardPanel title="最近更新">
          <ItemRows items={stats.recent} empty="尚無最近更新。" onSelect={onSelect} />
        </DashboardPanel>
        <DashboardPanel title="高分 Top">
          <ItemRows items={stats.top.slice(0, 8)} empty="還沒有評分資料。" onSelect={onSelect} showRating />
        </DashboardPanel>
        <DashboardPanel title="狀態分布">
          <StatusBars rows={stats.watchStatuses} onView={onView} />
        </DashboardPanel>
        <DashboardPanel title="類型分布">
          <SimpleBars rows={stats.types.filter((row) => !hiddenHomeTypes.has(row.name)).slice(0, 8)} />
        </DashboardPanel>
      </div>
    </section>
  );
}

function DashboardMetric({ label, value, onClick }: { label: string; value: string | number; onClick?: () => void }) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
    </>
  );
  if (onClick) return <button className="home-metric" onClick={onClick}>{content}</button>;
  return <div className="home-metric">{content}</div>;
}

function DashboardPanel({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) {
  return (
    <section className="home-panel">
      <header>
        <h2>{title}</h2>
        {action && <button onClick={onAction}>{action}</button>}
      </header>
      {children}
    </section>
  );
}

function ItemRows({ items, empty, onSelect, showRating = false }: { items: MediaItem[]; empty: string; onSelect?: (item: MediaItem) => void; showRating?: boolean }) {
  if (items.length === 0) return <p className="muted-cell">{empty}</p>;
  return (
    <div className="home-item-rows">
      {items.slice(0, 8).map((item) => (
        <button key={item.id} onClick={() => onSelect?.(item)}>
          <span>
            <strong>{item.official_title || item.raw_title}</strong>
            <em>{progressLabel(item) || watchStatusLabel(getWatchStatus(item))}</em>
          </span>
          <b>{showRating ? item.rating?.toFixed(1) || "-" : displayDate(item)}</b>
        </button>
      ))}
    </div>
  );
}

function StatusBars({ rows, onView }: { rows: Array<{ name: WatchStatus; label: string; count: number }>; onView?: (view: string) => void }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="dashboard-bars">
      {rows.map((row) => (
        <button key={row.name} onClick={() => onView?.(row.name)}>
          <span>{row.label}</span>
          <i style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
          <b>{row.count}</b>
        </button>
      ))}
    </div>
  );
}

function SimpleBars({ rows }: { rows: Array<{ name: string; count: number }> }) {
  const max = Math.max(1, ...rows.map((row) => Number(row.count || 0)));
  if (rows.length === 0) return <p className="muted-cell">尚無資料。</p>;
  return (
    <div className="dashboard-bars">
      {rows.map((row) => (
        <div key={row.name}>
          <span>{row.name}</span>
          <i style={{ width: `${Math.max(4, (Number(row.count || 0) / max) * 100)}%` }} />
          <b>{row.count}</b>
        </div>
      ))}
    </div>
  );
}

function displayDate(item: MediaItem) {
  return (item.watched_at || item.planned_at || item.updated_at || item.created_at).slice(0, 10);
}
