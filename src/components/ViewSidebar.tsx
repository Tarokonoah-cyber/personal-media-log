import { BarChart3, ChevronLeft, ChevronRight, Database, Hash, Heart, Home, Settings, Star, Tags, Trash2, UserRound, X, Zap } from "lucide-react";
import type { ReactNode } from "react";
import type { ListFilters, MediaItem, PrivateSummary } from "../types";
import { HomeDashboard } from "./HomeDashboard";

type DisplayView = "cards" | "list" | "table" | "poster" | "calendar";
type ToolTab = "organizer" | "stats" | "data" | "settings";

export function ViewSidebar({
  activeView,
  activeTool,
  summaryItems,
  inboxTotal,
  filters,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
  onView,
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
  const showText = !collapsed || mobileOpen;
  const goList = (patch: Partial<ListFilters> = {}) => {
    onPrivateFilter?.(patch);
    onCloseMobile();
  };

  return (
    <>
      <div className={mobileOpen ? "sidebar-scrim open" : "sidebar-scrim"} onClick={onCloseMobile} />
      <aside className={`${collapsed ? "database-sidebar collapsed library-sidebar-v2" : "database-sidebar library-sidebar-v2"} ${mobileOpen ? "mobile-open" : ""}`} aria-label="收藏庫導覽">
        <div className="sidebar-top">
          {showText && (
            <div className="sidebar-brand">
              <p>Personal Media Log</p>
              <strong>觀影收藏庫</strong>
              <HomeDashboard items={summaryItems} inboxTotal={inboxTotal} />
            </div>
          )}
          <button className="row-icon desktop-collapse" onClick={onToggleCollapsed} title={collapsed ? "展開" : "收合"}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button className="row-icon mobile-close" onClick={onCloseMobile} title="關閉"><X size={16} /></button>
        </div>

        <NavSection title="收藏庫" showText={showText}>
          <NavButton active={activeView === "home"} icon={<Home size={16} />} showText={showText} onClick={() => onView("home")}>首頁</NavButton>
          <NavButton active={activeView === "database" && !hasAnyFilter(filters)} icon={<Database size={16} />} showText={showText} onClick={() => goList({})}>全部</NavButton>
          <NavButton active={Boolean(filters.privateOnly)} icon={<Heart size={16} />} showText={showText} onClick={() => goList({ privateOnly: true, includePrivate: true })}>私密</NavButton>
          <NavButton active={filters.favoriteLevel === "神作"} icon={<Star size={16} />} showText={showText} onClick={() => goList({ favoriteLevel: "神作" })}>神作</NavButton>
          <NavButton active={filters.usedFilter === "used"} icon={<Zap size={16} />} showText={showText} onClick={() => goList({ usedFilter: "used" })}>已使用</NavButton>
          <NavButton active={filters.favoriteLevel === "收藏"} icon={<Heart size={16} />} showText={showText} onClick={() => goList({ favoriteLevel: "收藏" })}>收藏</NavButton>
          <NavButton active={filters.mediaStatus === "待觀看"} icon={<Tags size={16} />} showText={showText} onClick={() => goList({ mediaStatus: "待觀看" })}>待觀看</NavButton>
          <NavButton active={filters.mediaStatus === "已刪除"} icon={<Trash2 size={16} />} showText={showText} onClick={() => goList({ mediaStatus: "已刪除" })}>已刪除</NavButton>
        </NavSection>

        <NavSection title="瀏覽" showText={showText}>
          <NavButton active={Boolean(filters.platform)} icon={<Database size={16} />} showText={showText} onClick={() => goList({})}>平台</NavButton>
          <NavButton active={Boolean(filters.person)} icon={<UserRound size={16} />} showText={showText} onClick={() => goList({})}>女優 / 創作者</NavButton>
          <NavButton active={Boolean(filters.tag)} icon={<Hash size={16} />} showText={showText} onClick={() => goList({})}>標籤</NavButton>
        </NavSection>

        <NavSection title="其他" showText={showText}>
          <NavButton active={activeTool === "stats"} icon={<BarChart3 size={16} />} showText={showText} onClick={() => onTool("stats")}>統計</NavButton>
          <NavButton active={activeTool === "settings"} icon={<Settings size={16} />} showText={showText} onClick={() => onTool("settings")}>設定</NavButton>
        </NavSection>
      </aside>
    </>
  );
}

function NavSection({ title, showText, children }: { title: string; showText: boolean; children: ReactNode }) {
  return (
    <div className="sidebar-group sidebar-primary">
      {showText && <p>{title}</p>}
      {children}
    </div>
  );
}

function NavButton({ active, icon, showText, children, onClick }: { active: boolean; icon: ReactNode; showText: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      {icon}
      {showText && <span>{children}</span>}
    </button>
  );
}

function hasAnyFilter(filters: ListFilters) {
  return Boolean(
    filters.query ||
    filters.favoriteLevel !== "all" ||
    filters.mediaStatus !== "all" ||
    filters.usedFilter !== "all" ||
    filters.platform ||
    filters.maker ||
    filters.person ||
    filters.tag
  );
}
