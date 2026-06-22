import { BarChart3, DatabaseBackup, Moon, PencilLine, Search, SlidersHorizontal, Sun, Table2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BottomTabBar } from "./components/BottomTabBar";
import { FilterSheet } from "./components/FilterSheet";
import { HomeDashboard } from "./components/HomeDashboard";
import { ImportExport } from "./components/ImportExport";
import { ItemEditor } from "./components/ItemEditor";
import { ItemList } from "./components/ItemList";
import { QuickCapture } from "./components/QuickCapture";
import { StatsPanel } from "./components/StatsPanel";
import { Toast } from "./components/Toast";
import { createItem, deleteItem, listItems, updateItem } from "./lib/api";
import { toItemInput } from "./lib/itemTransforms";
import { parseQuickEntry } from "./lib/quickParse";
import type { ItemInput, ListFilters, MediaItem } from "./types";

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
  pageSize: 25
};

type Tab = "log" | "organize" | "stats" | "data";

export default function App() {
  const [tab, setTab] = useState<Tab>("log");
  const [quickText, setQuickText] = useState("");
  const [filters, setFilters] = useState<ListFilters>(defaultFilters);
  const [organizeItems, setOrganizeItems] = useState<MediaItem[]>([]);
  const [recentItems, setRecentItems] = useState<MediaItem[]>([]);
  const [inboxItems, setInboxItems] = useState<MediaItem[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [homeLoading, setHomeLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("theme") !== "light");

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    void loadHome();
  }, []);

  useEffect(() => {
    if (tab === "organize") void loadOrganize();
  }, [tab, filters]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / filters.pageSize)), [total, filters.pageSize]);

  async function loadHome() {
    setHomeLoading(true);
    setError("");
    try {
      const [recent, inbox, favorites] = await Promise.all([
        listItems({ ...defaultFilters, status: "all", pageSize: 100 }),
        listItems({ ...defaultFilters, status: "inbox", pageSize: 30 }),
        listItems({ ...defaultFilters, status: "all", favorite: true, highRated: true, pageSize: 30 })
      ]);
      setRecentItems(recent.items);
      setInboxItems(inbox.items);
      setFavoriteItems(favorites.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取資料失敗");
    } finally {
      setHomeLoading(false);
    }
  }

  async function loadOrganize() {
    setLoading(true);
    setError("");
    try {
      const result = await listItems(filters);
      setOrganizeItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取資料失敗");
    } finally {
      setLoading(false);
    }
  }

  async function refreshVisibleData() {
    await Promise.all([loadHome(), tab === "organize" ? loadOrganize() : Promise.resolve()]);
  }

  async function submitQuick() {
    const parsed = parseQuickEntry(quickText);
    if (!parsed.raw_title.trim()) return;
    setLoading(true);
    try {
      await createItem(parsed);
      setQuickText("");
      setToast("已新增到 Inbox");
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
    setToast("已儲存變更");
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
    setToast("已快速更新");
    await refreshVisibleData();
  }

  function patchFilters(patch: Partial<ListFilters>) {
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Personal Media Log</p>
          <h1>私人觀看紀錄</h1>
        </div>
        <button className="icon-button" onClick={() => setDark((value) => !value)} title={dark ? "切換淺色模式" : "切換深色模式"}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <nav className="desktop-tabs" aria-label="主要導覽">
        <button className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}><PencilLine size={16} />記錄</button>
        <button className={tab === "organize" ? "active" : ""} onClick={() => setTab("organize")}><Table2 size={16} />整理</button>
        <button className={tab === "stats" ? "active" : ""} onClick={() => setTab("stats")}><BarChart3 size={16} />統計</button>
        <button className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}><DatabaseBackup size={16} />資料</button>
      </nav>

      {error && <div className="notice danger">{error}</div>}

      {tab === "log" && (
        <>
          <QuickCapture value={quickText} loading={loading} onChange={setQuickText} onSubmit={submitQuick} />
          <HomeDashboard
            recent={recentItems}
            inbox={inboxItems}
            favorites={favoriteItems}
            loading={homeLoading}
            onSelect={setSelected}
            onToggleFavorite={toggleFavorite}
            onDelete={removeItem}
          />
        </>
      )}

      {tab === "organize" && (
        <section className="organize-view">
          <div className="sticky-search">
            <div className="search-field">
              <Search size={18} />
              <input value={filters.query} onChange={(event) => patchFilters({ query: event.target.value })} placeholder="搜尋標題、代碼、筆記、標籤、人物、平台" />
            </div>
            <button className="filter-toggle" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={17} />篩選</button>
          </div>

          <div className="list-meta">
            <span>{total} 筆紀錄</span>
            <div>
              <button disabled={filters.page <= 1} onClick={() => patchFilters({ page: filters.page - 1 })}>上一頁</button>
              <span>{filters.page} / {pageCount}</span>
              <button disabled={filters.page >= pageCount} onClick={() => patchFilters({ page: filters.page + 1 })}>下一頁</button>
            </div>
          </div>

          <ItemList
            items={organizeItems}
            loading={loading}
            mode="organize"
            onSelect={setSelected}
            onToggleFavorite={toggleFavorite}
            onDelete={removeItem}
            onQuickUpdate={quickUpdate}
          />
          <FilterSheet open={filtersOpen} filters={filters} onChange={patchFilters} onClose={() => setFiltersOpen(false)} />
        </section>
      )}

      {tab === "stats" && <StatsPanel />}
      {tab === "data" && <ImportExport onImported={refreshVisibleData} />}

      {selected && <ItemEditor item={selected} onClose={() => setSelected(null)} onSave={saveItem} onDelete={removeItem} />}
      <Toast message={toast} onClose={() => setToast("")} />
      <BottomTabBar active={tab} onChange={setTab} />
    </div>
  );
}
