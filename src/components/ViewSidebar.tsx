import { BarChart3, ChevronLeft, ChevronRight, Clapperboard, Database, Film, Folder, Hash, Heart, Layers, Settings, Sparkles, Tags, Tv, X } from "lucide-react";
import type { ReactNode } from "react";
import { isPrivateLibraryLabel } from "../lib/privacy";
import { libraryTree } from "../lib/taxonomy";
import type { ListFilters, MediaItem, PrivateSummary } from "../types";
import { HomeDashboard } from "./HomeDashboard";

type DisplayView = "table" | "list" | "poster" | "calendar";
type ToolTab = "organizer" | "stats" | "data" | "settings";

const mainItems = [
  { id: "home", label: "首頁", icon: HomeIcon },
  { id: "database", label: "資料庫", icon: Database },
  { id: "favorites", label: "收藏", icon: Heart }
] as const;

const toolItems = [
  { id: "organizer", label: "整理", icon: Sparkles },
  { id: "stats", label: "統計", icon: BarChart3 },
  { id: "data", label: "匯入匯出", icon: Database },
  { id: "settings", label: "設定", icon: Settings }
] as const;

const privateStatuses = ["待觀看", "已觀看", "想重看", "已刪除"] as const;
const favoriteLevels = ["神作", "收藏", "一般", "雷片", "已刪"] as const;
const usageFilters = [
  { label: "已使用", usedFilter: "used" },
  { label: "未使用", usedFilter: "unused" }
] as const;
const platformItems = ["FC2", "JAV", "SWAG", "麻豆", "糖心", "自拍", "歐美", "其他"] as const;
const makerItems = ["S1", "SOD", "Prestige", "Moodyz", "FALENO", "其他片商"] as const;
const tagItems = ["高顏值", "素人感", "劇情好", "畫質差", "有碼", "無碼", "雷"] as const;

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
  const showText = !collapsed || mobileOpen;
  const libraryItems = libraryTree.filter((entry) => !safeMode || !isPrivateLibraryLabel(entry.label));

  if (privateMode) {
    const countForLevel = (level: string) => privateSummary?.collectionCounts.find((entry) => entry.level === level)?.count;
    return (
      <>
        <SidebarScrim open={mobileOpen} onClose={onCloseMobile} />
        <aside className={`${collapsed ? "database-sidebar collapsed private-sidebar" : "database-sidebar private-sidebar"} ${mobileOpen ? "mobile-open" : ""}`} aria-label="私密工作台分類">
          <SidebarTop
            showText={showText}
            collapsed={collapsed}
            title="私密工作台"
            subtitle={`${privateSummary?.total || 0} 筆`}
            onToggleCollapsed={onToggleCollapsed}
            onCloseMobile={onCloseMobile}
          />

          <NavSection title="全部" showText={showText} tone="primary">
            <SidebarButton active={!hasPrivateSidebarFilter(filters)} title="全部" icon={<Database size={16} />} showText={showText} onClick={() => onPrivateFilter?.({})}>
              全部
            </SidebarButton>
            {privateStatuses.map((status) => (
              <SidebarButton key={status} active={filters.mediaStatus === status} title={status} icon={<Folder size={15} />} showText={showText} onClick={() => onPrivateFilter?.({ mediaStatus: status })}>
                {status}
              </SidebarButton>
            ))}
          </NavSection>

          <NavSection title="收藏分類" showText={showText} tone="secondary">
            {favoriteLevels.map((level) => (
              <SidebarButton key={level} active={filters.favoriteLevel === level} title={level} icon={<Heart size={15} />} showText={showText} onClick={() => onPrivateFilter?.({ favoriteLevel: level })}>
                {level}{countForLevel(level) !== undefined ? ` ${countForLevel(level)}` : ""}
              </SidebarButton>
            ))}
          </NavSection>

          <NavSection title="使用分類" showText={showText} tone="secondary">
            {usageFilters.map((entry) => (
              <SidebarButton key={entry.usedFilter} active={filters.usedFilter === entry.usedFilter} title={entry.label} icon={<Heart size={15} />} showText={showText} onClick={() => onPrivateFilter?.({ usedFilter: entry.usedFilter })}>
                {entry.label}
              </SidebarButton>
            ))}
          </NavSection>

          <NavSection title="平台分類" showText={showText} tone="secondary">
            {platformItems.map((platform) => (
              <SidebarButton key={platform} active={filters.platform === platform} title={platform} icon={<Clapperboard size={15} />} showText={showText} onClick={() => onPrivateFilter?.({ platform })}>
                {platform}
              </SidebarButton>
            ))}
          </NavSection>

          <NavSection title="片商分類" showText={showText} tone="secondary">
            {makerItems.map((maker) => (
              <SidebarButton key={maker} active={filters.maker === maker} title={maker} icon={<Layers size={15} />} showText={showText} onClick={() => onPrivateFilter?.({ maker })}>
                {maker}
              </SidebarButton>
            ))}
          </NavSection>

          <NavSection title="標籤分類" showText={showText} tone="tags">
            {tagItems.map((tag) => (
              <SidebarButton key={tag} active={filters.tag === tag} title={tag} icon={!showText ? <Hash size={14} /> : <span className="tag-prefix">#</span>} showText={showText} onClick={() => onPrivateFilter?.({ tag })}>
                {tag}
              </SidebarButton>
            ))}
          </NavSection>
        </aside>
      </>
    );
  }

  const visibleTags = tags.slice(0, 12);
  return (
    <>
      <SidebarScrim open={mobileOpen} onClose={onCloseMobile} />
      <aside className={`${collapsed ? "database-sidebar collapsed" : "database-sidebar"} ${mobileOpen ? "mobile-open" : ""}`} aria-label="瀏覽選單">
        <SidebarTop
          showText={showText}
          collapsed={collapsed}
          title="觀影資料庫"
          subtitle=""
          onToggleCollapsed={onToggleCollapsed}
          onCloseMobile={onCloseMobile}
          extra={showText ? <HomeDashboard items={summaryItems} inboxTotal={inboxTotal} /> : null}
        />

        <NavSection title="主要" showText={showText} tone="primary">
          {mainItems.map((item) => {
            const Icon = item.icon;
            return (
              <SidebarButton key={item.id} active={isMainActive(item.id, activeView, filters)} title={item.label} icon={<Icon size={16} />} showText={showText} onClick={() => onView(item.id)}>
                {item.label}
              </SidebarButton>
            );
          })}
        </NavSection>

        <NavSection title="媒體分類" showText={showText} tone="secondary">
          {libraryItems.map((entry) => (
            <SidebarButton key={entry.id} active={activeView === entry.label} title={entry.label} icon={iconFor(entry.label)} showText={showText} onClick={() => onLibrary(entry.label)}>
              {entry.label}
            </SidebarButton>
          ))}
        </NavSection>

        <NavSection title="標籤" showText={showText} tone="tags">
          {visibleTags.length === 0 ? (
            showText && <em>沒有標籤</em>
          ) : (
            visibleTags.map((tag) => (
              <SidebarButton key={tag} active={filters.tag === tag} title={tag} icon={!showText ? <Hash size={14} /> : <span className="tag-prefix">#</span>} showText={showText} onClick={() => onTag(tag)}>
                {tag}
              </SidebarButton>
            ))
          )}
        </NavSection>

        <NavSection title="工具" showText={showText} tone="tools">
          {toolItems.map((item) => {
            const Icon = item.icon;
            return (
              <SidebarButton key={item.id} active={activeTool === item.id} title={item.label} icon={<Icon size={15} />} showText={showText} onClick={() => onTool(item.id)}>
                {item.label}
              </SidebarButton>
            );
          })}
        </NavSection>
      </aside>
    </>
  );
}

function SidebarScrim({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <div className={open ? "sidebar-scrim open" : "sidebar-scrim"} onClick={onClose} />;
}

function SidebarTop({
  showText,
  collapsed,
  title,
  subtitle,
  extra,
  onToggleCollapsed,
  onCloseMobile
}: {
  showText: boolean;
  collapsed: boolean;
  title: string;
  subtitle: string;
  extra?: ReactNode;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}) {
  return (
    <div className="sidebar-top">
      {showText && (
        <div className="sidebar-brand">
          <p>Personal Media Log</p>
          <strong>{title}</strong>
          {subtitle && <span>{subtitle}</span>}
          {extra}
        </div>
      )}
      <button className="row-icon desktop-collapse" onClick={onToggleCollapsed} title={collapsed ? "展開選單" : "收合選單"}>
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
      <button className="row-icon mobile-close" onClick={onCloseMobile} title="關閉選單"><X size={16} /></button>
    </div>
  );
}

function SidebarButton({ active, title, icon, showText, children, onClick }: { active: boolean; title: string; icon: ReactNode; showText: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button className={active ? "active" : ""} onClick={onClick} title={title}>
      {icon}
      {showText && <span>{children}</span>}
    </button>
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
  return Boolean(
    filters.mediaStatus !== "all" ||
    filters.favoriteLevel !== "all" ||
    filters.usedFilter !== "all" ||
    filters.platform ||
    filters.maker ||
    filters.tag
  );
}

function iconFor(label: string) {
  if (label.includes("電影")) return <Film size={15} />;
  if (label.includes("劇") || label.toLowerCase().includes("tv")) return <Tv size={15} />;
  if (label.includes("動畫")) return <Clapperboard size={15} />;
  return <Folder size={15} />;
}

function HomeIcon({ size }: { size: number }) {
  return <Folder size={size} />;
}
