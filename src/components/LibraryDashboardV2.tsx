import { Archive, CheckCircle2, Clock, Database, Heart, PlayCircle, Sparkles, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getDashboard } from "../lib/api";
import { privateItemDetails } from "../lib/privacy";
import type { LibraryDashboardSummary, ListFilters, MediaItem } from "../types";

const platformOrder = ["FC2", "JAV", "SWAG", "麻豆", "糖心", "自拍", "歐美", "其他"];

export function LibraryDashboardV2({
  onFilter,
  onSelect
}: {
  onFilter: (patch: Partial<ListFilters>) => void;
  onSelect: (item: MediaItem) => void;
}) {
  const [summary, setSummary] = useState<LibraryDashboardSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError("");
      try {
        const next = await getDashboard(true);
        if (!cancelled) setSummary(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Dashboard 載入失敗");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className="library-empty-state danger">{error}</div>;
  if (!summary) return <div className="library-empty-state">正在整理收藏庫...</div>;

  const stats = [
    { label: "全部", value: summary.totals.all, icon: Database, patch: {} },
    { label: "私密", value: summary.totals.private, icon: Heart, patch: { privateOnly: true, includePrivate: true } },
    { label: "神作", value: summary.totals.masterpiece, icon: Star, patch: { favoriteLevel: "神作" as const } },
    { label: "已使用", value: summary.totals.used, icon: CheckCircle2, patch: { usedFilter: "used" as const } },
    { label: "收藏", value: summary.totals.collected, icon: Sparkles, patch: { favoriteLevel: "收藏" as const } },
    { label: "待觀看", value: summary.totals.pending, icon: Clock, patch: { mediaStatus: "待觀看" as const } },
    { label: "已刪除", value: summary.totals.deleted, icon: Trash2, patch: { mediaStatus: "已刪除" as const } }
  ];

  return (
    <section className="library-dashboard-v2">
      <header className="library-hero">
        <div>
          <p>Personal Media Log</p>
          <h1>個人觀影收藏庫</h1>
          <span>自己的 Letterboxd / Steam Library，乾淨地收藏、搜尋、回看。</span>
        </div>
        <button className="primary" onClick={() => onFilter({})}>
          <PlayCircle size={16} />
          進入收藏庫
        </button>
      </header>

      <div className="library-stat-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button key={stat.label} className="library-stat-card" onClick={() => onFilter(stat.patch)}>
              <span><Icon size={18} /></span>
              <b>{stat.value}</b>
              <small>{stat.label}</small>
            </button>
          );
        })}
      </div>

      <section className="library-section">
        <header>
          <div>
            <p>平台分類</p>
            <h2>快速瀏覽</h2>
          </div>
        </header>
        <div className="platform-card-grid">
          {platformOrder.map((platform) => {
            const item = summary.platforms.find((entry) => entry.platform === platform);
            return (
              <button key={platform} className="platform-card" onClick={() => onFilter({ platform })}>
                <strong>{platform}</strong>
                <span>{item?.count || 0} 筆</span>
                <div>
                  <small>平均 {item?.averageRating === null || item?.averageRating === undefined ? "-" : item.averageRating.toFixed(1)}</small>
                  <small>神作 {item?.masterpiece || 0}</small>
                  <small>已使用 {item?.used || 0}</small>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="recent-grid">
        <RecentRail title="最近新增" items={summary.recentAdded} onSelect={onSelect} />
        <RecentRail title="最近觀看" items={summary.recentWatched} onSelect={onSelect} />
        <RecentRail title="最近評分" items={summary.recentRated} onSelect={onSelect} />
        <RecentRail title="最近標記已使用" items={summary.recentUsed} onSelect={onSelect} />
      </div>
    </section>
  );
}

function RecentRail({ title, items, onSelect }: { title: string; items: MediaItem[]; onSelect: (item: MediaItem) => void }) {
  return (
    <section className="recent-rail">
      <header>
        <h3>{title}</h3>
      </header>
      {items.length === 0 ? (
        <div className="library-empty-state compact">還沒有資料</div>
      ) : (
        <div className="recent-list">
          {items.map((item) => {
            const details = privateItemDetails(item);
            return (
              <button key={item.id} onClick={() => onSelect(item)}>
                <b>{details.code}</b>
                <span>{item.rating ? `★ ${Number(item.rating).toFixed(1)}` : "未評分"} · {item.favorite_level}</span>
                <small>{item.platform || "-"} / {item.maker || details.studio}</small>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
