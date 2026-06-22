import { Clock3, Flame, Inbox, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { MediaItem } from "../types";
import { isThisWeek, isToday } from "../lib/date";
import { ItemList } from "./ItemList";

export function HomeDashboard({
  recent,
  inbox,
  favorites,
  loading,
  onSelect,
  onToggleFavorite,
  onDelete
}: {
  recent: MediaItem[];
  inbox: MediaItem[];
  favorites: MediaItem[];
  loading: boolean;
  onSelect: (item: MediaItem) => void;
  onToggleFavorite: (item: MediaItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const todayCount = recent.filter((item) => isToday(item.created_at)).length;
  const weekCount = recent.filter((item) => isThisWeek(item.created_at)).length;

  return (
    <div className="home-dashboard">
      <section className="summary-strip" aria-label="紀錄摘要">
        <Summary icon={<Clock3 size={18} />} label="今日" value={todayCount} />
        <Summary icon={<Flame size={18} />} label="本週" value={weekCount} />
        <Summary icon={<Inbox size={18} />} label="待整理" value={inbox.length} />
        <Summary icon={<Sparkles size={18} />} label="高分收藏" value={favorites.length} />
      </section>

      <HomeSection title="最近新增" subtitle="剛記下來的東西都在這裡。" items={recent.slice(0, 6)} loading={loading} onSelect={onSelect} onToggleFavorite={onToggleFavorite} onDelete={onDelete} />
      <HomeSection title="待整理" subtitle="有空再補正式標題、平台、分類。" items={inbox.slice(0, 6)} loading={loading} empty="目前沒有待整理，乾淨得很舒服。" onSelect={onSelect} onToggleFavorite={onToggleFavorite} onDelete={onDelete} />
      <HomeSection title="高分收藏" subtitle="值得回味的片單。" items={favorites.slice(0, 6)} loading={loading} empty="還沒有高分收藏，遇到喜歡的就按收藏。" onSelect={onSelect} onToggleFavorite={onToggleFavorite} onDelete={onDelete} />
    </div>
  );
}

function Summary({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="summary-card">
      <span>{icon}</span>
      <b>{value}</b>
      <em>{label}</em>
    </div>
  );
}

function HomeSection({
  title,
  subtitle,
  items,
  loading,
  empty = "還沒有紀錄，先快速記一筆就好，不用完整。",
  onSelect,
  onToggleFavorite,
  onDelete
}: {
  title: string;
  subtitle: string;
  items: MediaItem[];
  loading: boolean;
  empty?: string;
  onSelect: (item: MediaItem) => void;
  onToggleFavorite: (item: MediaItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <section className="home-section">
      <header className="section-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </header>
      <ItemList items={items} loading={loading} mode="cards" emptyMessage={empty} onSelect={onSelect} onToggleFavorite={onToggleFavorite} onDelete={onDelete} />
    </section>
  );
}
