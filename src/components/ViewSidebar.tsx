import { ChevronDown, ChevronLeft, ChevronRight, Clapperboard, Film, Folder, Hash, Inbox, Layers, List, Star, Tags, TrendingUp, Tv, X } from "lucide-react";
import { libraryTree } from "../lib/taxonomy";
import type { ListFilters } from "../types";

const views = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "all", label: "All", icon: List },
  { id: "favorite", label: "Favorites", icon: Star },
  { id: "highRated", label: "High Rated", icon: TrendingUp }
] as const;

export function ViewSidebar({
  activeView,
  tags,
  filters,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
  onView,
  onLibrary,
  onTag
}: {
  activeView: string;
  tags: string[];
  filters: ListFilters;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  onView: (view: string) => void;
  onLibrary: (type: string, category?: string) => void;
  onTag: (tag: string) => void;
}) {
  const showText = !collapsed || mobileOpen;
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
          {views.map((view) => {
            const Icon = view.icon;
            return (
              <button key={view.id} className={activeView === view.id ? "active" : ""} onClick={() => onView(view.id)} title={view.label}>
                <Icon size={15} />
                {showText && <span>{view.label}</span>}
              </button>
            );
          })}
        </div>

        <div className="sidebar-group">
          {showText && <p><Folder size={13} />Library</p>}
          {libraryTree.map((entry) => (
            <div className="tree-node" key={entry.id}>
              <button className={activeView === entry.label ? "active" : ""} onClick={() => onLibrary(entry.label)} title={entry.label}>
                {iconFor(entry.label)}
                {showText && <span>{entry.label}</span>}
                {showText && entry.children.length > 0 && <ChevronDown className="tree-chevron" size={13} />}
              </button>
              {showText && entry.children.length > 0 && (
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
          ))}
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
