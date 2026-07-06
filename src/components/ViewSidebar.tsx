import { BarChart3, Clapperboard, ChevronLeft, ChevronRight, Database, Film, Folder, Hash, Heart, Home, Layers, Settings, Sparkles, Tags, Tv, X } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { isPrivateLibraryLabel, PRIVATE_LIBRARY_LABEL } from "../lib/privacy";
import { collectionLevelOptions } from "../lib/reflection";
import { libraryTree } from "../lib/taxonomy";
import type { ListFilters, MediaItem, PrivateSummary } from "../types";
import { HomeDashboard } from "./HomeDashboard";

type DisplayView = "table" | "list" | "poster" | "calendar";
type ToolTab = "organizer" | "stats" | "data" | "settings";

const mainItems = [
  { id: "home", label: "首頁", icon: Home },
  { id: "database", label: "資料庫", icon: Folder },
  { id: "favorites", label: "收藏", icon: Heart }
] as const;

const toolItems = [
  { id: "organizer", label: "整理中心", icon: Sparkles },
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
  privateMode = false,
  privateSummary,
  safeMode,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
  onView,
  onLibrary,
  onTag,
  onTool,
  onPrivateFilter
}: {
  activeView: string;
  displayView: DisplayView;
  activeTool: ToolTab | null;
  summaryItems: MediaItem[];
  inboxTotal: number;
  tags: string[];
  filters: ListFilters;
  privateMode?: boolean;
  privateSummary?: PrivateSummary | null;
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
  onPrivateFilter?: (patch: Partial<ListFilters>) => void;
}) {
  const [showAllTags, setShowAllTags] = useState(false);
  const showText = !collapsed || mobileOpen;
  const visibleTags = showAllTags ? tags : tags.slice(0, 3);
  const libraryItems = libraryTree.filter((entry) => {
    if (activeView === "home" && entry.label === "沙雕动画") return false;
    return !safeMode || !isPrivateLibraryLabel(entry.label);
  });

  if (privateMode) {
    const collectionLevels = Array.from(new Set([
      ...collectionLevelOptions,
      ...(privateSummary?.collectionCounts.map((entry) => entry.level) || [])
    ]));
    const countForLevel = (level: string) => privateSummary?.collectionCounts.find((entry) => entry.level === level)?.count;
    return (
      <>
        <div className={mobileOpen ? "sidebar-scrim open" : "sidebar-scrim"} onClick={onCloseMobile} />
        <aside className={`${collapsed ? "database-sidebar collapsed private-sidebar" : "database-sidebar private-sidebar"} ${mobileOpen ? "mobile-open" : ""}`} aria-label="私密資料導覽">
          <div className="sidebar-top">
            {showText && (
              <div className="sidebar-brand">
                <p>Personal Media Log</p>
                <strong>私密工作台</strong>
                <span>{privateSummary?.total || 0} 筆資料</span>
              </div>
            )}
            <button className="row-icon desktop-collapse" onClick={onToggleCollapsed} title={collapsed ? "展開側欄" : "收合側欄"}>
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            <button className="row-icon mobile-close" onClick={onCloseMobile} title="關閉側欄"><X size={16} /></button>
          </div>

          <NavSection title="私密" showText={showText} tone="primary">
            <button className={!hasPrivateSidebarFilter(filters) ? "active" : ""} onClick={() => onPrivateFilter?.({})} title="全部私密">
              <Database size={16} />
              {showText && <span>全部</span>}
            </button>
            <button className={filters.usedFilter === "used" ? "active" : ""} onClick={() => onPrivateFilter?.({ usedFilter: "used" })} title="已使用">
              <Heart size={16} />
              {showText && <span>已使用</span>}
            </button>
            <button className={filters.usedFilter === "unused" ? "active" : ""} onClick={() => onPrivateFilter?.({ usedFilter: "unused" })} title="未使用">
              <Folder size={16} />
              {showText && <span>未使用</span>}
            </button>
          </NavSection>

          <NavSection title="收藏" showText={showText} tone="secondary">
            {collectionLevels.map((level) => (
              <button key={level} className={filters.collectionLevel === level ? "active" : ""} onClick={() => onPrivateFilter?.({ collectionLevel: level })} title={level}>
                <Heart size={15} />
                {showText && <span>{level}{countForLevel(level) !== undefined ? ` ${countForLevel(level)}` : ""}</span>}
              </button>
            ))}
          </NavSection>

          <NavSection title="標籤" showText={showText} tone="tags">
            {tags.length === 0 ? (
              showText && <em>尚無標籤</em>
            ) : (
              <>
                {visibleTags.map((tag) => (
                  <button key={tag} className={filters.tag === tag ? "active" : ""} onClick={() => onPrivateFilter?.({ tag })} title={tag}>
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
        </aside>
      </>
    );
  }

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

function hasPrivateSidebarFilter(filters: ListFilters) {
  return Boolean(filters.usedFilter !== "all" || filters.collectionLevel || filters.tag);
}

function iconFor(label: string) {
  if (label === "電影") return <Film size={15} />;
  if (label === "影集") return <Tv size={15} />;
  if (label === "動畫") return <Clapperboard size={15} />;
  if (label === "沙雕动画") return <Clapperboard size={15} />;
  if (label === "YouTube") return <Layers size={15} />;
  return <Folder size={15} />;
}
