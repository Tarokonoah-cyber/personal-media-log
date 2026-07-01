import { BarChart3, Clapperboard, ChevronLeft, ChevronRight, Database, Film, Folder, Hash, Heart, Home, Layers, Settings, Tags, Tv, X } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { isPrivateLibraryLabel } from "../lib/privacy";
import { libraryTree } from "../lib/taxonomy";
import type { ListFilters, MediaItem } from "../types";
import { HomeDashboard } from "./HomeDashboard";

type DisplayView = "table" | "list" | "poster" | "calendar";
type ToolTab = "stats" | "data" | "settings";

const mainItems = [
  { id: "home", label: "首頁", icon: Home },
  { id: "database", label: "資料庫", icon: Folder },
  { id: "favorites", label: "收藏", icon: Heart }
] as const;

const toolItems = [
  { id: "stats", label: "統計", icon: BarChart3 },
  { id: "data", label: "資料備份", icon: Database },
  { id: "settings", label: "設定", icon: Settings }
] as const;

export function ViewSidebar({
  activeView,
  activeTool,
  summaryItems,
  inboxTotal,
  tags,
  filters,
  safeMode,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
  onView,
  onLibrary,
  onTag,
  onTool
}: {
  activeView: string;
  displayView: DisplayView;
  activeTool: ToolTab | null;
  summaryItems: MediaItem[];
  inboxTotal: number;
  tags: string[];
  filters: ListFilters;
  safeMode: boolean;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  onView: (view: string) => void;
  onDisplayView: (view: DisplayView) => void;
  onLibrary: (type: string, category?: string) => void;
  onTag: (tag: string) => void;
  onTool: (tab: ToolTab) => void;
}) {
  const [showAllTags, setShowAllTags] = useState(false);
  const showText = !collapsed || mobileOpen;
  const visibleTags = showAllTags ? tags : tags.slice(0, 3);
  const libraryItems = libraryTree.filter((entry) => {
    if (activeView === "home" && entry.label === "沙雕动画") return false;
    return !safeMode || !isPrivateLibraryLabel(entry.label);
  });

  return (
    <>
      <div className={mobileOpen ? "sidebar-scrim open" : "sidebar-scrim"} onClick={onCloseMobile} />
      <aside className={`${collapsed ? "database-sidebar collapsed" : "database-sidebar"} ${mobileOpen ? "mobile-open" : ""}`} aria-label="觀看資料庫導覽">
        <div className="sidebar-top">
          {showText && (
            <div className="sidebar-brand">
              <p>Personal Media Log</p>
              <strong>觀看資料庫</strong>
              <HomeDashboard items={summaryItems} inboxTotal={inboxTotal} />
            </div>
          )}
          <button className="row-icon desktop-collapse" onClick={onToggleCollapsed} title={collapsed ? "展開側欄" : "收合側欄"}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button className="row-icon mobile-close" onClick={onCloseMobile} title="關閉側欄"><X size={16} /></button>
        </div>

        <NavSection title="主要" showText={showText} tone="primary">
          {mainItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={isMainActive(item.id, activeView, filters) ? "active" : ""} onClick={() => onView(item.id)} title={item.label}>
                <Icon size={16} />
                {showText && <span>{item.label}</span>}
              </button>
            );
          })}
        </NavSection>

        <NavSection title="媒體類型" showText={showText} tone="secondary">
          {libraryItems.map((entry) => (
            <button key={entry.id} className={activeView === entry.label ? "active" : ""} onClick={() => onLibrary(entry.label)} title={entry.label}>
              {iconFor(entry.label)}
              {showText && <span>{entry.label}</span>}
            </button>
          ))}
        </NavSection>

        <NavSection title="標籤" showText={showText} tone="tags">
          {tags.length === 0 ? (
            showText && <em>尚無標籤</em>
          ) : (
            <>
              {visibleTags.map((tag) => (
                <button key={tag} className={filters.tag === tag ? "active" : ""} onClick={() => onTag(tag)} title={tag}>
                  {!showText ? <Hash size={14} /> : <span className="tag-prefix">#</span>}
                  {showText && <span>{tag}</span>}
                </button>
              ))}
              {showText && tags.length > 3 && (
                <button className="sidebar-more" onClick={() => setShowAllTags((value) => !value)}>
                  <Tags size={13} />
                  {showAllTags ? "收合標籤" : "更多標籤..."}
                </button>
              )}
            </>
          )}
        </NavSection>

        <NavSection title="工具" showText={showText} tone="tools">
          {toolItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={activeTool === item.id ? "active" : ""} onClick={() => onTool(item.id)} title={item.label}>
                <Icon size={15} />
                {showText && <span>{item.label}</span>}
              </button>
            );
          })}
        </NavSection>
      </aside>
    </>
  );
}

function NavSection({ title, showText, tone, children }: { title: string; showText: boolean; tone: "primary" | "secondary" | "tags" | "tools"; children: ReactNode }) {
  return (
    <div className={`sidebar-group sidebar-${tone}`}>
      {showText && <p>{title}</p>}
      {children}
    </div>
  );
}

function isMainActive(id: string, activeView: string, filters: ListFilters) {
  if (id === "home") return activeView === "home" && !filters.favorite;
  if (id === "database") return activeView === "database" && !filters.favorite;
  if (id === "favorites") return activeView === "favorites" || filters.favorite;
  return activeView === id;
}

function iconFor(label: string) {
  if (label === "電影") return <Film size={15} />;
  if (label === "影集") return <Tv size={15} />;
  if (label === "動畫") return <Clapperboard size={15} />;
  if (label === "沙雕动画") return <Clapperboard size={15} />;
  if (label === "YouTube") return <Layers size={15} />;
  return <Folder size={15} />;
}
