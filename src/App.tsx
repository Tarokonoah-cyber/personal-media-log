import { BarChart3, DatabaseBackup, Menu, Moon, Search, SlidersHorizontal, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BottomTabBar } from "./components/BottomTabBar";
import { FilterSheet } from "./components/FilterSheet";
import { HomeDashboard } from "./components/HomeDashboard";
import { ImportExport } from "./components/ImportExport";
import { ItemEditor } from "./components/ItemEditor";
import { ItemList } from "./components/ItemList";
import { MetadataLookupModal } from "./components/MetadataLookupModal";
import { QuickCapture } from "./components/QuickCapture";
import { StatsPanel } from "./components/StatsPanel";
import { Toast } from "./components/Toast";
import { ViewSidebar } from "./components/ViewSidebar";
import { applyMetadata, createItem, deleteItem, listItems, searchMetadata, updateItem } from "./lib/api";
import { toItemInput } from "./lib/itemTransforms";
import { parseQuickEntry } from "./lib/quickParse";
import { classifyItem, libraryTree } from "./lib/taxonomy";
import { getWatchStatus, updateWatchProgress } from "./lib/watch";
import type { ItemInput, ListFilters, MediaItem, TmdbCandidate } from "./types";

const defaultFilters: ListFilters = {
  query: "",
  status: "all",
  favorite: false,
  highRated: false,
  type: "",
  tag: "",
  year: "",
  platform: "",
  watchedFrom: "",
  watchedTo: "",
  page: 1,
  pageSize: 100
};

type Tab = "log" | "organize" | "stats" | "data";
type DisplayView = "table" | "list" | "poster";

export default function App() {
  const [tab, setTab] = useState<Tab>("log");
  const [displayView, setDisplayView] = useState<DisplayView>(() => (localStorage.getItem("displayView") as DisplayView) || "table");
  const [quickText, setQuickText] = useState("");
  const [filters, setFilters] = useState<ListFilters>(defaultFilters);
  const [activeView, setActiveView] = useState("table");
  const [activeCategory, setActiveCategory] = useState("");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [summaryItems, setSummaryItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [inboxTotal, setInboxTotal] = useState(0);
  const [favoriteTotal, setFavoriteTotal] = useState(0);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [metadataTarget, setMetadataTarget] = useState<MediaItem | null>(null);
  const [metadataCandidates, setMetadataCandidates] = useState<TmdbCandidate[]>([]);
  const [metadataQuery, setMetadataQuery] = useState("");
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebarCollapsed") === "true");
  const [dark, setDark] = useState(() => localStorage.getItem("theme") !== "light");

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem("displayView", displayView);
  }, [displayView]);

  useEffect(() => {
    void loadItems();
  }, [filters]);

  useEffect(() => {
    void loadSummary();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / filters.pageSize)), [total, filters.pageSize]);
  const knownTags = useMemo(() => Array.from(new Set(summaryItems.flatMap((item) => item.tags))).sort((a, b) => a.localeCompare(b, "zh-Hant")), [summaryItems]);
  const libraryTypes = useMemo(() => new Set<string>(libraryTree.map((entry) => entry.label)), []);
  const visibleItems = useMemo(() => {
    if (activeCategory) return items.filter((item) => classifyItem(item).category === activeCategory);
    if (libraryTypes.has(activeView)) return items.filter((item) => classifyItem(item).type === activeView);
    if (["plan_to_watch", "watching", "completed", "paused", "dropped", "rewatching"].includes(activeView)) {
      return items.filter((item) => getWatchStatus(item) === activeView);
    }
    return items;
  }, [activeCategory, activeView, items, libraryTypes]);

  async function loadItems() {
    setLoading(true);
    setError("");
    try {
      const result = await listItems(filters);
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load records");
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    try {
      const [all, inbox, favorites] = await Promise.all([
        listItems({ ...defaultFilters, status: "all", pageSize: 100 }),
        listItems({ ...defaultFilters, status: "inbox", pageSize: 1 }),
        listItems({ ...defaultFilters, status: "all", favorite: true, pageSize: 1 })
      ]);
      setSummaryItems(all.items);
      setInboxTotal(inbox.total);
      setFavoriteTotal(favorites.total);
    } catch {
      setSummaryItems([]);
    }
  }

  async function refreshVisibleData() {
    await Promise.all([loadItems(), loadSummary()]);
  }

  async function submitQuick() {
    const parsed = parseQuickEntry(quickText);
    if (!parsed.raw_title.trim()) return;
    setLoading(true);
    try {
      await createItem({
        ...parsed,
        ...updateWatchProgress({ ...emptyItem(), raw_title: parsed.raw_title } as MediaItem, { watch_status: "plan_to_watch" })
      });
      setQuickText("");
      setToast("Added to Plan to Watch");
      setActiveView("plan_to_watch");
      setActiveCategory("");
      setFilters((current) => ({ ...current, status: "all", page: 1 }));
      await refreshVisibleData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add record");
    } finally {
      setLoading(false);
    }
  }

  async function saveItem(input: ItemInput) {
    if (!selected) return;
    const saved = await updateItem(selected.id, input);
    setSelected(saved);
    setToast("Saved");
    await refreshVisibleData();
  }

  async function removeItem(id: string) {
    if (!window.confirm("Delete this record?")) return;
    await deleteItem(id);
    setSelected(null);
    setToast("Deleted");
    await refreshVisibleData();
  }

  async function toggleFavorite(item: MediaItem) {
    await updateItem(item.id, { ...toItemInput(item), favorite: !item.favorite });
    setToast(item.favorite ? "Removed from favorites" : "Added to favorites");
    await refreshVisibleData();
  }

  async function quickUpdate(item: MediaItem, patch: Partial<ItemInput>) {
    await updateItem(item.id, { ...toItemInput(item), ...patch });
    setToast("Updated");
    await refreshVisibleData();
  }

  async function openMetadataLookup(item: MediaItem) {
    setMetadataTarget(item);
    setMetadataCandidates([]);
    setMetadataError("");
    await runMetadataSearch(item, item.official_title || item.raw_title);
  }

  async function runMetadataSearch(item: MediaItem, query?: string) {
    setMetadataLoading(true);
    setMetadataError("");
    try {
      const result = await searchMetadata(item.id, query);
      setMetadataQuery(result.query);
      setMetadataCandidates(result.candidates);
    } catch (err) {
      setMetadataError(err instanceof Error ? err.message : "TMDb search failed");
    } finally {
      setMetadataLoading(false);
    }
  }

  async function applyCandidate(candidate: TmdbCandidate) {
    if (!metadataTarget) return;
    setMetadataLoading(true);
    setMetadataError("");
    try {
      const updated = await applyMetadata(metadataTarget.id, candidate.tmdb_id, candidate.media_type);
      setMetadataTarget(null);
      setMetadataCandidates([]);
      setSelected(updated);
      setToast("TMDb metadata applied");
      await refreshVisibleData();
    } catch (err) {
      setMetadataError(err instanceof Error ? err.message : "Failed to apply TMDb metadata");
    } finally {
      setMetadataLoading(false);
    }
  }

  function patchFilters(patch: Partial<ListFilters>) {
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  }

  function selectView(view: string) {
    setActiveView(view);
    setActiveCategory("");
    const base = { ...defaultFilters, query: filters.query };
    if (view === "inbox") setFilters({ ...base, status: "inbox" });
    else if (view === "favorites") setFilters({ ...base, favorite: true });
    else if (view === "highRated") setFilters({ ...base, highRated: true });
    else setFilters(base);
  }

  function selectDisplayView(view: DisplayView) {
    setDisplayView(view);
    setActiveView(view);
  }

  function selectLibrary(type: string, category?: string) {
    setActiveView(category ? `${type}/${category}` : type);
    setActiveCategory(category || "");
    setFilters({ ...defaultFilters, status: "all", query: filters.query, pageSize: 100 });
  }

  function selectTag(tag: string) {
    setActiveView(`#${tag}`);
    setActiveCategory("");
    setFilters({ ...defaultFilters, status: "all", tag, query: filters.query });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="title-block">
          <p className="eyebrow">Personal Media Log</p>
          <h1>Watchlist Database</h1>
          <HomeDashboard items={summaryItems} inboxTotal={inboxTotal} favoriteTotal={favoriteTotal} />
        </div>
        <div className="header-tools">
          <QuickCapture value={quickText} loading={loading} onChange={setQuickText} onSubmit={submitQuick} />
          <div className="search-field header-search">
            <Search size={15} />
            <input value={filters.query} onChange={(event) => patchFilters({ query: event.target.value })} placeholder="Search" />
          </div>
          <button className="icon-button mobile-sidebar-button" onClick={() => setSidebarOpen(true)} title="Open views"><Menu size={18} /></button>
        </div>
        <button className="icon-button" onClick={() => setDark((value) => !value)} title={dark ? "Switch to light mode" : "Switch to dark mode"}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {error && <div className="notice danger">{error}</div>}

      {(tab === "log" || tab === "organize") && (
        <>
          <div className="mobile-view-switch">
            {["table", "list", "poster", "watching", "plan_to_watch", "completed"].map((view) => (
              <button key={view} className={(displayView === view || activeView === view) ? "active" : ""} onClick={() => view === "table" || view === "list" || view === "poster" ? selectDisplayView(view as DisplayView) : selectView(view)}>
                {viewLabel(view)}
              </button>
            ))}
          </div>

          <main className={sidebarCollapsed ? "database-layout sidebar-collapsed" : "database-layout"}>
            <ViewSidebar
              activeView={activeView}
              displayView={displayView}
              tags={knownTags}
              filters={filters}
              collapsed={sidebarCollapsed}
              mobileOpen={sidebarOpen}
              onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
              onCloseMobile={() => setSidebarOpen(false)}
              onView={selectView}
              onDisplayView={selectDisplayView}
              onLibrary={selectLibrary}
              onTag={selectTag}
            />
            <section className="database-main">
              <div className="database-toolbar">
                <div className="view-tabs">
                  {["table", "list", "poster", "watching", "plan_to_watch", "completed"].map((view) => (
                    <button key={view} className={(displayView === view || activeView === view) ? "active" : ""} onClick={() => view === "table" || view === "list" || view === "poster" ? selectDisplayView(view as DisplayView) : selectView(view)}>{viewLabel(view)}</button>
                  ))}
                </div>
                <button className="filter-toggle" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={16} />Filter</button>
              </div>
              <div className="database-meta">
                <span>{viewLabel(activeView)} · {visibleItems.length === items.length ? total : visibleItems.length} items</span>
                <div>
                  <button disabled={filters.page <= 1} onClick={() => patchFilters({ page: filters.page - 1 })}>Prev</button>
                  <span>{filters.page} / {pageCount}</span>
                  <button disabled={filters.page >= pageCount} onClick={() => patchFilters({ page: filters.page + 1 })}>Next</button>
                </div>
              </div>
              <ItemList
                items={visibleItems}
                view={displayView}
                loading={loading}
                emptyMessage="No records yet. Add one quickly from the top bar."
                onSelect={setSelected}
                onToggleFavorite={toggleFavorite}
                onDelete={removeItem}
                onMetadata={openMetadataLookup}
                onQuickUpdate={quickUpdate}
              />
            </section>
          </main>
          <FilterSheet open={filtersOpen} filters={filters} onChange={patchFilters} onClose={() => setFiltersOpen(false)} />
        </>
      )}

      {tab === "stats" && <StatsPanel />}
      {tab === "data" && <ImportExport onImported={refreshVisibleData} />}

      <div className="utility-tabs">
        <button className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}>Database</button>
        <button className={tab === "stats" ? "active" : ""} onClick={() => setTab("stats")}><BarChart3 size={15} />Stats</button>
        <button className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}><DatabaseBackup size={15} />Data</button>
      </div>

      {selected && <ItemEditor item={selected} onClose={() => setSelected(null)} onSave={saveItem} onDelete={removeItem} />}
      {metadataTarget && (
        <MetadataLookupModal
          item={metadataTarget}
          query={metadataQuery}
          candidates={metadataCandidates}
          loading={metadataLoading}
          error={metadataError}
          onSearch={(query) => runMetadataSearch(metadataTarget, query)}
          onApply={applyCandidate}
          onClose={() => setMetadataTarget(null)}
        />
      )}
      <Toast message={toast} onClose={() => setToast("")} />
      <BottomTabBar active={tab} onChange={setTab} />
    </div>
  );
}

function viewLabel(view: string) {
  const labels: Record<string, string> = {
    table: "Table",
    list: "List",
    poster: "Poster Wall",
    inbox: "Inbox",
    favorites: "Favorites",
    highRated: "High Rated",
    plan_to_watch: "Plan to Watch",
    watching: "Watching",
    completed: "Completed",
    paused: "Paused",
    dropped: "Dropped",
    rewatching: "Rewatching"
  };
  return labels[view] || view;
}

function emptyItem(): Partial<MediaItem> {
  return {
    id: "",
    raw_title: "",
    official_title: null,
    original_title: null,
    code: null,
    type: null,
    category: null,
    platform: null,
    release_year: null,
    watched_at: null,
    started_at: null,
    completed_at: null,
    planned_at: null,
    rating: null,
    rewatch_score: null,
    favorite: false,
    status: "raw",
    quick_note: null,
    long_note: null,
    source_url: null,
    cover_url: null,
    metadata_json: null,
    progress_json: null,
    created_at: "",
    updated_at: "",
    deleted_at: null,
    tags: [],
    people: [],
    collections: []
  };
}
