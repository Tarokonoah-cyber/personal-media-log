import { ChevronDown, ChevronLeft, ChevronRight, Clapperboard, Film, Folder, Hash, Inbox, Layers, List, Pause, Play, RotateCcw, Star, Tags, TrendingUp, Tv, X, CheckCircle2, Grid2X2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { libraryTree } from "../lib/taxonomy";
import type { ListFilters } from "../types";

const displayViews = [
  { id: "table", label: "Table", icon: List },
  { id: "list", label: "List", icon: List },
  { id: "poster", label: "Poster Wall", icon: Grid2X2 }
] as const;

const statusViews = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "plan_to_watch", label: "Plan to Watch", icon: Inbox },
  { id: "watching", label: "Watching", icon: Play },
  { id: "completed", label: "Completed", icon: CheckCircle2 },
  { id: "paused", label: "Paused", icon: Pause },
  { id: "dropped", label: "Dropped", icon: X },
  { id: "rewatching", label: "Rewatching", icon: RotateCcw },
  { id: "favorites", label: "Favorites", icon: Star },
  { id: "highRated", label: "High Rated", icon: TrendingUp }
] as const;

export function ViewSidebar({
  activeView,
  displayView,
  tags,
  filters,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
  onView,
  onDisplayView,
  onLibrary,
  onTag
}: {
  activeView: string;
  displayView: "table" | "list" | "poster";
  tags: string[];
  filters: ListFilters;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  onView: (view: string) => void;
  onDisplayView: (view: "table" | "list" | "poster") => void;
  onLibrary: (type: string, category?: string) => void;
  onTag: (tag: string) => void;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem("libraryOpenGroups") || "{}") as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  const showText = !collapsed || mobileOpen;
  const activeParent = useMemo(() => activeView.split("/")[0], [activeView]);

  useEffect(() => {
    localStorage.setItem("libraryOpenGroups", JSON.stringify(openGroups));
  }, [openGroups]);

  function toggleGroup(label: string) {
    setOpenGroups((current) => ({ ...current, [label]: !(current[label] ?? activeParent === label) }));
  }

  function selectParent(label: string, hasChildren: boolean) {
    onLibrary(label);
    if (hasChildren) toggleGroup(label);
  }

  return (
    <>
      <div className={mobileOpen ? "sidebar-scrim open" : "sidebar-scrim"} onClick={onCloseMobile} />
      <aside className={`${collapsed ? "database-sidebar collapsed" : "database-sidebar"} ${mobileOpen ? "mobile-open" : ""}`} aria-label="Database views">
        <div className="sidebar-top">
          {showText && <strong>Views</strong>}
          <button className="row-icon desktop-collapse" onClick={onToggleCollapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button className="row-icon mobile-close" onClick={onCloseMobile} title="Close views"><X size={16} /></button>
        </div>

        <div className="sidebar-group">
          {displayViews.map((view) => {
            const Icon = view.icon;
            return (
              <button key={view.id} className={displayView === view.id ? "active" : ""} onClick={() => onDisplayView(view.id)} title={view.label}>
                <Icon size={15} />
                {showText && <span>{view.label}</span>}
              </button>
            );
          })}
        </div>

        <div className="sidebar-group">
          {showText && <p>Status</p>}
          {statusViews.map((view) => {
            const Icon = view.icon;
            return (
              <button key={view.id} className={activeView === view.id || (view.id === "favorites" && filters.favorite) ? "active" : ""} onClick={() => onView(view.id)} title={view.label}>
                <Icon size={15} />
                {showText && <span>{view.label}</span>}
              </button>
            );
          })}
        </div>

        <div className="sidebar-group">
          {showText && <p><Folder size={13} />Library</p>}
          {libraryTree.map((entry) => {
            const isOpen = openGroups[entry.label] ?? activeParent === entry.label;
            const hasChildren = entry.children.length > 0;
            return (
              <div className="tree-node" key={entry.id}>
                <button className={activeView === entry.label ? "active" : ""} onClick={() => selectParent(entry.label, hasChildren)} title={entry.label}>
                  {iconFor(entry.label)}
                  {showText && <span>{entry.label}</span>}
                  {showText && hasChildren && <ChevronDown className={isOpen ? "tree-chevron open" : "tree-chevron"} size={13} />}
                </button>
                {showText && hasChildren && isOpen && (
                  <div className="tree-children">
                    {entry.children.map((child) => (
                      <button key={child} className={activeView === `${entry.label}/${child}` ? "active" : ""} onClick={() => onLibrary(entry.label, child)}>
                        <span className="tree-branch" />
                        {child}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="sidebar-group">
          {showText && <p><Tags size={13} />Tags</p>}
          {tags.length === 0 ? (
            showText && <em>No tags</em>
          ) : tags.slice(0, 16).map((tag) => (
            <button key={tag} className={filters.tag === tag ? "active" : ""} onClick={() => onTag(tag)} title={tag}>
              {!showText ? <Hash size={14} /> : <span>#</span>}
              {showText && <span>{tag}</span>}
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}

function iconFor(label: string) {
  if (label === "Movie") return <Film size={15} />;
  if (label === "Series") return <Tv size={15} />;
  if (label === "Anime") return <Clapperboard size={15} />;
  if (label === "YouTube") return <Layers size={15} />;
  return <Folder size={15} />;
}
