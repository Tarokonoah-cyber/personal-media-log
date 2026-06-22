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
import type { ItemInput, ListFilters, MediaItem, TmdbCandidate } from "./types";

const defaultFilters: ListFilters = {
  query: "",
  status: "inbox",
  favorite: false,
  highRated: false,
  type: "",
  tag: "",
  year: "",
  platform: "",
  watchedFrom: "",
  watchedTo: "",
  page: 1,
  pageSize: 50
};

type Tab = "log" | "organize" | "stats" | "data";

export default function App() {
  const [tab, setTab] = useState<Tab>("log");
  const [quickText, setQuickText] = useState("");
  const [filters, setFilters] = useState<ListFilters>(defaultFilters);
  const [activeView, setActiveView] = useState("inbox");
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
      setError(err instanceof Error ? err.message : "讀取資料失敗");
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
      await createItem(parsed);
      setQuickText("");
      setToast("已新增到 Inbox");
      setActiveView("inbox");
      setActiveCategory("");
      setFilters((current) => ({ ...current, status: "inbox", page: 1 }));
      await refreshVisibleData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增失敗");
    } finally {
      setLoading(false);
    }
  }

  async function saveItem(input: ItemInput) {
    if (!selected) return;
    const saved = await updateItem(selected.id, input);
    setSelected(saved);
    setToast("已儲存");
    await refreshVisibleData();
  }

  async function removeItem(id: string) {
    await deleteItem(id);
    setSelected(null);
    setToast("已移到刪除狀態");
    await refreshVisibleData();
  }

  async function toggleFavorite(item: MediaItem) {
    await updateItem(item.id, { ...toItemInput(item), favorite: !item.favorite });
    setToast(item.favorite ? "已取消收藏" : "已加入收藏");
    await refreshVisibleData();
  }

  async function quickUpdate(item: MediaItem, patch: Partial<ItemInput>) {
    await updateItem(item.id, { ...toItemInput(item), ...patch });
    setToast("已更新");
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
      setMetadataError(err instanceof Error ? err.message : "TMDb 搜尋失敗");
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
      setToast("已套用 TMDb 資料");
      await refreshVisibleData();
    } catch (err) {
      setMetadataError(err instanceof Error ? err.message : "套用 TMDb 資料失敗");
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
    if (view === "all") setFilters({ ...base, status: "all" });
    if (view === "favorite") setFilters({ ...base, status: "all", favorite: true });
    if (view === "highRated") setFilters({ ...base, status: "all", highRated: true });
    if (view === "byType") setFilters({ ...base, status: "all" });
    if (view === "byPlatform") setFilters({ ...base, status: "all" });
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
          <h1>觀看資料庫</h1>
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
        <button className="icon-button" onClick={() => setDark((value) => !value)} title={dark ? "切換淺色模式" : "切換深色模式"}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {error && <div className="notice danger">{error}</div>}

      {(tab === "log" || tab === "organize") && (
        <>
          <div className="mobile-view-switch">
            {["inbox", "all", "favorite", "highRated", "byType", "byPlatform"].map((view) => (
              <button key={view} className={activeView === view ? "active" : ""} onClick={() => selectView(view)}>
                {viewLabel(view)}
              </button>
            ))}
          </div>

          <main className={sidebarCollapsed ? "database-layout sidebar-collapsed" : "database-layout"}>
            <ViewSidebar
              activeView={activeView}
              tags={knownTags}
              filters={filters}
              collapsed={sidebarCollapsed}
              mobileOpen={sidebarOpen}
              onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
              onCloseMobile={() => setSidebarOpen(false)}
              onView={selectView}
              onLibrary={selectLibrary}
              onTag={selectTag}
            />
            <section className="database-main">
              <div className="database-toolbar">
                <div className="view-tabs">
                  {["inbox", "all", "favorite", "highRated", "byType", "byPlatform"].map((view) => (
                    <button key={view} className={activeView === view ? "active" : ""} onClick={() => selectView(view)}>{viewLabel(view)}</button>
                  ))}
                </div>
                <button className="filter-toggle" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={16} />篩選</button>
              </div>
              <div className="database-meta">
                <span>{viewLabel(activeView)} · {visibleItems.length === items.length ? total : visibleItems.length} items</span>
                <div>
                  <button disabled={filters.page <= 1} onClick={() => patchFilters({ page: filters.page - 1 })}>上一頁</button>
                  <span>{filters.page} / {pageCount}</span>
                  <button disabled={filters.page >= pageCount} onClick={() => patchFilters({ page: filters.page + 1 })}>下一頁</button>
                </div>
              </div>
              <ItemList
                items={visibleItems}
                loading={loading}
                emptyMessage="還沒有紀錄。先在上方快速新增一筆，不用完整。"
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
        <button className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}>資料庫</button>
        <button className={tab === "stats" ? "active" : ""} onClick={() => setTab("stats")}><BarChart3 size={15} />統計</button>
        <button className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}><DatabaseBackup size={15} />資料</button>
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
    inbox: "Inbox",
    all: "All",
    favorite: "Favorites",
    highRated: "High Rated",
    byType: "By Type",
    byPlatform: "By Platform"
  };
  return labels[view] || view;
}
