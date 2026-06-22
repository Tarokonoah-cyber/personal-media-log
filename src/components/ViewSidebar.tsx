import { Inbox, List, Star, Tags, TrendingUp } from "lucide-react";
import type { ListFilters } from "../types";

const views = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "all", label: "全部", icon: List },
  { id: "favorite", label: "收藏", icon: Star },
  { id: "highRated", label: "高分", icon: TrendingUp }
] as const;

const types = ["電影", "韓劇", "動畫", "成人", "YouTube", "其他"];

export function ViewSidebar({
  activeView,
  tags,
  filters,
  onView,
  onType,
  onTag
}: {
  activeView: string;
  tags: string[];
  filters: ListFilters;
  onView: (view: string) => void;
  onType: (type: string) => void;
  onTag: (tag: string) => void;
}) {
  return (
    <aside className="database-sidebar" aria-label="資料庫分類">
      <div className="sidebar-group">
        {views.map((view) => {
          const Icon = view.icon;
          return (
            <button key={view.id} className={activeView === view.id ? "active" : ""} onClick={() => onView(view.id)}>
              <Icon size={15} />
              {view.label}
            </button>
          );
        })}
      </div>
      <div className="sidebar-group">
        <p>類型</p>
        {types.map((type) => (
          <button key={type} className={filters.type === type ? "active" : ""} onClick={() => onType(type)}>
            <span className="dot" />
            {type}
          </button>
        ))}
      </div>
      <div className="sidebar-group">
        <p><Tags size={13} />標籤</p>
        {tags.length === 0 ? <em>尚無標籤</em> : tags.slice(0, 14).map((tag) => (
          <button key={tag} className={filters.tag === tag ? "active" : ""} onClick={() => onTag(tag)}>
            <span>#</span>
            {tag}
          </button>
        ))}
      </div>
    </aside>
  );
}
