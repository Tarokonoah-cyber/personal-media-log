import { BarChart3, ChevronDown, ChevronLeft, ChevronRight, Clapperboard, Database, Film, Folder, Hash, Heart, Settings, Sparkles, Tv, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isPrivateLibraryLabel } from "../lib/privacy";
import { searchPrivateFacet } from "../lib/api";
import { clearPrivateSidebarFilters } from "../lib/privateFilters";
import { libraryTree } from "../lib/taxonomy";
import type { ListFilters, MediaItem, PrivateFacets, PrivateSummary } from "../types";
import { HomeDashboard } from "./HomeDashboard";

type DisplayView = "table" | "list" | "poster" | "calendar";
type ToolTab = "organizer" | "stats" | "data" | "settings" | "quality";

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

export function ViewSidebar({
  activeView,
  activeTool,
  summaryItems,
  inboxTotal,
  tags,
  filters,
  privateMode = false,
  privateSummary,
  privateFacets,
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
  privateFacets?: PrivateFacets | null;
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
  const [platformOpen, setPlatformOpen] = useState(true);
  const [favoriteOpen, setFavoriteOpen] = useState(true);
  const [actressOpen, setActressOpen] = useState(true);
  const [actressQuery, setActressQuery] = useState("");
  const [actressResults, setActressResults] = useState(privateFacets?.actress || []);
  const [actressLoading, setActressLoading] = useState(false);
  const [actressError, setActressError] = useState("");
  const actressRequestId = useRef(0);
  const closeMobileRef = useRef(onCloseMobile);
  closeMobileRef.current = onCloseMobile;
  const platformFilters = filterValues(filters.platformFilters);
  const favoriteFilters = filterValues(filters.favoriteLevelFilters);
  const personFilters = filterValues(filters.personFilters);
  const actressItems = useMemo(() => actressResults.length ? actressResults : privateFacets?.actress || [], [actressResults, privateFacets?.actress]);

  useEffect(() => {
    if (!privateMode) return;
    const requestId = ++actressRequestId.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setActressLoading(true);
      setActressError("");
      void searchPrivateFacet("actress", actressQuery, 30, controller.signal)
        .then((result) => {
          if (requestId === actressRequestId.current) setActressResults(result.items);
        })
        .catch((error) => {
          if (controller.signal.aborted || requestId !== actressRequestId.current) return;
          setActressError(error instanceof Error ? error.message : "女優搜尋失敗");
        })
        .finally(() => {
          if (requestId === actressRequestId.current) setActressLoading(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [actressQuery, privateMode]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      (document.querySelector('[aria-label="開啟導覽"]') as HTMLElement | null)?.focus();
    };
  }, [mobileOpen]);

  const applyPrivateFilter = (patch: Partial<ListFilters>) => {
    onPrivateFilter?.(patch);
    if (mobileOpen) onCloseMobile();
  };

  const patchMulti = (key: "platformFilters" | "makerFilters" | "favoriteLevelFilters" | "personFilters", value: string) => {
    const current = filterValues(filters[key]);
    const next = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
    applyPrivateFilter({ [key]: next.join(","), ...(key === "platformFilters" ? { platform: "" } : {}) });
  };

  const clearPrivateFilters = () => applyPrivateFilter(clearPrivateSidebarFilters(filters));

  if (privateMode) {
    return (
      <>
        <SidebarScrim open={mobileOpen} onClose={onCloseMobile} />
        <aside id="private-sidebar" className={`${collapsed ? "database-sidebar collapsed private-sidebar" : "database-sidebar private-sidebar"} ${mobileOpen ? "mobile-open" : ""}`} aria-label="私密工作台導覽" role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen || undefined}>
          <SidebarTop
            showText={showText}
            collapsed={collapsed}
            title="私密工作台"
            subtitle={`${privateSummary?.total || 0} 筆`}
            onToggleCollapsed={onToggleCollapsed}
            onCloseMobile={onCloseMobile}
          />

          <NavSection title="全部" showText={showText} tone="primary">
            <SidebarButton active={!hasPrivateSidebarFilter(filters)} title="全部" icon={<Database size={16} />} showText={showText} onClick={clearPrivateFilters}>
              全部
            </SidebarButton>
          </NavSection>

          <PrivateNavSection title="平台" open={platformOpen} showText={showText} onToggle={() => setPlatformOpen((value) => !value)}>
            {["FC2", "JAV"].map((platform) => (
              <PrivateFilterButton key={platform} label={platform} count={facetCount(privateFacets?.source, platform)} active={platformFilters.includes(platform)} showText={showText} icon={<Clapperboard size={15} />} onClick={() => patchMulti("platformFilters", platform)} />
            ))}
          </PrivateNavSection>

          <PrivateNavSection title="收藏" open={favoriteOpen} showText={showText} onToggle={() => setFavoriteOpen((value) => !value)}>
            {[
              { label: "未分類", value: "unset" },
              { label: "神作", value: "masterpiece" },
              { label: "一般", value: "normal" },
              { label: "淘汰", value: "discard" }
            ].map((entry) => (
              <PrivateFilterButton key={entry.value} label={entry.label} count={facetCount(privateFacets?.favoriteLevel, entry.value)} active={favoriteFilters.includes(entry.value)} showText={showText} icon={<Heart size={15} />} onClick={() => patchMulti("favoriteLevelFilters", entry.value)} />
            ))}
          </PrivateNavSection>

          <PrivateNavSection title="女優" open={actressOpen} showText={showText} onToggle={() => setActressOpen((value) => !value)}>
            {showText && <input className="private-nav-search" value={actressQuery} onChange={(event) => setActressQuery(event.target.value)} placeholder="搜尋女優" aria-label="搜尋女優" />}
            <div className="private-nav-actress-list">
              {actressLoading ? (showText && <em>搜尋中...</em>) : actressError ? (showText && <em role="alert">{actressError}</em>) : actressItems.length === 0 ? (
                showText && <em>沒有女優資料</em>
              ) : actressItems.map((actress) => (
                <PrivateFilterButton key={actress.value} label={actress.value} count={actress.count} active={personFilters.includes(actress.value)} showText={showText} onClick={() => patchMulti("personFilters", actress.value)} />
              ))}
            </div>
            <PrivateFilterButton label="未填女優" count={0} active={Boolean(filters.missingPeople)} showText={showText} onClick={() => applyPrivateFilter({ missingPeople: !filters.missingPeople })} />
          </PrivateNavSection>

          <NavSection title="工具" showText={showText} tone="tools">
            <SidebarButton active={activeTool === "quality"} title="資料整理" icon={<Sparkles size={15} />} showText={showText} onClick={() => onTool("quality")}>
              資料整理
            </SidebarButton>
            <SidebarButton active={activeTool === "stats"} title="統計" icon={<BarChart3 size={15} />} showText={showText} onClick={() => onTool("stats")}>
              統計
            </SidebarButton>
            <SidebarButton active={activeTool === "settings"} title="設定" icon={<Settings size={15} />} showText={showText} onClick={() => onTool("settings")}>
              設定
            </SidebarButton>
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
      <button className="row-icon desktop-collapse" onClick={onToggleCollapsed} title={collapsed ? "展開選單" : "收合選單"} aria-label={collapsed ? "展開選單" : "收合選單"} aria-expanded={!collapsed} aria-controls="private-sidebar">
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

function PrivateNavSection({ title, open, showText, children, onToggle }: { title: string; open: boolean; showText: boolean; children: ReactNode; onToggle: () => void }) {
  return (
    <div className="sidebar-group sidebar-private-facet">
      {showText && (
        <button className="private-nav-section-title" onClick={onToggle}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>{title}</span>
        </button>
      )}
      {(!showText || open) && <div className="private-nav-section-body">{children}</div>}
    </div>
  );
}

function PrivateFilterButton({
  label,
  count,
  active,
  showText,
  icon,
  onClick
}: {
  label: string;
  count: number;
  active: boolean;
  showText: boolean;
  icon?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active private-nav-filter" : "private-nav-filter"} onClick={onClick} title={`${label} ${count}`} aria-pressed={active}>
      {icon || <span className="private-nav-dot" />}
      {showText && (
        <>
          <span>{label}</span>
          <b>{count}</b>
        </>
      )}
    </button>
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
    filters.platformFilters?.trim() ||
    filters.makerFilters?.trim() ||
    filters.favoriteLevelFilters?.trim() ||
    filters.personFilters?.trim() ||
    filters.missingPeople ||
    filters.query?.trim() ||
    filters.ratingMin?.trim() ||
    filters.ratingMax?.trim() ||
    filters.unrated ||
    (filters.hasNote && filters.hasNote !== "all") ||
    (filters.hasCover && filters.hasCover !== "all") ||
    filters.platform ||
    filters.maker ||
    filters.person ||
    filters.tag
  );
}

function filterValues(value: string | undefined) {
  return (value || "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

function facetCount(items: Array<{ value: string; count: number }> | undefined, value: string) {
  return items?.find((item) => item.value === value)?.count || 0;
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
