import { ArrowRight, Bookmark, ClipboardList, PlayCircle } from "lucide-react";
import { isThisWeek, isToday } from "../lib/date";
import { getStats } from "../lib/api";
import { getWatchStatus, progressLabel, watchStatusLabel } from "../lib/watch";
import { classifyItem } from "../lib/taxonomy";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { MediaItem, StatsResponse } from "../types";

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

  const homeItems = useMemo(() => ({
    watching: filterHomeItems(stats?.watching || []),
    plan: filterHomeItems(stats?.plan || []),
    recent: filterHomeItems(stats?.recent || [])
  }), [stats]);

  if (error) return <div className="notice danger">{error}</div>;
  if (!stats) return <div className="empty">首頁載入中...</div>;

  return (
    <section className="home-dashboard-main" aria-label="首頁總覽">
      <header className="home-hero">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>觀看工作台</h1>
        </div>
      </header>

      <div className="home-action-grid">
        <ActionSection
          title="繼續觀看"
          count={homeItems.watching.length}
          icon={<PlayCircle size={17} />}
          action="開啟"
          onAction={() => onView?.("watching")}
          visualItem={homeItems.watching[0]}
          tone="blue"
          featured
        >
          <ItemRows items={homeItems.watching} empty="無項目" onSelect={onSelect} />
        </ActionSection>
        <ActionSection
          title="待整理"
          count={stats.inbox}
          icon={<ClipboardList size={17} />}
          action="開啟"
          onAction={() => onView?.("inbox")}
          visualLabel={stats.inbox > 0 ? "待補資料" : "已整理"}
          tone="green"
        >
          <p className="home-action-note">
            {stats.inbox > 0 ? `${stats.inbox} 筆資料待補完整` : "無待整理項目"}
          </p>
        </ActionSection>
        <ActionSection
          title="待觀看"
          count={homeItems.plan.length}
          icon={<Bookmark size={17} />}
          action="開啟"
          onAction={() => onView?.("plan_to_watch")}
          visualItem={homeItems.plan[0]}
          tone="amber"
        >
          <ItemRows items={homeItems.plan} empty="無項目" onSelect={onSelect} />
        </ActionSection>
      </div>
    </section>
  );
}

function filterHomeItems(items: MediaItem[]) {
  return items.filter((item) => !hiddenHomeTypes.has(classifyItem(item).type));
}

function ActionSection({
  title,
  count,
  icon,
  action,
  onAction,
  visualItem,
  visualLabel,
  tone,
  children,
  featured = false
}: {
  title: string;
  count: number;
  icon: ReactNode;
  action: string;
  onAction: () => void;
  visualItem?: MediaItem;
  visualLabel?: string;
  tone: "blue" | "green" | "amber";
  children: ReactNode;
  featured?: boolean;
}) {
  return (
    <section className={`home-action-section tone-${tone}${featured ? " featured" : ""}`}>
      <header>
        <div className="home-action-title">
          <span className="home-action-icon">{icon}</span>
          <div>
            <h2>{title}</h2>
            <span>{count} 筆</span>
          </div>
        </div>
        <button onClick={onAction}>{action}<ArrowRight size={14} /></button>
      </header>
      <button className="home-action-visual" style={visualStyle(visualItem)} onClick={onAction} type="button">
        <span className="home-visual-count">{count}</span>
        <span className="home-visual-label">{visualItem ? titleFor(visualItem) : visualLabel || title}</span>
      </button>
      {children}
    </section>
  );
}

function ItemRows({ items, empty, onSelect }: { items: MediaItem[]; empty: string; onSelect?: (item: MediaItem) => void }) {
  if (items.length === 0) return <p className="home-empty">{empty}</p>;
  return (
    <div className="home-item-rows">
      {items.slice(0, 5).map((item) => (
        <button key={item.id} onClick={() => onSelect?.(item)}>
          <span>
            <strong>{item.official_title || item.raw_title}</strong>
            <em>{progressLabel(item) || watchStatusLabel(getWatchStatus(item))}</em>
          </span>
          <b>{displayDate(item)}</b>
        </button>
      ))}
    </div>
  );
}

function displayDate(item: MediaItem) {
  return (item.watched_at || item.planned_at || item.updated_at || item.created_at).slice(0, 10);
}

function titleFor(item: MediaItem) {
  return item.official_title || item.raw_title;
}

function visualStyle(item?: MediaItem): CSSProperties {
  if (!item?.cover_url) return {};
  const safeUrl = item.cover_url.replace(/"/g, "%22");
  return { backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.66), rgba(0,0,0,.18)), url("${safeUrl}")` };
}
