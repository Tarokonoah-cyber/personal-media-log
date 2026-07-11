import { Bookmark, Check, CircleSlash2, Columns3, Home, Menu, Moon, Plus, Save, Search, SlidersHorizontal, Star, Sun, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FilterSheet } from "./components/FilterSheet";
import { HomeDashboard } from "./components/HomeDashboard";
import { ImportExport } from "./components/ImportExport";
import { ItemEditor } from "./components/ItemEditor";
import { ItemList } from "./components/ItemList";
import { CalendarView } from "./components/CalendarView";
import { MetadataLookupModal } from "./components/MetadataLookupModal";
import { QuickCapture } from "./components/QuickCapture";
import { SmartOrganizer } from "./components/SmartOrganizer";
import { StatsPanel } from "./components/StatsPanel";
import { Toast } from "./components/Toast";
import { ViewSidebar } from "./components/ViewSidebar";
import { PrivateQualityCenter } from "./components/PrivateQualityCenter";
import { applyMetadata, createItem, deleteItem, getItem, getPrivateFacets, listItems, parseSmartAdd, quickUpdateItem as quickUpdateItemApi, searchMetadata, updateItem } from "./lib/api";
import { mergePrivateFilters } from "./lib/privateFilters";
import { collectionLevelLabels, collectionLevels, normalizeCollectionLevel } from "../shared/privateModel";
import { createSavedView, readSavedViews, savedViewSignature, writeSavedViews, type SavedPrivateView } from "./lib/savedViews";
import { toItemInput } from "./lib/itemTransforms";
import { isPrivateItem, isPrivateLibraryLabel, isPrivateMarker, privateItemDetails, PRIVATE_LIBRARY_LABEL, PRIVATE_RECOMMENDED_LABEL, PRIVATE_RECOMMENDED_TAG } from "./lib/privacy";
import { parseQuickEntry } from "./lib/quickParse";
import { collectionLevelOptions } from "./lib/reflection";
import { classifyItem, libraryTree } from "./lib/taxonomy";
import { getWatchStatus, updateWatchProgress } from "./lib/watch";
import type { ItemInput, ListFilters, MediaItem, PrivateFacets, PrivateSummary, SmartAddResponse, TmdbCandidate } from "./types";

const defaultFilters: ListFilters = {
  query: "",
  status: "all",
  favorite: false,
  highRated: false,
  ratingMin: "",
  ratingMax: "",
  unrated: false,
  usedFilter: "all",
  collectionLevel: "",
  favoriteLevel: "all",
  mediaStatus: "all",
  platformFilters: "",
  makerFilters: "",
  favoriteLevelFilters: "",
  personFilters: "",
  missingPeople: false,
  hasNote: "all",
  hasCover: "all",
  watchStatus: "all",
  type: "",
  category: "",
  tag: "",
  excludeTag: "",
  year: "",
  platform: "",
  maker: "",
  series: "",
  codeQuery: "",
  titleQuery: "",
  person: "",
  studio: "",
  watchedFrom: "",
  watchedTo: "",
  updatedFrom: "",
  updatedTo: "",
  page: 1,
  pageSize: 100
};

type Tab = "log" | "organizer" | "stats" | "data" | "settings" | "quality";
type DisplayView = "table" | "list" | "poster" | "calendar";
type PrivateDisplayView = "table" | "list";
type DisplayDensity = "comfortable" | "standard" | "compact";
const displayViews: DisplayView[] = ["table", "list", "poster", "calendar"];
const displayDensities: DisplayDensity[] = ["comfortable", "standard", "compact"];
const quickStatusViews = ["home", "watching", "plan_to_watch", "completed"];
const PRIVATE_TABLE_PREFERENCES_KEY = "private-library-table-preferences-v1";

type PrivateColumnId = "title" | "rating" | "favorite" | "used" | "actress" | "tags" | "source" | "summary";

type PrivateColumnDefinition = {
  id: PrivateColumnId;
  label: string;
  width: number;
  minWidth: number;
  maxWidth: number;
  required?: boolean;
  defaultHidden?: boolean;
};

type PrivateTablePreferences = {
  order: PrivateColumnId[];
  widths: Record<PrivateColumnId, number>;
  visible: Record<PrivateColumnId, boolean>;
  pageSize: number;
};

const privateColumnDefinitions: PrivateColumnDefinition[] = [
  { id: "title", label: "作品代號 / 標題", width: 520, minWidth: 320, maxWidth: 900, required: true },
  { id: "rating", label: "評分", width: 78, minWidth: 64, maxWidth: 120 },
  { id: "favorite", label: "收藏", width: 68, minWidth: 56, maxWidth: 110 },
  { id: "used", label: "已閱", width: 56, minWidth: 50, maxWidth: 90 },
  { id: "actress", label: "女優", width: 180, minWidth: 120, maxWidth: 360 },
  { id: "tags", label: "標籤", width: 220, minWidth: 140, maxWidth: 420 },
  { id: "source", label: "來源", width: 140, minWidth: 100, maxWidth: 260, defaultHidden: true },
  { id: "summary", label: "一句話心得", width: 280, minWidth: 180, maxWidth: 520, defaultHidden: true }
];

const privateColumnMap = Object.fromEntries(privateColumnDefinitions.map((column) => [column.id, column])) as Record<PrivateColumnId, PrivateColumnDefinition>;
const privateColumnIds = privateColumnDefinitions.map((column) => column.id);

function defaultPrivateTablePreferences(): PrivateTablePreferences {
  return {
    order: privateColumnIds,
    widths: Object.fromEntries(privateColumnDefinitions.map((column) => [column.id, column.width])) as Record<PrivateColumnId, number>,
    visible: Object.fromEntries(privateColumnDefinitions.map((column) => [column.id, !column.defaultHidden])) as Record<PrivateColumnId, boolean>,
    pageSize: 100
  };
}

function normalizePrivateTablePreferences(value?: Partial<PrivateTablePreferences> | null): PrivateTablePreferences {
  const defaults = defaultPrivateTablePreferences();
  const order = [...(value?.order || []).filter((id): id is PrivateColumnId => privateColumnIds.includes(id as PrivateColumnId)), ...privateColumnIds.filter((id) => !(value?.order || []).includes(id))];
  const widths = { ...defaults.widths, ...(value?.widths || {}) };
  const visible = { ...defaults.visible, ...(value?.visible || {}), title: true };
  for (const column of privateColumnDefinitions) {
    widths[column.id] = Math.min(column.maxWidth, Math.max(column.minWidth, Number(widths[column.id]) || column.width));
    if (column.required) visible[column.id] = true;
  }
  return {
    order,
    widths,
    visible,
    pageSize: [50, 100, 200].includes(Number(value?.pageSize)) ? Number(value?.pageSize) : defaults.pageSize
  };
}

function readPrivateTablePreferences() {
  if (typeof localStorage === "undefined") return defaultPrivateTablePreferences();
  try {
    return normalizePrivateTablePreferences(JSON.parse(localStorage.getItem(PRIVATE_TABLE_PREFERENCES_KEY) || "null"));
  } catch {
    return defaultPrivateTablePreferences();
  }
}

function savePrivateTablePreferences(preferences: PrivateTablePreferences) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PRIVATE_TABLE_PREFERENCES_KEY, JSON.stringify(normalizePrivateTablePreferences(preferences)));
}

function initialPrivatePageSize() {
  return readPrivateTablePreferences().pageSize;
}

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
  const [privateSummary, setPrivateSummary] = useState<PrivateSummary | null>(null);
  const [privateFacets, setPrivateFacets] = useState<PrivateFacets | null>(null);
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
  const [simpleAddOpen, setSimpleAddOpen] = useState(false);
  const [smartLoading, setSmartLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const loadRequestId = useRef(0);
  const facetRequestId = useRef(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebarCollapsed") === "true");
  const [privateSidebarCollapsed, setPrivateSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("private-sidebar-collapsed-v1") === "true"; } catch { return false; }
  });
  const [organizerPrivateMode, setOrganizerPrivateMode] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("theme") !== "light");
  const privateView = isPrivateWorkspaceView(activeView);
  const includePrivate = privateView && !safeMode;
  const privateActive = privateView && includePrivate;
  const privateRecommendedActive = activeView === PRIVATE_RECOMMENDED_LABEL && includePrivate;
  const privatePageTitle = privateRecommendedActive ? PRIVATE_RECOMMENDED_LABEL : PRIVATE_LIBRARY_LABEL;
  const currentDisplayView = privateActive ? "table" : displayView;
  const effectiveSidebarCollapsed = privateActive ? privateSidebarCollapsed : sidebarCollapsed;

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    try { localStorage.setItem("private-sidebar-collapsed-v1", String(privateSidebarCollapsed)); } catch { /* use in-memory preference */ }
  }, [privateSidebarCollapsed]);

  useEffect(() => {
    if (!privateActive) return;
    const privatePageSize = initialPrivatePageSize();
    setFilters((current) => current.pageSize === privatePageSize ? current : { ...current, pageSize: privatePageSize, page: 1 });
  }, [privateActive]);

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
  const sidebarTags = useMemo(() => {
    if (!includePrivate) return knownTags;
    return Array.from(new Set(items.flatMap((item) => item.tags))).sort((a, b) => a.localeCompare(b, "zh-Hant"));
  }, [includePrivate, items, knownTags]);
  const libraryTypes = useMemo(() => new Set<string>(libraryTree.map((entry) => entry.label)), []);
  const visibleItems = useMemo(() => {
    const scopedItems = includePrivate ? items : items.filter((item) => !isPrivateItem(item));
    if (activeCategory) return scopedItems;
    if (libraryTypes.has(activeView)) return scopedItems;
    if (["plan_to_watch", "watching", "completed", "paused", "dropped", "rewatching"].includes(activeView)) return scopedItems;
    return scopedItems;
  }, [activeCategory, activeView, includePrivate, items, libraryTypes]);
  const privateFacetFilters = useMemo<ListFilters>(() => ({
    ...defaultFilters,
    query: filters.query,
    platformFilters: filters.platformFilters,
    makerFilters: filters.makerFilters,
    favoriteLevelFilters: filters.favoriteLevelFilters,
    personFilters: filters.personFilters,
    missingPeople: filters.missingPeople,
    ratingMin: filters.ratingMin,
    ratingMax: filters.ratingMax,
    unrated: filters.unrated,
    usedFilter: filters.usedFilter,
    tag: filters.tag,
    hasNote: filters.hasNote,
    hasCover: filters.hasCover,
    page: 1,
    pageSize: 1
  }), [filters.query, filters.platformFilters, filters.makerFilters, filters.favoriteLevelFilters, filters.personFilters, filters.missingPeople, filters.ratingMin, filters.ratingMax, filters.unrated, filters.usedFilter, filters.tag, filters.hasNote, filters.hasCover]);

  async function loadItems() {
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setError("");
    try {
      const result = await listItems({ ...filters, includePrivate, privateOnly: includePrivate, includeFacets: false });
      if (requestId !== loadRequestId.current) return;
      setItems(result.items);
      setTotal(result.total);
      setPrivateSummary(result.privateSummary || null);
    } catch (err) {
      if (requestId !== loadRequestId.current) return;
      setError(err instanceof Error ? err.message : "讀取紀錄失敗");
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (!privateActive) return;
    const requestId = ++facetRequestId.current;
    const timer = window.setTimeout(() => {
      void getPrivateFacets(privateFacetFilters)
        .then((facets) => {
          if (requestId === facetRequestId.current) setPrivateFacets(facets);
        })
        .catch((facetError) => {
          if (requestId === facetRequestId.current) console.error("Private facets request failed", facetError);
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [privateActive, privateFacetFilters]);

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
    const parsed = parseQuickEntry(quickText, { privateMode: includePrivate });
    if (!parsed.raw_title.trim()) return;
    setLoading(true);
    try {
      await createItem(includePrivate ? withPrivatePageDefaults(parsed, privateRecommendedActive) : {
        ...parsed,
        ...updateWatchProgress({ ...emptyItem(), raw_title: parsed.raw_title } as MediaItem, { watch_status: "plan_to_watch" })
      });
      setQuickText("");
      setToast(includePrivate ? "已新增私密紀錄" : "已新增到待觀看");
      setTab("log");
      setActiveView(includePrivate ? PRIVATE_LIBRARY_LABEL : "plan_to_watch");
      setActiveCategory("");
      setFilters((current) => ({ ...current, status: "all", page: 1 }));
      await refreshVisibleData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增紀錄失敗");
    } finally {
      setLoading(false);
    }
  }

  async function submitSimpleAdd(input: ItemInput) {
    setLoading(true);
    try {
      const nextInput = withPrivatePageDefaults(input, privateRecommendedActive);
      await createItem(nextInput);
      setSimpleAddOpen(false);
      setToast(nextInput.is_private ? "已新增私密紀錄" : "已新增紀錄");
      setTab("log");
      if (nextInput.is_private && !privateRecommendedActive) setActiveView(PRIVATE_LIBRARY_LABEL);
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

  async function openItemDetail(item: MediaItem) {
    setSelected(item);
    try {
      const fullItem = await getItem(item.id);
      setSelected(fullItem);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入單筆資料失敗");
    }
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

  async function quickPrivateUpdate(item: MediaItem, field: "collection_level" | "rating" | "used", value: unknown) {
    const previous = item;
    const optimistic = { ...item, [field]: value } as MediaItem;
    setItems((current) => current.map((entry) => entry.id === item.id ? optimistic : entry));
    try {
      const updated = await quickUpdateItemApi(item.id, field, value);
      setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry));
      setToast("已更新");
      try {
        setPrivateFacets(await getPrivateFacets(privateFacetFilters));
        await loadItems();
      } catch (refreshError) {
        setError(refreshError instanceof Error ? refreshError.message : "資料已更新，但重新整理失敗");
      }
    } catch (err) {
      setItems((current) => current.map((entry) => entry.id === item.id ? previous : entry));
      setError(err instanceof Error ? err.message : "快速更新失敗");
      throw err;
    }
  }

  async function quickCreateFromTable(input: ItemInput) {
    await createItem(withPrivatePageDefaults(input, privateRecommendedActive));
    setToast("已新增");
    setFilters((current) => ({ ...current, status: "all", page: 1 }));
    await refreshVisibleData();
  }

  async function batchUpdate(targets: MediaItem[], patch: Partial<ItemInput> | ((item: MediaItem) => Partial<ItemInput>)) {
    if (targets.length === 0) return;
    setLoading(true);
    try {
      await Promise.all(targets.map((item) => updateItem(item.id, { ...toItemInput(item), ...(typeof patch === "function" ? patch(item) : patch) })));
      setToast(`已更新 ${targets.length} 筆`);
      await refreshVisibleData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "批次更新失敗");
    } finally {
      setLoading(false);
    }
  }

  async function batchDelete(targets: MediaItem[]) {
    if (targets.length === 0) return;
    if (!window.confirm(`確定要刪除 ${targets.length} 筆紀錄嗎？`)) return;
    setLoading(true);
    try {
      await Promise.all(targets.map((item) => deleteItem(item.id)));
      setSelected(null);
      setToast(`已刪除 ${targets.length} 筆`);
      await refreshVisibleData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "批次刪除失敗");
    } finally {
      setLoading(false);
    }
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

  function selectPrivateFilter(patch: Partial<ListFilters>) {
    const recommendedPage = patch.tag === PRIVATE_RECOMMENDED_TAG;
    setTab("log");
    setActiveView(recommendedPage ? PRIVATE_RECOMMENDED_LABEL : PRIVATE_LIBRARY_LABEL);
    setActiveCategory("");
    setFilters((current) => mergePrivateFilters(current, patch));
    setSidebarOpen(false);
  }

  function toggleSafeMode() {
    setSafeMode((current) => {
      const next = !current;
      if (next && isPrivateWorkspaceView(activeView)) {
        setActiveView("home");
        setActiveCategory("");
        setOrganizerPrivateMode(false);
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
    else if (view === "inbox") setFilters({ ...base, status: "inbox", watchStatus: "all" });
    else if (isWatchStatusView(view)) setFilters({ ...base, watchStatus: view as typeof defaultFilters.watchStatus });
    else if (view === "database") setFilters({ ...base, status: "all", watchStatus: "all" });
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
    setFilters({
      ...defaultFilters,
      status: "all",
      watchStatus: "all",
      type,
      category: category || "",
      query: filters.query,
      excludeTag: "",
      pageSize: 100
    });
    setSidebarOpen(false);
  }

  function selectTag(tag: string) {
    setTab("log");
    setActiveView(`#${tag}`);
    setActiveCategory("");
    setFilters({ ...defaultFilters, status: "all", tag, query: filters.query });
    setSidebarOpen(false);
  }

  function selectTool(nextTab: "organizer" | "stats" | "data" | "settings" | "quality") {
    if (nextTab === "organizer") setOrganizerPrivateMode(includePrivate);
    setTab(nextTab);
    setActiveView(nextTab === "quality" ? PRIVATE_LIBRARY_LABEL : nextTab);
    setActiveCategory("");
    setSidebarOpen(false);
  }

  function resetFilters() {
    const keepRecommendedPage = privateRecommendedActive;
    setActiveView(privateActive ? (keepRecommendedPage ? PRIVATE_RECOMMENDED_LABEL : PRIVATE_LIBRARY_LABEL) : "database");
    setActiveCategory("");
    setFilters(keepRecommendedPage ? { ...defaultFilters, tag: PRIVATE_RECOMMENDED_TAG } : { ...defaultFilters, excludeTag: "" });
  }

  function returnHome() {
    setTab("log");
    setActiveView("home");
    setActiveCategory("");
    setFilters(defaultFilters);
    setSidebarOpen(false);
  }

  return (
    <div className="app-shell">
      <header className={privateActive ? "topbar private-shell-topbar" : "topbar"}>
        <button className="icon-button mobile-sidebar-button" onClick={() => setSidebarOpen(true)} title="開啟導覽" aria-label="開啟導覽" aria-expanded={sidebarOpen} aria-controls="private-sidebar"><Menu size={18} /></button>
        {privateActive ? (
          <div className="private-shell-main">
            <button className="filter-toggle private-return-home" onClick={returnHome}>
              <Home size={16} />
              返回首頁
            </button>
            <div className="private-shell-title">
              <strong>{privatePageTitle}</strong>
              <span>{privateRecommendedActive ? "網友推薦好片片" : "高密度資料管理"}</span>
            </div>
          </div>
        ) : (
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
              onSimpleAdd={() => setSimpleAddOpen(true)}
              onSmartAdd={requestSmartAdd}
            />
            <div className="search-field header-search">
              <Search size={15} />
              <input value={filters.query} onChange={(event) => patchFilters({ query: event.target.value })} placeholder="搜尋標題、標籤、平台" />
            </div>
          </div>
        )}
        <button className="icon-button" onClick={() => setDark((value) => !value)} title={dark ? "切換淺色模式" : "切換深色模式"}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {error && !privateActive && <div className="notice danger">{error}</div>}
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

      <main className={`${privateActive ? "database-layout private-layout" : "database-layout"}${effectiveSidebarCollapsed ? " sidebar-collapsed" : ""}`}>
        <ViewSidebar
          activeView={activeView}
          displayView={displayView}
          activeTool={tab === "organizer" || tab === "stats" || tab === "data" || tab === "settings" || tab === "quality" ? tab : null}
          summaryItems={summaryItems}
          inboxTotal={inboxTotal}
          tags={sidebarTags}
          filters={filters}
          privateMode={privateActive}
          privateSummary={privateSummary}
          privateFacets={privateFacets}
          safeMode={safeMode}
          collapsed={effectiveSidebarCollapsed}
          mobileOpen={sidebarOpen}
          onToggleCollapsed={() => {
            if (privateActive) {
              setPrivateSidebarCollapsed((value) => !value);
              return;
            }
            setSidebarCollapsed((value) => !value);
          }}
          onCloseMobile={() => setSidebarOpen(false)}
          onView={selectView}
          onDisplayView={selectDisplayView}
          onLibrary={selectLibrary}
          onTag={selectTag}
          onTool={selectTool}
          onPrivateFilter={selectPrivateFilter}
        />

        <section className="database-main">
          {tab === "log" && (
            <>
              {privateActive ? (
                <PrivateWorkbenchV3
                  filters={filters}
                  items={visibleItems}
                  loading={loading}
                  pageCount={pageCount}
                  total={total}
                  error={error}
                  onPatchFilters={patchFilters}
                  onClearFilters={resetFilters}
                  onRetry={() => void loadItems()}
                  onOpenAdvanced={() => setFiltersOpen(true)}
                  onAdd={() => setSimpleAddOpen(true)}
                  onSelect={(item) => void openItemDetail(item)}
                  onQuickUpdate={quickPrivateUpdate}
                  onApplyFilters={(next) => setFilters({ ...defaultFilters, ...next, page: 1 })}
                />
              ) : activeView === "home" && !filters.query && !filters.favorite ? (
                <HomeDashboard
                  variant="main"
                  includePrivate={includePrivate}
                  onView={selectView}
                  onTool={selectTool}
                  onSelect={setSelected}
                />
              ) : (
              <>
              <div className="database-header">
                <div className="database-meta">
                  <div className="database-title-block">
                    <span>{currentDisplayView === "calendar" ? "月曆視圖" : viewLabel(activeView)}</span>
                    <b>{currentDisplayView === "calendar" ? "依觀看日期瀏覽" : `${total} 筆紀錄`}</b>
                  </div>
                  {currentDisplayView !== "calendar" && (
                    <div className="pagination-controls" aria-label="分頁">
                      <button disabled={filters.page <= 1} onClick={() => patchFilters({ page: filters.page - 1 })}>上一頁</button>
                      <span>{filters.page} / {pageCount}</span>
                      <button disabled={filters.page >= pageCount} onClick={() => patchFilters({ page: filters.page + 1 })}>下一頁</button>
                    </div>
                  )}
                </div>
                <div className="database-toolbar">
                  <div className="toolbar-control-row">
                    {!privateActive && (
                      <>
                        <div className="toolbar-cluster">
                          <span className="toolbar-label">視圖</span>
                          <div className="segmented-control view-segment" aria-label="視圖切換">
                            {displayViews.map((view) => (
                              <button key={view} className={displayView === view ? "active" : ""} onClick={() => selectDisplayView(view)}>
                                {viewLabel(view)}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="toolbar-cluster">
                          <span className="toolbar-label">狀態</span>
                          <div className="segmented-control status-segment" aria-label="快速狀態篩選">
                            {quickStatusViews.map((view) => (
                              <button key={view} className={isQuickStatusActive(view, activeView) ? "active" : ""} onClick={() => selectView(view)}>
                                {quickFilterLabel(view)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    <div className="toolbar-spacer" />
                    <div className="toolbar-actions">
                      {currentDisplayView !== "calendar" && (
                        <button className="filter-toggle column-toggle" onClick={() => setColumnManagerOpen(true)}><Columns3 size={16} />欄位</button>
                      )}
                      <button className="filter-toggle advanced-filter" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={16} />{privateActive ? "篩選" : "進階篩選"}</button>
                    </div>
                  </div>
                  <FilterChips filters={filters} activeView={activeView} onClear={resetFilters} />
                </div>
              </div>
              {currentDisplayView === "calendar" ? (
                <CalendarView
                  filters={filters}
                  includePrivate={includePrivate}
                  activeView={activeView}
                  activeCategory={activeCategory}
                  libraryTypes={libraryTypes}
                />
              ) : (
                <ItemList
                  items={visibleItems}
                  view={currentDisplayView}
                  columnScope={privateView && includePrivate ? PRIVATE_LIBRARY_LABEL : activeView}
                  columnManagerOpen={columnManagerOpen}
                  onColumnManagerClose={() => setColumnManagerOpen(false)}
                  privateMode={privateActive}
                  density={displayDensity}
                  loading={loading}
                  emptyMessage="還沒有紀錄，先從上方快速新增一筆就好。"
                  onSelect={setSelected}
                  onToggleFavorite={toggleFavorite}
                  onDelete={removeItem}
                  onMetadata={openMetadataLookup}
                  onQuickUpdate={quickUpdate}
                  onQuickCreate={quickCreateFromTable}
                  onBatchUpdate={batchUpdate}
                  onBatchDelete={batchDelete}
                />
              )}
              </>
              )}
            </>
          )}

          {tab === "organizer" && (
            <SmartOrganizer
              privateMode={organizerPrivateMode && !safeMode}
              onSelect={setSelected}
              onMetadata={openMetadataLookup}
              onChanged={refreshVisibleData}
            />
          )}
          {tab === "stats" && <StatsPanel includePrivate={false} />}
          {tab === "data" && <ImportExport safeMode={safeMode} onImported={refreshVisibleData} />}
          {tab === "quality" && privateActive && (
            <PrivateQualityCenter onOpenItem={(id) => {
              const item = items.find((entry) => entry.id === id);
              if (item) void openItemDetail(item);
              else void getItem(id).then(setSelected).catch((err) => setError(err instanceof Error ? err.message : "載入資料失敗"));
            }} />
          )}
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

      <FilterSheet open={filtersOpen} filters={filters} privateMode={privateActive} onChange={patchFilters} onClose={() => setFiltersOpen(false)} />

      {simpleAddOpen && (
        <SimpleAddModal
          privateMode={includePrivate}
          loading={loading}
          onClose={() => setSimpleAddOpen(false)}
          onSubmit={submitSimpleAdd}
        />
      )}
      {selected && <ItemEditor item={selected} privateMode={privateActive} onClose={() => setSelected(null)} onSave={saveItem} onDelete={removeItem} />}
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

function isWatchStatusView(view: string) {
  return ["plan_to_watch", "watching", "completed", "paused", "dropped", "rewatching"].includes(view);
}

function viewLabel(view: string) {
  const labels: Record<string, string> = {
    home: "首頁",
    inbox: "待整理",
    database: "資料庫",
    table: "表格",
    list: "清單",
    poster: "海報牆",
    calendar: "月曆",
    favorites: "收藏",
    plan_to_watch: "待觀看",
    watching: "觀看中",
    completed: "看完",
    paused: "暫停",
    dropped: "已放棄",
    rewatching: "重看中",
    organizer: "整理中心",
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
    completed: "看完",
    favorites: "收藏"
  };
  return labels[view] || view;
}

function PrivateWorkbench({
  filters,
  items,
  loading,
  pageCount,
  total,
  summary,
  onPatchFilters,
  onClearFilters,
  onOpenAdvanced,
  onAdd,
  onSelect,
  onQuickUpdate,
  onQuickCreate,
  onBatchUpdate,
  onBatchDelete
}: {
  filters: ListFilters;
  items: MediaItem[];
  loading: boolean;
  pageCount: number;
  total: number;
  summary: PrivateSummary | null;
  onPatchFilters: (patch: Partial<ListFilters>) => void;
  onClearFilters: () => void;
  onOpenAdvanced: () => void;
  onAdd: () => void;
  onSelect: (item: MediaItem) => void;
  onQuickUpdate: (item: MediaItem, patch: Partial<ItemInput>) => Promise<void>;
  onQuickCreate: (input: ItemInput) => Promise<void>;
  onBatchUpdate: (items: MediaItem[], patch: Partial<ItemInput> | ((item: MediaItem) => Partial<ItemInput>)) => Promise<void>;
  onBatchDelete: (items: MediaItem[]) => Promise<void>;
}) {
  const summaryTotal = summary?.total ?? total;
  const used = summary?.used ?? 0;
  const unused = summary?.unused ?? Math.max(0, summaryTotal - used);
  return (
    <section className="private-workbench">
      <header className="private-workbench-head">
        <div className="database-title-block">
          <span>私密</span>
          <b>{total} 筆符合目前條件</b>
        </div>
        <div className="private-summary-grid" aria-label="私密摘要">
          <Metric label="總筆數" value={summaryTotal.toString()} />
          <Metric label="已閱" value={used.toString()} />
          <Metric label="未閱" value={unused.toString()} />
          <Metric label="平均分" value={summary?.averageRating === null || summary?.averageRating === undefined ? "-" : summary.averageRating.toFixed(1)} />
        </div>
      </header>

      <div className="private-collection-strip" aria-label="收藏分布">
        {summary?.collectionCounts.length ? (
          summary.collectionCounts.map((entry) => (
            <button
              key={entry.level}
              className={filters.collectionLevel === entry.level ? "active" : ""}
              onClick={() => onPatchFilters({ collectionLevel: filters.collectionLevel === entry.level ? "" : entry.level })}
            >
              <span>{entry.level}</span>
              <b>{entry.count}</b>
            </button>
          ))
        ) : (
          <span>尚無收藏分布</span>
        )}
      </div>

      <div className="private-filter-bar" aria-label="私密篩選">
        <label className="private-search-field">
          <Search size={15} />
          <input value={filters.query} onChange={(event) => onPatchFilters({ query: event.target.value })} placeholder="搜尋番號、片名、女優、標籤" />
        </label>
        <label>
          分數
          <span className="range-fields">
            <input value={filters.ratingMin} onChange={(event) => onPatchFilters({ ratingMin: event.target.value })} inputMode="decimal" placeholder="0" />
            <input value={filters.ratingMax} onChange={(event) => onPatchFilters({ ratingMax: event.target.value })} inputMode="decimal" placeholder="10" />
          </span>
        </label>
        <label>
          閱覽狀態
          <select value={filters.usedFilter} onChange={(event) => onPatchFilters({ usedFilter: event.target.value as ListFilters["usedFilter"] })}>
            <option value="all">全部</option>
            <option value="used">已閱</option>
            <option value="unused">未閱</option>
          </select>
        </label>
        <label>
          收藏
          <select value={filters.collectionLevel} onChange={(event) => onPatchFilters({ collectionLevel: event.target.value })}>
            <option value="">全部</option>
            {collectionLevelOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <FieldFilter label="標籤" value={filters.tag} onChange={(value) => onPatchFilters({ tag: value })} />
        <FieldFilter label="女優" value={filters.person} onChange={(value) => onPatchFilters({ person: value })} />
        <FieldFilter label="片商" value={filters.studio} onChange={(value) => onPatchFilters({ studio: value })} />
        <FieldFilter label="年分" value={filters.year} inputMode="numeric" onChange={(value) => onPatchFilters({ year: value })} />
        <div className="private-filter-actions">
          <button className="filter-toggle advanced-filter" onClick={onOpenAdvanced}><SlidersHorizontal size={16} />進階</button>
          <button className="filter-chip-clear" onClick={onClearFilters} disabled={!hasPrivateFilters(filters)}>清除</button>
          <button className="primary" onClick={onAdd}><Plus size={16} />新增</button>
        </div>
      </div>

      <FilterChips filters={filters} activeView={PRIVATE_LIBRARY_LABEL} onClear={onClearFilters} />

      <div className="private-table-head">
        <span>{total} 筆結果</span>
        <div className="pagination-controls" aria-label="分頁">
          <button disabled={filters.page <= 1} onClick={() => onPatchFilters({ page: filters.page - 1 })}>上一頁</button>
          <span>{filters.page} / {pageCount}</span>
          <button disabled={filters.page >= pageCount} onClick={() => onPatchFilters({ page: filters.page + 1 })}>下一頁</button>
        </div>
      </div>

      <ItemList
        items={items}
        view="table"
        columnScope={PRIVATE_LIBRARY_LABEL}
        privateMode
        density="compact"
        loading={loading}
        emptyMessage="沒有符合條件的私密資料。"
        onSelect={onSelect}
        onQuickUpdate={onQuickUpdate}
        onQuickCreate={onQuickCreate}
        onBatchUpdate={onBatchUpdate}
        onBatchDelete={onBatchDelete}
      />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="private-metric">
      <b>{value}</b>
      <small>{label}</small>
    </span>
  );
}

function PrivateWorkbenchV2({
  filters,
  items,
  loading,
  pageCount,
  total,
  title,
  summary,
  view,
  onPatchFilters,
  onClearFilters,
  onOpenAdvanced,
  onView,
  onAdd,
  onSelect,
  onQuickUpdate,
  onQuickCreate,
  onBatchUpdate,
  onBatchDelete
}: {
  filters: ListFilters;
  items: MediaItem[];
  loading: boolean;
  pageCount: number;
  total: number;
  title: string;
  summary: PrivateSummary | null;
  view: PrivateDisplayView;
  onPatchFilters: (patch: Partial<ListFilters>) => void;
  onClearFilters: () => void;
  onOpenAdvanced: () => void;
  onView: (view: PrivateDisplayView) => void;
  onAdd: () => void;
  onSelect: (item: MediaItem) => void;
  onQuickUpdate: (item: MediaItem, patch: Partial<ItemInput>) => Promise<void>;
  onQuickCreate: (input: ItemInput) => Promise<void>;
  onBatchUpdate: (items: MediaItem[], patch: Partial<ItemInput> | ((item: MediaItem) => Partial<ItemInput>)) => Promise<void>;
  onBatchDelete: (items: MediaItem[]) => Promise<void>;
}) {
  const summaryTotal = summary?.total ?? total;
  const used = summary?.used ?? 0;
  const unused = summary?.unused ?? Math.max(0, summaryTotal - used);
  const averageRating = summary?.averageRating === null || summary?.averageRating === undefined ? "-" : summary.averageRating.toFixed(1);
  const quickFilters: Array<{ label: string; patch: Partial<ListFilters> }> = [
    { label: "9+", patch: { ratingMin: "9", ratingMax: "", favoriteLevel: "all", unrated: false } },
    { label: "已閱", patch: { usedFilter: "used" } },
    { label: "收藏", patch: { favoriteLevel: "收藏" } },
    { label: "雷片", patch: { favoriteLevel: "雷片" } },
    { label: "FC2", patch: { platform: "FC2" } },
    { label: "JAV", patch: { platform: "JAV" } },
    { label: "糖心", patch: { platform: "糖心" } },
    { label: "未評分", patch: { unrated: true, ratingMin: "", ratingMax: "" } }
  ];

  return (
    <section className="private-workbench private-workbench-compact">
      <div className="private-control-row" aria-label="私密資料控制列">
        <div className="private-current-count">
          <strong>{title}</strong>
          <span>目前 {total} 筆</span>
        </div>

        <details className="private-summary-details">
          <summary>摘要</summary>
          <div className="private-summary-inline" aria-label="私密摘要">
            <SummaryValue label="總數" value={summaryTotal.toString()} />
            <SummaryValue label="已閱" value={used.toString()} />
            <SummaryValue label="未閱" value={unused.toString()} />
            <SummaryValue label="平均分" value={averageRating} />
            <div className="private-collection-inline" aria-label="收藏分布">
              {summary?.collectionCounts.length ? (
                summary.collectionCounts.map((entry) => (
                  <button
                    key={entry.level}
                    className={filters.collectionLevel === entry.level ? "active" : ""}
                    onClick={() => onPatchFilters({ collectionLevel: filters.collectionLevel === entry.level ? "" : entry.level })}
                  >
                    <span>{entry.level}</span>
                    <b>{entry.count}</b>
                  </button>
                ))
              ) : (
                <span>沒有收藏分布</span>
              )}
            </div>
          </div>
        </details>

        <label className="private-search-field private-search-compact">
          <Search size={15} />
          <input value={filters.query} onChange={(event) => onPatchFilters({ query: event.target.value })} placeholder="搜尋標題、標籤、平台" />
        </label>

        <div className="private-filter-actions">
          <div className="segmented-control private-view-switch" aria-label="私密列表顯示模式">
            <button className={view === "list" ? "active" : ""} onClick={() => onView("list")}>卡片</button>
            <button className={view === "table" ? "active" : ""} onClick={() => onView("table")}>表格</button>
          </div>
          <button className="filter-toggle advanced-filter" onClick={onOpenAdvanced}><SlidersHorizontal size={16} />進階</button>
          <button className="filter-chip-clear" onClick={onClearFilters} disabled={!hasPrivateFilters(filters)}>清除</button>
          <button className="primary" onClick={onAdd}><Plus size={16} />新增</button>
        </div>

        <div className="pagination-controls private-pagination" aria-label="分頁">
          <button disabled={filters.page <= 1} onClick={() => onPatchFilters({ page: filters.page - 1 })}>上一頁</button>
          <span>{filters.page} / {pageCount}</span>
          <button disabled={filters.page >= pageCount} onClick={() => onPatchFilters({ page: filters.page + 1 })}>下一頁</button>
          <select value={filters.pageSize} onChange={(event) => onPatchFilters({ pageSize: Number(event.target.value), page: 1 })} aria-label="每頁筆數">
            {[50, 100, 200].map((size) => <option key={size} value={size}>{size} / 頁</option>)}
          </select>
        </div>
      </div>

      <div className="quick-filter-row private-quick-filters" aria-label="快捷篩選">
        {quickFilters.map((entry) => (
          <button key={entry.label} type="button" onClick={() => onPatchFilters(entry.patch)}>
            {entry.label}
          </button>
        ))}
      </div>

      <ItemList
        items={items}
        view={view}
        columnScope={PRIVATE_LIBRARY_LABEL}
        privateMode
        density="compact"
        loading={loading}
        emptyMessage="沒有符合條件的私密資料。"
        onSelect={onSelect}
        onQuickUpdate={onQuickUpdate}
        onQuickCreate={onQuickCreate}
        onBatchUpdate={onBatchUpdate}
        onBatchDelete={onBatchDelete}
      />
    </section>
  );
}

function PrivateWorkbenchV3({
  filters,
  items,
  loading,
  pageCount,
  total,
  error,
  onPatchFilters,
  onClearFilters,
  onRetry,
  onOpenAdvanced,
  onAdd,
  onSelect,
  onQuickUpdate,
  onApplyFilters
}: {
  filters: ListFilters;
  items: MediaItem[];
  loading: boolean;
  pageCount: number;
  total: number;
  error: string;
  onPatchFilters: (patch: Partial<ListFilters>) => void;
  onClearFilters: () => void;
  onRetry: () => void;
  onOpenAdvanced: () => void;
  onAdd: () => void;
  onSelect: (item: MediaItem) => void;
  onQuickUpdate: (item: MediaItem, field: "collection_level" | "rating" | "used", value: unknown) => Promise<void>;
  onApplyFilters: (filters: Partial<ListFilters>) => void;
}) {
  const [searchDraft, setSearchDraft] = useState(filters.query);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnPreferences, setColumnPreferences] = useState<PrivateTablePreferences>(() => readPrivateTablePreferences());
  const [savedViews, setSavedViews] = useState<SavedPrivateView<PrivateTablePreferences>[]>(() => readSavedViews<PrivateTablePreferences>());
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const [savedViewName, setSavedViewName] = useState("");
  const [activeSavedView, setActiveSavedView] = useState<string | null>(null);
  const [savedViewError, setSavedViewError] = useState("");
  const visibleColumns = useMemo(
    () => columnPreferences.order.filter((id) => columnPreferences.visible[id]).map((id) => privateColumnMap[id]),
    [columnPreferences]
  );

  useEffect(() => {
    setSearchDraft(filters.query);
  }, [filters.query]);

  useEffect(() => {
    if (searchDraft === filters.query) return;
    const id = window.setTimeout(() => onPatchFilters({ query: searchDraft, page: 1 }), 300);
    return () => window.clearTimeout(id);
  }, [filters.query, onPatchFilters, searchDraft]);

  useEffect(() => {
    savePrivateTablePreferences({ ...columnPreferences, pageSize: filters.pageSize });
  }, [columnPreferences, filters.pageSize]);

  function updatePageSize(pageSize: number) {
    setColumnPreferences((current) => normalizePrivateTablePreferences({ ...current, pageSize }));
    onPatchFilters({ pageSize, page: 1 });
  }

  function toggleColumn(id: PrivateColumnId) {
    if (privateColumnMap[id].required) return;
    setColumnPreferences((current) => normalizePrivateTablePreferences({
      ...current,
      visible: { ...current.visible, [id]: !current.visible[id] }
    }));
  }

  function resetColumns() {
    setColumnPreferences(defaultPrivateTablePreferences());
  }

  function persistViews(next: SavedPrivateView<PrivateTablePreferences>[]) {
    setSavedViews(next); writeSavedViews(next);
  }

  function addSavedView() {
    try {
      const view = createSavedView(savedViewName, filters, columnPreferences, savedViews);
      persistViews([...savedViews, view]); setSavedViewName(""); setActiveSavedView(view.id); setSavedViewError("");
    } catch (err) { setSavedViewError(err instanceof Error ? err.message : "無法儲存檢視"); }
  }

  function applySavedView(view: SavedPrivateView<PrivateTablePreferences>) {
    const preferences = normalizePrivateTablePreferences(view.tablePreferences);
    setColumnPreferences(preferences); onApplyFilters({ ...view.filters, page: 1, pageSize: preferences.pageSize }); setSearchDraft(String(view.filters.query || "")); setActiveSavedView(view.id); setSavedViewsOpen(false);
  }

  function updateSavedView(view: SavedPrivateView<PrivateTablePreferences>) {
    const now = new Date().toISOString();
    persistViews(savedViews.map((entry) => entry.id === view.id ? { ...entry, filters: { ...filters, page: 1 }, tablePreferences: columnPreferences, updatedAt: now } : entry));
    setActiveSavedView(view.id);
  }

  function renameSavedView(view: SavedPrivateView<PrivateTablePreferences>) {
    const name = window.prompt("新的檢視名稱", view.name)?.trim();
    if (!name || (savedViews.some((entry) => entry.id !== view.id && entry.name.toLocaleLowerCase() === name.toLocaleLowerCase()))) { if (name) setSavedViewError("已有同名檢視"); return; }
    persistViews(savedViews.map((entry) => entry.id === view.id ? { ...entry, name, updatedAt: new Date().toISOString() } : entry));
  }

  const activeView = savedViews.find((view) => view.id === activeSavedView);
  const savedViewDirty = activeView ? savedViewSignature(filters, columnPreferences) !== savedViewSignature(activeView.filters, activeView.tablePreferences) : false;

  return (
    <section className="private-workbench">
      <div className="private-toolbar">
        <label className="private-search-field">
          <Search size={16} />
          <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="搜尋作品代號、女優、平台、片商、標籤、心得" />
        </label>
        <div className="private-toolbar-actions">
          <button className="filter-toggle advanced-filter" onClick={onOpenAdvanced}><SlidersHorizontal size={16} />進階篩選</button>
          <button className="filter-chip-clear" onClick={onClearFilters} disabled={!hasPrivateFilters(filters)}>清除篩選</button>
          <div className="private-columns-menu">
            <button className="filter-toggle column-toggle" onClick={() => setColumnsOpen((value) => !value)}><Columns3 size={16} />欄位</button>
            {columnsOpen && (
              <div className="private-columns-popover" role="dialog" aria-label="欄位設定">
                <strong>欄位設定</strong>
                {privateColumnDefinitions.map((column) => (
                  <label key={column.id} className="private-column-option">
                    <input type="checkbox" checked={columnPreferences.visible[column.id]} disabled={column.required} onChange={() => toggleColumn(column.id)} />
                    <span>{column.label}</span>
                  </label>
                ))}
                <button className="filter-chip-clear" onClick={resetColumns}>重設欄位</button>
              </div>
            )}
          </div>
          <div className="private-columns-menu private-saved-views">
            <button className="filter-toggle" onClick={() => setSavedViewsOpen((value) => !value)} aria-haspopup="dialog" aria-expanded={savedViewsOpen}><Save size={16}/>{activeView ? `${activeView.name}${savedViewDirty ? " *" : ""}` : "儲存檢視"}</button>
            {savedViewsOpen && <div className="private-columns-popover private-saved-views-popover" role="dialog" aria-label="儲存檢視管理">
              <strong>{activeView ? `${activeView.name}${savedViewDirty ? "（已有未儲存變更）" : ""}` : "儲存目前檢視"}</strong>
              <div className="saved-view-create"><input value={savedViewName} onChange={(event) => setSavedViewName(event.target.value)} placeholder="檢視名稱"/><button onClick={addSavedView}>新增</button></div>
              {savedViewError && <em role="alert">{savedViewError}</em>}
              {savedViews.map((view) => <div className="saved-view-row" key={view.id}><button onClick={() => applySavedView(view)}>{view.name}</button><button title="覆蓋更新" onClick={() => updateSavedView(view)}>更新</button><button title="重新命名" onClick={() => renameSavedView(view)}>改名</button><button title="刪除" onClick={() => { if (window.confirm(`刪除檢視「${view.name}」？`)) { persistViews(savedViews.filter((entry) => entry.id !== view.id)); if (activeSavedView === view.id) setActiveSavedView(null); } }}>刪除</button></div>)}
            </div>}
          </div>
          <button className="primary" onClick={onAdd}><Plus size={16} />新增</button>
        </div>
        <div className="pagination-controls private-pagination">
          <button disabled={filters.page <= 1} onClick={() => onPatchFilters({ page: filters.page - 1 })}>上一頁</button>
          <span>{filters.page} / {pageCount}</span>
          <button disabled={filters.page >= pageCount} onClick={() => onPatchFilters({ page: filters.page + 1 })}>下一頁</button>
          <select value={filters.pageSize} onChange={(event) => updatePageSize(Number(event.target.value))} aria-label="每頁筆數">
            {[50, 100, 200].map((size) => <option key={size} value={size}>{size} / 頁</option>)}
          </select>
        </div>
      </div>

      <div className="private-list-region">
        {error ? (
          <PrivateErrorCard error={error} onRetry={onRetry} />
        ) : loading ? (
          <PrivateSkeleton />
        ) : items.length === 0 ? (
          <PrivateEmptyState onClear={onClearFilters} onAdd={onAdd} />
        ) : (
          <>
            <PrivateMobileCards items={items} onSelect={onSelect} />
            <PrivateDataTable
              items={items}
              columns={visibleColumns}
              preferences={columnPreferences}
              onPreferencesChange={setColumnPreferences}
              onSelect={onSelect}
              onQuickUpdate={onQuickUpdate}
            />
          </>
        )}
      </div>
    </section>
  );
}

function filterValues(value: string | undefined) {
  return (value || "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

function PrivateDataTable({
  items,
  columns,
  preferences,
  onPreferencesChange,
  onSelect,
  onQuickUpdate
}: {
  items: MediaItem[];
  columns: PrivateColumnDefinition[];
  preferences: PrivateTablePreferences;
  onPreferencesChange: (preferences: PrivateTablePreferences | ((current: PrivateTablePreferences) => PrivateTablePreferences)) => void;
  onSelect: (item: MediaItem) => void;
  onQuickUpdate: (item: MediaItem, field: "collection_level" | "rating" | "used", value: unknown) => Promise<void>;
}) {
  const [dragColumn, setDragColumn] = useState<PrivateColumnId | null>(null);
  const [editing, setEditing] = useState<{ itemId: string; column: "favorite" | "rating" } | null>(null);
  const [quickPending, setQuickPending] = useState<string | null>(null);
  const [quickError, setQuickError] = useState("");
  const quickTrigger = useRef<HTMLButtonElement | null>(null);
  const totalWidth = columns.reduce((sum, column) => sum + preferences.widths[column.id], 0);

  function updateWidth(column: PrivateColumnDefinition, width: number) {
    onPreferencesChange((current) => normalizePrivateTablePreferences({
      ...current,
      widths: { ...current.widths, [column.id]: Math.min(column.maxWidth, Math.max(column.minWidth, width)) }
    }));
  }

  function startResize(column: PrivateColumnDefinition, event: React.MouseEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = preferences.widths[column.id];
    const handleMove = (moveEvent: MouseEvent) => updateWidth(column, startWidth + moveEvent.clientX - startX);
    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  function autosize(column: PrivateColumnDefinition) {
    const width = Math.min(column.maxWidth, Math.max(column.minWidth, estimatePrivateColumnWidth(column.id, items)));
    updateWidth(column, width);
  }

  function moveColumn(target: PrivateColumnId) {
    if (!dragColumn || dragColumn === target) return;
    onPreferencesChange((current) => {
      const order = current.order.filter((id) => id !== dragColumn);
      const targetIndex = order.indexOf(target);
      order.splice(targetIndex < 0 ? order.length : targetIndex, 0, dragColumn);
      return normalizePrivateTablePreferences({ ...current, order });
    });
    setDragColumn(null);
  }

  useEffect(() => {
    if (!editing) return;
    const close = () => setEditing(null);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    const onPointer = (event: MouseEvent) => { if (!(event.target as HTMLElement).closest(".private-quick-editor,[data-quick-trigger]")) close(); };
    document.addEventListener("keydown", onKey); document.addEventListener("mousedown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onPointer); window.setTimeout(() => quickTrigger.current?.focus(), 0); };
  }, [editing]);

  async function commitQuick(item: MediaItem, field: "collection_level" | "rating" | "used", value: unknown) {
    const key = `${item.id}:${field}`; if (quickPending) return;
    setQuickPending(key); setQuickError("");
    try { await onQuickUpdate(item, field, value); setEditing(null); }
    catch (err) { setQuickError(err instanceof Error ? err.message : "快速更新失敗"); }
    finally { setQuickPending(null); }
  }

  return (
    <div className="private-data-table-wrap">
      <table className="private-data-table private-dense-table" style={{ "--private-table-width": `${Math.max(totalWidth, 760)}px` } as CSSProperties}>
        <colgroup>
          {columns.map((column) => <col key={column.id} style={{ width: preferences.widths[column.id] }} />)}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                className={column.id === "title" ? "private-sticky-column" : undefined}
                draggable
                onDragStart={() => setDragColumn(column.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => moveColumn(column.id)}
              >
                <span>{column.label}</span>
                <span className="private-column-resize" onMouseDown={(event) => startResize(column, event)} onDoubleClick={() => autosize(column)} title="拖曳調整寬度，雙擊自動寬度" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            return (
              <tr key={item.id} onClick={() => onSelect(item)}>
                {columns.map((column) => (
                  <td key={column.id} className={column.id === "title" ? "private-sticky-column" : undefined}>
                    <PrivateTableCell column={column.id} item={item} editing={editing?.itemId === item.id && editing.column === column.id} pending={quickPending === `${item.id}:${column.id === "favorite" ? "collection_level" : column.id}`} error={quickError} onOpen={(button) => { quickTrigger.current = button; setQuickError(""); setEditing({ itemId: item.id, column: column.id as "favorite" | "rating" }); }} onCommit={(field, value) => void commitQuick(item, field, value)} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PrivateTableCell({ column, item, editing, pending, error, onOpen, onCommit }: { column: PrivateColumnId; item: MediaItem; editing: boolean; pending: boolean; error: string; onOpen: (button: HTMLButtonElement) => void; onCommit: (field: "collection_level" | "rating" | "used", value: unknown) => void }) {
  const details = privateItemDetails(item);
  if (column === "title") {
    const titleText = privateDisplayTitle(details.title, details.code);
    const codeTitleText = titleText ? `${details.code} — ${titleText}` : details.code;
    return (
      <span className="private-title-code-cell" title={codeTitleText}>
        <span className="private-code-title-line">
          <strong>{details.code}</strong>
          {titleText && (
            <>
              <span className="private-title-separator">—</span>
              <span className="private-title-text">{titleText}</span>
            </>
          )}
        </span>
      </span>
    );
  }
  if (column === "rating") return <span className="private-quick-cell"><button data-quick-trigger aria-haspopup="menu" aria-expanded={editing} disabled={pending} onClick={(event) => { event.stopPropagation(); onOpen(event.currentTarget); }}><PrivateRating item={item} /></button>{editing && <PrivateQuickEditor error={error} options={[{ value: null, label: "未評分" }, ...Array.from({ length: 10 }, (_, index) => ({ value: index + 1, label: `${index + 1}.0` }))]} onSelect={(value) => onCommit("rating", value)} />}</span>;
  if (column === "favorite") return <span className="private-quick-cell"><button data-quick-trigger aria-haspopup="menu" aria-expanded={editing} disabled={pending} onClick={(event) => { event.stopPropagation(); onOpen(event.currentTarget); }}><PrivateFavoriteMark level={privateFavoriteLevel(item)} /></button>{editing && <PrivateQuickEditor error={error} options={collectionLevels.map((value) => ({ value, label: collectionLevelLabels[value] }))} onSelect={(value) => onCommit("collection_level", value)} />}</span>;
  if (column === "used") return <button className="private-used-quick" data-quick-trigger disabled={pending} aria-label={item.used ? "切換為未閱" : "切換為已閱"} onClick={(event) => { event.stopPropagation(); onCommit("used", !item.used); }}><PrivateUsedBadge used={item.used} /></button>;
  if (column === "actress") return <span className="private-ellipsis" title={details.performers}>{details.performers || "-"}</span>;
  if (column === "tags") return <PrivateTags tags={item.tags} />;
  if (column === "source") return <PrivateSource item={item} />;
  return <span className="private-summary-cell" title={item.quick_note || ""}>{item.quick_note || "-"}</span>;
}

function PrivateQuickEditor({ options, error, onSelect }: { options: Array<{ value: unknown; label: string }>; error: string; onSelect: (value: unknown) => void }) {
  return <div className="private-quick-editor" role="menu" onClick={(event) => event.stopPropagation()}>{options.map((option) => <button key={String(option.value)} role="menuitem" onClick={() => onSelect(option.value)}>{option.label}</button>)}{error && <em role="alert">{error}</em>}</div>;
}

function estimatePrivateColumnWidth(column: PrivateColumnId, items: MediaItem[]) {
  const sample = items.slice(0, 100).map((item) => {
    const details = privateItemDetails(item);
    if (column === "title") return privateDisplayTitle(details.title, details.code) ? `${details.code} — ${privateDisplayTitle(details.title, details.code)}` : details.code;
    if (column === "rating") return item.rating ? Number(item.rating).toFixed(1) : "-";
    if (column === "favorite") return privateFavoriteLevel(item);
    if (column === "used") return item.used ? "✓" : "-";
    if (column === "actress") return details.performers || "-";
    if (column === "tags") return item.tags.join(" ");
    if (column === "source") return privateSourceLabel(item) || "-";
    return item.quick_note || "-";
  });
  const maxLength = Math.max(privateColumnMap[column].label.length, ...sample.map((value) => value.length));
  return maxLength * 8 + 34;
}

function PrivateMobileCards({ items, onSelect }: { items: MediaItem[]; onSelect: (item: MediaItem) => void }) {
  return (
    <div className="private-mobile-list">
      {items.map((item) => <PrivateMobileCard key={item.id} item={item} onSelect={onSelect} />)}
    </div>
  );
}

function PrivateCardList({ items, onSelect }: { items: MediaItem[]; onSelect: (item: MediaItem) => void }) {
  return (
    <div className="private-card-list">
      {items.map((item) => <PrivateMobileCard key={item.id} item={item} onSelect={onSelect} desktop />)}
    </div>
  );
}

function PrivateMobileCard({ item, onSelect, desktop = false }: { item: MediaItem; onSelect: (item: MediaItem) => void; desktop?: boolean }) {
  const details = privateItemDetails(item);
  return (
    <article className={desktop ? "private-mobile-card private-desktop-card" : "private-mobile-card"} onClick={() => onSelect(item)}>
      <div className="private-card-head">
        <strong>{details.code}</strong>
        <PrivateRating item={item} />
      </div>
      <div className="private-card-badges">
        <PrivateBadge tone="favorite">{privateFavoriteLevel(item)}</PrivateBadge>
        <PrivateUsedBadge used={item.used} />
        <PrivateBadge tone="status">{item.media_status || item.status}</PrivateBadge>
      </div>
      <p>{item.platform || "-"} / {item.maker || details.studio}</p>
      <p>{details.performers}</p>
      {item.quick_note && <p className="private-card-note">{item.quick_note}</p>}
      <div className="private-card-bottom">
        <PrivateTags tags={item.tags} />
      </div>
    </article>
  );
}

function PrivateRating({ item }: { item: MediaItem }) {
  if (!item.rating) return <span className="private-muted-cell">-</span>;
  return <span className="private-rating"><Star size={14} fill="currentColor" />{Number(item.rating).toFixed(1)}</span>;
}

function PrivateUsedBadge({ used }: { used: boolean }) {
  return (
    <span className={used ? "private-used-icon used" : "private-used-icon"} title={used ? "已閱" : "未閱"} aria-label={used ? "已閱" : "未閱"}>
      {used ? <Check size={14} strokeWidth={3} /> : <span aria-hidden="true">-</span>}
    </span>
  );
}

function PrivateFavoriteMark({ level }: { level: string }) {
  const normalized = level === "已刪" || level === "已刪除" || level === "淘汰" ? "淘汰" : level;
  if (normalized === "未分類") return <span className="private-favorite-unset" aria-label="收藏：未分類">—</span>;
  const icon = normalized === "神作"
    ? <Star size={14} fill="currentColor" />
    : normalized === "淘汰" || normalized === "雷片"
      ? <CircleSlash2 size={14} />
      : <Bookmark size={14} />;
  return (
    <span className={`private-favorite-mark ${privateBadgeClass(normalized)}`} title={`收藏：${normalized}`} aria-label={`收藏：${normalized}`}>
      {icon}<span>{normalized}</span>
    </span>
  );
}

function PrivateSource({ item }: { item: MediaItem }) {
  const source = privateSourceLabel(item);
  if (!source) return <span className="private-muted-cell">—</span>;
  return <PrivateBadge tone="platform">{source}</PrivateBadge>;
}

function PrivateBadge({ tone, children }: { tone: "platform" | "favorite" | "status"; children: string }) {
  return <span className={`private-badge ${tone} ${privateBadgeClass(children)}`}>{children || "-"}</span>;
}

function privateBadgeClass(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function PrivateTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="private-muted-cell">-</span>;
  return (
    <span className="private-tags">
      {tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}
      {tags.length > 3 && <span>+{tags.length - 3}</span>}
    </span>
  );
}

function PrivateSkeleton() {
  return (
    <div className="private-skeleton" aria-label="載入中">
      {Array.from({ length: 8 }).map((_, index) => <span key={index} />)}
    </div>
  );
}

function PrivateErrorCard({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="private-error-card">
      <strong>私密資料載入失敗</strong>
      <p>{error}</p>
      <button onClick={onRetry}>重新載入</button>
    </div>
  );
}

function PrivateEmptyState({ onClear, onAdd }: { onClear: () => void; onAdd: () => void }) {
  return (
    <div className="private-empty-state">
      <strong>目前沒有符合條件的私密資料</strong>
      <p>可以清除篩選回到全部私密資料，或新增一筆紀錄。</p>
      <div>
        <button onClick={onClear}>清除篩選</button>
        <button className="primary" onClick={onAdd}>新增一筆</button>
      </div>
    </div>
  );
}

function privateFavoriteLevel(item: MediaItem) {
  return collectionLevelLabels[normalizeCollectionLevel(item.collection_level ?? item.favorite_level)];
}

function privateDisplayTitle(title: string, code: string) {
  const normalized = title.trim();
  if (!normalized || normalized === "-" || normalized === "—" || normalized === code) return "";
  return normalized;
}

function privateSourceLabel(item: MediaItem) {
  const platform = (item.platform || "").trim();
  const maker = (item.maker || "").trim();
  if (platform && maker && platform.toLowerCase() !== maker.toLowerCase()) return `${platform} / ${maker}`;
  return platform || maker;
}

function privateFilterSummary(filters: ListFilters) {
  const parts = ["全部"];
  if (filters.platformFilters) parts.push(`平台 ${filterValues(filters.platformFilters).join("、")}`);
  if (filters.platform) parts.push(filters.platform);
  if (filters.favoriteLevelFilters) parts.push(`收藏 ${filterValues(filters.favoriteLevelFilters).join("、")}`);
  if (filters.favoriteLevel && filters.favoriteLevel !== "all") parts.push(filters.favoriteLevel);
  if (filters.personFilters) parts.push(`女優 ${filterValues(filters.personFilters).join("、")}`);
  if (filters.usedFilter === "used") parts.push("已閱");
  if (filters.usedFilter === "unused") parts.push("未閱");
  if (filters.mediaStatus && filters.mediaStatus !== "all") parts.push(filters.mediaStatus);
  if (filters.tag) parts.push(`#${filters.tag}`);
  if (filters.query) parts.push(`搜尋：${filters.query}`);
  return parts.join(" / ");
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <span className="private-summary-value">
      <small>{label}</small>
      <b>{value}</b>
    </span>
  );
}

function FieldFilter({ label, value, inputMode, onChange }: { label: string; value: string; inputMode?: "numeric" | "decimal"; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} inputMode={inputMode} />
    </label>
  );
}

function hasPrivateFilters(filters: ListFilters) {
  return Boolean(
    filters.query.trim() ||
    filters.ratingMin.trim() ||
    filters.ratingMax.trim() ||
    filters.unrated ||
    filters.usedFilter !== "all" ||
    filters.collectionLevel.trim() ||
    filters.favoriteLevel !== "all" ||
    filters.platformFilters?.trim() ||
    filters.makerFilters?.trim() ||
    filters.favoriteLevelFilters?.trim() ||
    filters.personFilters?.trim() ||
    filters.missingPeople ||
    (filters.hasNote && filters.hasNote !== "all") ||
    (filters.hasCover && filters.hasCover !== "all") ||
    filters.mediaStatus !== "all" ||
    filters.tag.trim() ||
    filters.platform.trim() ||
    filters.maker.trim() ||
    filters.series.trim() ||
    filters.person.trim() ||
    filters.studio.trim() ||
    filters.year.trim() ||
    filters.codeQuery.trim() ||
    filters.titleQuery.trim()
  );
}

function isPrivateWorkspaceView(view: string) {
  return isPrivateLibraryLabel(view) || view === PRIVATE_RECOMMENDED_LABEL;
}

function withPrivatePageDefaults(input: ItemInput, recommendedActive: boolean): ItemInput {
  if (!recommendedActive || !input.is_private) return input;
  return {
    ...input,
    tags: Array.from(new Set([...(input.tags || []), PRIVATE_RECOMMENDED_TAG]))
  };
}

function FilterChips({ filters, activeView, onClear }: { filters: ListFilters; activeView: string; onClear: () => void }) {
  const chips = activeFilterChips(filters, activeView);
  if (chips.length === 0) return null;
  return (
    <div className="filter-chip-row" aria-label="目前篩選條件">
      {chips.map((chip) => <span className="filter-chip" key={chip}>{chip}</span>)}
      <button className="filter-chip-clear" onClick={onClear}>清除篩選</button>
    </div>
  );
}

function activeFilterChips(filters: ListFilters, activeView: string) {
  const chips: string[] = [];
  if (filters.query.trim()) chips.push(`搜尋：${filters.query.trim()}`);
  if (activeView !== "database" && activeView !== "home" && activeView !== PRIVATE_LIBRARY_LABEL) chips.push(`檢視：${viewLabel(activeView)}`);
  if (filters.status !== "all") chips.push(`整理：${viewLabel(filters.status)}`);
  if (filters.watchStatus && filters.watchStatus !== "all") chips.push(`觀看：${viewLabel(filters.watchStatus)}`);
  if (filters.favorite) chips.push("收藏");
  if (filters.highRated) chips.push("高分");
  if (filters.ratingMin || filters.ratingMax) chips.push(`評分：${filters.ratingMin || "不限"} ~ ${filters.ratingMax || "不限"}`);
  if (filters.unrated) chips.push("尚未評分");
  if (filters.usedFilter === "used") chips.push("已閱");
  if (filters.usedFilter === "unused") chips.push("未閱");
  if (filters.favoriteLevel && filters.favoriteLevel !== "all") chips.push(`收藏等級：${filters.favoriteLevel}`);
  if (filters.favoriteLevelFilters?.trim()) chips.push(`收藏：${filterValues(filters.favoriteLevelFilters).join("、")}`);
  if (filters.mediaStatus && filters.mediaStatus !== "all") chips.push(`狀態：${filters.mediaStatus}`);
  if (filters.collectionLevel.trim()) chips.push(`收藏：${filters.collectionLevel.trim()}`);
  if (filters.type.trim()) chips.push(`類型：${filters.type.trim()}`);
  if ((filters.category || "").trim()) chips.push(`分類：${(filters.category || "").trim()}`);
  if (filters.tag.trim()) chips.push(`#${filters.tag.trim()}`);
  if (filters.platform.trim()) chips.push(`平台：${filters.platform.trim()}`);
  if (filters.platformFilters?.trim()) chips.push(`平台：${filterValues(filters.platformFilters).join("、")}`);
  if (filters.maker.trim()) chips.push(`片商：${filters.maker.trim()}`);
  if (filters.makerFilters?.trim()) chips.push(`片商：${filterValues(filters.makerFilters).join("、")}`);
  if (filters.series.trim()) chips.push(`系列：${filters.series.trim()}`);
  if (filters.year.trim()) chips.push(`年份：${filters.year.trim()}`);
  if (filters.codeQuery.trim()) chips.push(`番號：${filters.codeQuery.trim()}`);
  if (filters.titleQuery.trim()) chips.push(`片名：${filters.titleQuery.trim()}`);
  if (filters.person.trim()) chips.push(`人物：${filters.person.trim()}`);
  if (filters.personFilters?.trim()) chips.push(`女優：${filterValues(filters.personFilters).join("、")}`);
  if (filters.missingPeople) chips.push("未填女優");
  if (filters.studio.trim()) chips.push(`片商：${filters.studio.trim()}`);
  if (filters.hasNote === "yes") chips.push("有心得");
  if (filters.hasNote === "no") chips.push("無心得");
  if (filters.hasCover === "yes") chips.push("有封面");
  if (filters.hasCover === "no") chips.push("無封面");
  if (filters.watchedFrom || filters.watchedTo) chips.push(`觀看日：${filters.watchedFrom || "不限"} ~ ${filters.watchedTo || "不限"}`);
  if (filters.updatedFrom || filters.updatedTo) chips.push(`更新日：${filters.updatedFrom || "不限"} ~ ${filters.updatedTo || "不限"}`);
  return chips;
}

function densityLabel(density: string) {
  const labels: Record<string, string> = {
    comfortable: "舒適",
    standard: "標準",
    compact: "緊湊"
  };
  return labels[density] || density;
}

function SimpleAddModal({
  privateMode,
  loading,
  onClose,
  onSubmit
}: {
  privateMode: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: ItemInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    code: "",
    title: "",
    rating: "",
    tags: "",
    watched_at: todayDate()
  });
  const canSubmit = privateMode ? Boolean(draft.code.trim() || draft.title.trim()) : Boolean(draft.title.trim());

  function patch(patch: Partial<typeof draft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function submit() {
    if (!canSubmit) return;
    void onSubmit(simpleDraftToInput(draft, privateMode));
  }

  function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div className="simple-add-backdrop" onClick={handleBackdropClick}>
      <section className="simple-add-modal" role="dialog" aria-modal="true" aria-label={privateMode ? "簡單新增私密紀錄" : "簡單新增紀錄"}>
        <header className="simple-add-head">
          <div>
            <p className="eyebrow">簡單新增</p>
            <h2>{privateMode ? "私密核心欄位" : "核心欄位"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="關閉">×</button>
        </header>
        <div className="simple-add-grid">
          {privateMode && <Field label="番號" value={draft.code} onChange={(value) => patch({ code: value })} />}
          <Field label={privateMode ? "片名" : "標題"} value={draft.title} onChange={(value) => patch({ title: value })} required={!privateMode} />
          <Field label="評分" value={draft.rating} onChange={(value) => patch({ rating: value })} inputMode="decimal" />
          <Field label="標籤" value={draft.tags} onChange={(value) => patch({ tags: value })} />
          <Field label="觀看日" value={draft.watched_at} onChange={(value) => patch({ watched_at: value })} type="date" />
        </div>
        <footer className="simple-add-actions">
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={submit} disabled={loading || !canSubmit}>新增</button>
        </footer>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  inputMode
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <label>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} required={required} type={type} inputMode={inputMode} />
    </label>
  );
}

function simpleDraftToInput(draft: { code: string; title: string; rating: string; tags: string; watched_at: string }, privateMode: boolean): ItemInput {
  const code = draft.code.trim();
  const title = draft.title.trim();
  const tags = splitTags(draft.tags);
  const rating = numberOrNull(draft.rating);
  if (privateMode) {
    return {
      raw_title: title || code,
      official_title: title || null,
      code: code || null,
      type: PRIVATE_LIBRARY_LABEL,
      is_private: true,
      watched_at: draft.watched_at || null,
      rating,
      favorite_level: rating !== null && rating >= 9 ? "神作" : "一般",
      collection_level: "unset",
      media_status: "已觀看",
      tags,
      metadata_json: JSON.stringify({
        ...(code ? { code } : {}),
        ...(title ? { title } : {})
      }),
      status: "raw"
    };
  }
  return {
    raw_title: title,
    watched_at: draft.watched_at || null,
    rating,
    tags,
    status: "raw"
  };
}

function todayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
    maker: null,
    series: null,
    release_year: null,
    year: null,
    watched_at: null,
    started_at: null,
    completed_at: null,
    planned_at: null,
    rating: null,
    rewatch_score: null,
    favorite: false,
    favorite_level: "一般",
    collection_level: "unset",
    normalized_code: null,
    used: false,
    is_private: false,
    status: "raw",
    media_status: "待觀看",
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
