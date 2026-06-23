import { Menu, Moon, Search, SlidersHorizontal, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FilterSheet } from "./components/FilterSheet";
import { ImportExport } from "./components/ImportExport";
import { ItemEditor } from "./components/ItemEditor";
import { ItemList } from "./components/ItemList";
import { MetadataLookupModal } from "./components/MetadataLookupModal";
import { QuickCapture } from "./components/QuickCapture";
import { StatsPanel } from "./components/StatsPanel";
import { Toast } from "./components/Toast";
import { ViewSidebar } from "./components/ViewSidebar";
import { applyMetadata, createItem, deleteItem, listItems, parseSmartAdd, searchMetadata, updateItem } from "./lib/api";
import { toItemInput } from "./lib/itemTransforms";
import { isPrivateItem, isPrivateLibraryLabel, isPrivateMarker } from "./lib/privacy";
import { parseQuickEntry } from "./lib/quickParse";
import { classifyItem, libraryTree } from "./lib/taxonomy";
import { getWatchStatus, updateWatchProgress } from "./lib/watch";
import type { ItemInput, ListFilters, MediaItem, SmartAddResponse, TmdbCandidate } from "./types";

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

type Tab = "log" | "stats" | "data" | "settings";
type DisplayView = "table" | "list" | "poster";
type DisplayDensity = "comfortable" | "standard" | "compact";
const displayViews: DisplayView[] = ["table", "list", "poster"];
const displayDensities: DisplayDensity[] = ["comfortable", "standard", "compact"];
const quickStatusViews = ["home", "watching", "plan_to_watch", "completed"];

export default function App() {
  const [tab, setTab] = useState<Tab>("log");
  const [displayView, setDisplayView] = useState<DisplayView>(() => (localStorage.getItem("displayView") as DisplayView) || "table");
  const [displayDensity, setDisplayDensity] = useState<DisplayDensity>(() => (localStorage.getItem("displayDensity") as DisplayDensity) || "standard");
  const [safeMode, setSafeMode] = useState(() => localStorage.getItem("safeMode") !== "false");
  const [quickText, setQuickText] = useState("");
  const [filters, setFilters] = useState<ListFilters>(defaultFilters);
  const [activeView, setActiveView] = useState("home");
  const [activeCategory, setActiveCategory] = useState("");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [summaryItems, setSummaryItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [inboxTotal, setInboxTotal] = useState(0);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [metadataTarget, setMetadataTarget] = useState<MediaItem | null>(null);
  const [metadataCandidates, setMetadataCandidates] = useState<TmdbCandidate[]>([]);
  const [metadataQuery, setMetadataQuery] = useState("");
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState("");
  const [smartPreview, setSmartPreview] = useState<SmartAddResponse | null>(null);
  const [smartDraft, setSmartDraft] = useState<ItemInput | null>(null);
  const [smartLoading, setSmartLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebarCollapsed") === "true");
  const [dark, setDark] = useState(() => localStorage.getItem("theme") !== "light");
  const privateView = isPrivateLibraryLabel(activeView);
  const includePrivate = privateView && !safeMode;

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
    localStorage.setItem("displayDensity", displayDensity);
  }, [displayDensity]);

  useEffect(() => {
    localStorage.setItem("safeMode", String(safeMode));
  }, [safeMode]);

  useEffect(() => {
    void loadItems();
  }, [filters, includePrivate]);

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
    const scopedItems = includePrivate ? items.filter(isPrivateItem) : items.filter((item) => !isPrivateItem(item));
    if (activeCategory) return scopedItems.filter((item) => classifyItem(item).category === activeCategory);
    if (libraryTypes.has(activeView)) return scopedItems.filter((item) => classifyItem(item).type === activeView);
    if (["plan_to_watch", "watching", "completed", "paused", "dropped", "rewatching"].includes(activeView)) {
      return scopedItems.filter((item) => getWatchStatus(item) === activeView);
    }
    return scopedItems;
  }, [activeCategory, activeView, includePrivate, items, libraryTypes]);

  async function loadItems() {
    setLoading(true);
    setError("");
    try {
      const result = await listItems({ ...filters, includePrivate, privateOnly: includePrivate });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取紀錄失敗");
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    try {
      const [all, inbox] = await Promise.all([
        listItems({ ...defaultFilters, includePrivate: false, privateOnly: false, pageSize: 100 }),
        listItems({ ...defaultFilters, includePrivate: false, privateOnly: false, status: "inbox", pageSize: 1 })
      ]);
      setSummaryItems(all.items);
      setInboxTotal(inbox.total);
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
      setToast("已新增到待觀看");
      setTab("log");
      setActiveView("plan_to_watch");
      setActiveCategory("");
      setFilters((current) => ({ ...current, status: "all", page: 1 }));
      await refreshVisibleData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增紀錄失敗");
    } finally {
      setLoading(false);
    }
  }

  async function requestSmartAdd() {
    if (!quickText.trim()) return;
    setSmartLoading(true);
    setError("");
    try {
      const result = await parseSmartAdd(quickText);
      setSmartPreview(result);
      setSmartDraft(result.input);
    } catch (err) {
      setError(err instanceof Error ? err.message : "智慧新增解析失敗");
    } finally {
      setSmartLoading(false);
    }
  }

  async function confirmSmartAdd() {
    if (!smartDraft?.raw_title.trim()) return;
    setLoading(true);
    try {
      await createItem(smartDraft);
      setQuickText("");
      setSmartPreview(null);
      setSmartDraft(null);
      setToast("已用智慧新增建立紀錄");
      setTab("log");
      setActiveView(smartDraft.status === "complete" ? "completed" : "home");
      setActiveCategory("");
      setFilters((current) => ({ ...current, status: "all", page: 1 }));
      await refreshVisibleData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "智慧新增失敗");
    } finally {
      setLoading(false);
    }
  }

  function updateSmartDraft(patch: Partial<ItemInput>) {
    if (!smartDraft) return;
    setSmartDraft({ ...smartDraft, ...patch });
  }

  async function saveItem(input: ItemInput) {
    if (!selected) return;
    const saved = await updateItem(selected.id, input);
    setSelected(saved);
    setToast("已儲存");
    await refreshVisibleData();
  }

  async function removeItem(id: string) {
    if (!window.confirm("確定要刪除這筆紀錄嗎？")) return;
    await deleteItem(id);
    setSelected(null);
    setToast("已刪除");
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

  function toggleSafeMode() {
    setSafeMode((current) => {
      const next = !current;
      if (next && isPrivateLibraryLabel(activeView)) {
        setActiveView("home");
        setActiveCategory("");
      }
      return next;
    });
  }

  function selectView(view: string) {
    setTab("log");
    setActiveView(view);
    setActiveCategory("");
    const base = { ...defaultFilters, query: filters.query };
    if (view === "favorites") setFilters({ ...base, favorite: true });
    else setFilters(base);
    setSidebarOpen(false);
  }

  function selectDisplayView(view: DisplayView) {
    setTab("log");
    setDisplayView(view);
  }

  function selectDisplayDensity(density: DisplayDensity) {
    setDisplayDensity(density);
  }

  function selectLibrary(type: string, category?: string) {
    setTab("log");
    setActiveView(category ? `${type}/${category}` : type);
    setActiveCategory(category || "");
    setFilters({ ...defaultFilters, status: "all", query: filters.query, pageSize: 100 });
    setSidebarOpen(false);
  }

  function selectTag(tag: string) {
    setTab("log");
    setActiveView(`#${tag}`);
    setActiveCategory("");
    setFilters({ ...defaultFilters, status: "all", tag, query: filters.query });
    setSidebarOpen(false);
  }

  function selectTool(nextTab: "stats" | "data" | "settings") {
    setTab(nextTab);
    setActiveView(nextTab);
    setActiveCategory("");
    setSidebarOpen(false);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-button mobile-sidebar-button" onClick={() => setSidebarOpen(true)} title="開啟導覽"><Menu size={18} /></button>
        <div className="header-tools">
          <QuickCapture
            value={quickText}
            loading={loading}
            smartLoading={smartLoading}
            onChange={(value) => {
              setQuickText(value);
              setSmartPreview(null);
              setSmartDraft(null);
            }}
            onSubmit={submitQuick}
            onSmartAdd={requestSmartAdd}
          />
          <div className="search-field header-search">
            <Search size={15} />
            <input value={filters.query} onChange={(event) => patchFilters({ query: event.target.value })} placeholder="搜尋標題、標籤、平台" />
          </div>
        </div>
        <button className="icon-button" onClick={() => setDark((value) => !value)} title={dark ? "切換淺色模式" : "切換深色模式"}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {error && <div className="notice danger">{error}</div>}
      {smartPreview && smartDraft && (
        <SmartAddPreview
          preview={smartPreview}
          draft={smartDraft}
          loading={loading}
          onChange={updateSmartDraft}
          onCancel={() => {
            setSmartPreview(null);
            setSmartDraft(null);
          }}
          onConfirm={confirmSmartAdd}
        />
      )}

      <main className={sidebarCollapsed ? "database-layout sidebar-collapsed" : "database-layout"}>
        <ViewSidebar
          activeView={activeView}
          displayView={displayView}
          activeTool={tab === "stats" || tab === "data" || tab === "settings" ? tab : null}
          summaryItems={summaryItems}
          inboxTotal={inboxTotal}
          tags={knownTags}
          filters={filters}
          safeMode={safeMode}
          collapsed={sidebarCollapsed}
          mobileOpen={sidebarOpen}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
          onCloseMobile={() => setSidebarOpen(false)}
          onView={selectView}
          onDisplayView={selectDisplayView}
          onLibrary={selectLibrary}
          onTag={selectTag}
          onTool={selectTool}
        />

        <section className="database-main">
          {tab === "log" && (
            <>
              <div className="database-meta">
                <span>{viewLabel(activeView)} · {visibleItems.length === items.length ? total : visibleItems.length} 筆</span>
                <div>
                  <button disabled={filters.page <= 1} onClick={() => patchFilters({ page: filters.page - 1 })}>上一頁</button>
                  <span>{filters.page} / {pageCount}</span>
                  <button disabled={filters.page >= pageCount} onClick={() => patchFilters({ page: filters.page + 1 })}>下一頁</button>
                </div>
              </div>
              <div className="database-toolbar">
                <div className="toolbar-control-row">
                  <div className="segmented-control view-segment" aria-label="視圖切換">
                    {displayViews.map((view) => (
                      <button key={view} className={displayView === view ? "active" : ""} onClick={() => selectDisplayView(view)}>
                        {viewLabel(view)}
                      </button>
                    ))}
                  </div>
                  <div className="toolbar-spacer" />
                  <div className="segmented-control status-segment" aria-label="快速狀態篩選">
                    {quickStatusViews.map((view) => (
                      <button key={view} className={isQuickStatusActive(view, activeView) ? "active" : ""} onClick={() => selectView(view)}>
                        {quickFilterLabel(view)}
                      </button>
                    ))}
                  </div>
                  <button className="filter-toggle advanced-filter" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={16} />進階篩選</button>
                </div>
              </div>
              <ItemList
                items={visibleItems}
                view={displayView}
                privateMode={privateView && includePrivate}
                density={displayDensity}
                loading={loading}
                emptyMessage="還沒有紀錄，先從上方快速新增一筆就好。"
                onSelect={setSelected}
                onToggleFavorite={toggleFavorite}
                onDelete={removeItem}
                onMetadata={openMetadataLookup}
                onQuickUpdate={quickUpdate}
              />
            </>
          )}

          {tab === "stats" && <StatsPanel includePrivate={false} />}
          {tab === "data" && <ImportExport safeMode={safeMode} onImported={refreshVisibleData} />}
          {tab === "settings" && (
            <SettingsPanel
              dark={dark}
              safeMode={safeMode}
              density={displayDensity}
              onThemeChange={setDark}
              onDensityChange={selectDisplayDensity}
              onToggleSafeMode={toggleSafeMode}
            />
          )}
        </section>
      </main>

      <FilterSheet open={filtersOpen} filters={filters} onChange={patchFilters} onClose={() => setFiltersOpen(false)} />

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
    </div>
  );
}

function viewLabel(view: string) {
  const labels: Record<string, string> = {
    home: "首頁",
    database: "資料庫",
    table: "表格",
    list: "清單",
    poster: "海報牆",
    favorites: "收藏",
    plan_to_watch: "待觀看",
    watching: "觀看中",
    completed: "已完成",
    paused: "暫停",
    dropped: "已放棄",
    rewatching: "重看中",
    stats: "統計",
    data: "資料備份",
    settings: "設定"
  };
  return labels[view] || view;
}

function isQuickStatusActive(view: string, activeView: string) {
  if (view === "home") return activeView === "home" || activeView === "database";
  return activeView === view;
}

function quickFilterLabel(view: string) {
  const labels: Record<string, string> = {
    home: "全部",
    watching: "觀看中",
    plan_to_watch: "待觀看",
    completed: "已完成",
    favorites: "收藏"
  };
  return labels[view] || view;
}

function densityLabel(density: string) {
  const labels: Record<string, string> = {
    comfortable: "舒適",
    standard: "標準",
    compact: "緊湊"
  };
  return labels[density] || density;
}

function SmartAddPreview({
  preview,
  draft,
  loading,
  onChange,
  onCancel,
  onConfirm
}: {
  preview: SmartAddResponse;
  draft: ItemInput;
  loading: boolean;
  onChange: (patch: Partial<ItemInput>) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <section className="smart-preview" aria-label="智慧新增確認">
      <div>
        <p className="eyebrow">智慧新增預覽</p>
        <strong>{preview.summary}</strong>
        <span>{preview.source === "ai" ? "AI 解析" : "規則解析"} · {preview.parsed.is_sports ? "運動比賽" : "普通紀錄"}</span>
      </div>
      <div className="smart-preview-grid">
        <label>
          標題
          <input value={draft.raw_title} onChange={(event) => onChange({ raw_title: event.target.value })} />
        </label>
        <label>
          類型
          <input value={draft.type || ""} onChange={(event) => onChange({ type: event.target.value || null })} placeholder="Other" />
        </label>
        <label>
          分類
          <input value={draft.category || ""} onChange={(event) => onChange({ category: event.target.value || null })} placeholder="Baseball" />
        </label>
        <label>
          聯盟 / 平台
          <input value={draft.platform || ""} onChange={(event) => onChange({ platform: event.target.value || null })} placeholder="MLB / NPB / CPBL" />
        </label>
        <label>
          日期
          <input type="date" value={draft.watched_at || ""} onChange={(event) => onChange({ watched_at: event.target.value || null })} />
        </label>
        <label className="wide">
          標籤
          <input value={(draft.tags || []).join(", ")} onChange={(event) => onChange({ tags: splitTags(event.target.value) })} placeholder="MLB, 棒球, 藍鳥" />
        </label>
      </div>
      <div className="smart-preview-actions">
        <button onClick={onCancel}>取消</button>
        <button className="primary" disabled={loading || !draft.raw_title.trim()} onClick={onConfirm}>確認新增</button>
      </div>
    </section>
  );
}

function splitTags(value: string) {
  return Array.from(new Set(value.split(/[,，#]/).map((tag) => tag.trim()).filter(Boolean).filter((tag) => !isPrivateMarker(tag))));
}

function SettingsPanel({
  dark,
  safeMode,
  density,
  onThemeChange,
  onDensityChange,
  onToggleSafeMode
}: {
  dark: boolean;
  safeMode: boolean;
  density: DisplayDensity;
  onThemeChange: (value: boolean) => void;
  onDensityChange: (value: DisplayDensity) => void;
  onToggleSafeMode: () => void;
}) {
  return (
    <section className="settings-panel">
      <div>
        <p className="eyebrow">設定</p>
        <h1>偏好設定</h1>
      </div>
      <label className="check">
        <input type="checkbox" checked={dark} onChange={(event) => onThemeChange(event.target.checked)} />
        使用深色模式
      </label>
      <label className="check">
        <input type="checkbox" checked={safeMode} onChange={onToggleSafeMode} />
        安全模式
      </label>
      <div className="settings-control">
        <span>表格密度</span>
        <div className="segmented-control density-segment" aria-label="表格密度">
          {displayDensities.map((value) => (
            <button key={value} className={density === value ? "active" : ""} onClick={() => onDensityChange(value)}>
              {densityLabel(value)}
            </button>
          ))}
        </div>
      </div>
      <p className="muted-cell">安全模式開啟時，私密內容不會出現在列表、搜尋、標籤與統計中。此偏好只在本機儲存開關狀態。</p>
    </section>
  );
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
    is_private: false,
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
