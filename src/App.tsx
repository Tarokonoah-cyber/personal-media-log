import { Bookmark, Check, CircleSlash2, Columns3, Home, Menu, Moon, Plus, Save, Search, SlidersHorizontal, Star, Sun, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowUp, ChevronDown, CircleAlert, Pencil, X } from "lucide-react";
import { FilterSheet } from "./components/FilterSheet";
import { HomeDashboard } from "./components/HomeDashboard";
import { ImportExport } from "./components/ImportExport";
import { ItemEditor } from "./components/ItemEditor";
import { ItemList } from "./components/ItemList";
import { CalendarView } from "./components/CalendarView";
import { MetadataLookupModal } from "./components/MetadataLookupModal";
import { PrivateBatchToolbar } from "./components/PrivateBatchToolbar";
import { PrivateFilterChips } from "./components/PrivateFilterChips";
import { PrivateStarDisplay, PrivateStarRating } from "./components/PrivateStarRating";
import { QuickCapture } from "./components/QuickCapture";
import { SmartOrganizer } from "./components/SmartOrganizer";
import { StatsPanel } from "./components/StatsPanel";
import { TagEditor } from "./components/TagEditor";
import { Toast } from "./components/Toast";
import { ViewSidebar } from "./components/ViewSidebar";
import { PrivateQualityCenter } from "./components/PrivateQualityCenter";
import { applyMetadata, createItem, deleteItem, getItem, getPrivateFacets, listItems, listPrivateItems, parseSmartAdd, quickUpdateItem as quickUpdateItemApi, searchMetadata, updateItem } from "./lib/api";
import { privateBatchTagPatch, retainVisibleSelection, runLimitedBatch, togglePageItemSelection, togglePageSelection, type BatchOperationResult } from "./lib/privateBatch";
import { mergePrivateFilters } from "./lib/privateFilters";
import { PRIVATE_DEFAULT_ACTRESS, isPrivateCollectionLevel, privateCollectionLevel, privateCollectionLevelLabels, privateCollectionLevels, privateCollectionPatch, privateRatingFromStars, privateStarsFromRating, type PrivateCollectionLevel } from "../shared/privateModel";
import { createSavedView, readSavedViews, savedViewSignature, writeSavedViews, type SavedPrivateView } from "./lib/savedViews";
import { toItemInput } from "./lib/itemTransforms";
import { emptyPrivateRowDraft, privateCellPatch, privateCellValue, privateIdentityLabel, privateIdentityPatch, privateIdentityValue, privateRowDraftToInput, type PrivateEditableColumn, type PrivateIdentityDraft, type PrivateRowDraft } from "./lib/privateSpreadsheet";
import { movePrivateCell, privateCellKey, privateClipboardUpdate, privateClipboardValue, type PrivateCellMovement, type PrivateCellPosition } from "./lib/privateSpreadsheetKeyboard";
import { isPrivateStatus, privateStatusToFields } from "./lib/privateStatus";
import {
  clearPrivateSimpleAddDraft,
  emptyPrivateSimpleAddDraft,
  hasMeaningfulPrivateDraft,
  readPrivateSimpleAddDraft,
  savePrivateSimpleAddDraft,
  type PrivateSimpleAddDraft
} from "./lib/privateSimpleAddDraft";
import {
  popPrivateSimpleAddHistoryEntry,
  pushPrivateSimpleAddHistoryEntry,
  removeStalePrivateSimpleAddHistoryEntry
} from "./lib/privateSimpleAddHistory";
import { defaultPrivateTablePreferences, normalizePrivateTablePreferences, privateColumnDefinitions, privateColumnMap, readPrivateTablePreferences, savePrivateTablePreferences, type PrivateColumnDefinition, type PrivateColumnId, type PrivateTablePreferences } from "./lib/privateTablePreferences";
import { isPrivateItem, isPrivateLibraryLabel, privateItemDetails, PRIVATE_LIBRARY_LABEL, PRIVATE_RECOMMENDED_LABEL, PRIVATE_RECOMMENDED_TAG } from "./lib/privacy";
import { parseQuickEntry } from "./lib/quickParse";
import { collectionLevelOptions } from "./lib/reflection";
import { tagPresetsForScope } from "./lib/tagPresets";
import { addTags, normalizeTags, parseTagInput } from "./lib/tags";
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
  privateStatus: "all",
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
  sort: "",
  order: "",
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
  const [actionLoading, setActionLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const loadRequestId = useRef(0);
  const loadScopeRef = useRef("");
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
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const privateView = isPrivateWorkspaceView(activeView);
  const includePrivate = privateView && !safeMode;
  const privateActive = privateView && includePrivate;
  const privateRecommendedActive = activeView === PRIVATE_RECOMMENDED_LABEL && includePrivate;
  const privatePageTitle = privateRecommendedActive ? PRIVATE_RECOMMENDED_LABEL : "私密工作台";
  const currentDisplayView = privateActive ? "table" : displayView;
  const effectiveSidebarCollapsed = privateActive ? privateSidebarCollapsed : sidebarCollapsed;
  const loading = initialLoading || refreshing || actionLoading;

  useEffect(() => {
    removeStalePrivateSimpleAddHistoryEntry();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

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
  const publicTagSuggestions = useMemo(() => normalizeTags([...tagPresetsForScope("public"), ...knownTags]).sort((a, b) => a.localeCompare(b, "zh-Hant")), [knownTags]);
  const privateTagSuggestions = useMemo(() => {
    const privateFacetTags = (privateFacets?.tags || []).flatMap((tag) => Array.from({ length: Math.max(1, Math.min(10, tag.count)) }, () => tag.value));
    return normalizeTags([
      ...privateFacetTags,
      ...items.filter(isPrivateItem).flatMap((item) => item.tags),
      ...tagPresetsForScope("private")
    ]).slice(0, 20);
  }, [items, privateFacets?.tags]);
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
    privateStatus: filters.privateStatus,
    mediaStatus: filters.mediaStatus,
    tag: filters.tag,
    hasNote: filters.hasNote,
    hasCover: filters.hasCover,
    page: 1,
    pageSize: 1
  }), [filters.query, filters.platformFilters, filters.makerFilters, filters.favoriteLevelFilters, filters.personFilters, filters.missingPeople, filters.ratingMin, filters.ratingMax, filters.unrated, filters.usedFilter, filters.privateStatus, filters.mediaStatus, filters.tag, filters.hasNote, filters.hasCover]);

  async function loadItems() {
    const requestId = ++loadRequestId.current;
    const loadScope = includePrivate ? "private" : "public";
    const scopeChanged = loadScopeRef.current !== loadScope;
    const hasExistingRows = loadScopeRef.current === loadScope && items.length > 0;
    if (scopeChanged) {
      setItems([]);
      setTotal(0);
      setPrivateSummary(null);
    }
    setInitialLoading(scopeChanged || !hasExistingRows);
    setRefreshing(hasExistingRows);
    setError("");
    try {
      const result = includePrivate
        ? await listPrivateItems({ ...filters, includeFacets: false })
        : await listItems({ ...filters, includePrivate: false, privateOnly: false, includeFacets: false });
      if (requestId !== loadRequestId.current) return;
      setItems(result.items);
      setTotal(result.total);
      setPrivateSummary(result.privateSummary || null);
      loadScopeRef.current = loadScope;
    } catch (err) {
      if (requestId !== loadRequestId.current) return;
      setError(err instanceof Error ? err.message : "讀取紀錄失敗");
    } finally {
      if (requestId === loadRequestId.current) {
        setInitialLoading(false);
        setRefreshing(false);
      }
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
    setActionLoading(true);
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
      setActionLoading(false);
    }
  }

  async function submitSimpleAdd(input: ItemInput) {
    setActionLoading(true);
    setError("");
    try {
      const nextInput = withPrivatePageDefaults(input, privateRecommendedActive);
      await createItem(nextInput);
      setToast(nextInput.is_private ? "已新增私密紀錄" : "已新增紀錄");
      setTab("log");
      if (nextInput.is_private && !privateRecommendedActive) setActiveView(PRIVATE_LIBRARY_LABEL);
      setActiveCategory("");
      setFilters((current) => ({ ...current, status: "all", page: 1 }));
      try {
        await refreshVisibleData();
      } catch {
        setError("資料已新增，但列表重新整理失敗，請稍後重新整理頁面。");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "新增紀錄失敗";
      setError(message);
      throw new Error(message);
    } finally {
      setActionLoading(false);
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
    setActionLoading(true);
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
      setActionLoading(false);
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

  async function quickPrivateUpdate(item: MediaItem, field: "collection_level" | "rating" | "used" | "private_status", value: unknown) {
    const previous = item;
    const optimistic = field === "private_status" && isPrivateStatus(value)
      ? { ...item, ...privateStatusToFields(value) }
      : field === "collection_level" && isPrivateCollectionLevel(value)
        ? { ...item, ...privateCollectionPatch(value) }
      : { ...item, [field]: value } as MediaItem;
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

  async function batchUpdate(targets: MediaItem[], patch: Partial<ItemInput> | ((item: MediaItem) => Partial<ItemInput>)): Promise<BatchOperationResult> {
    if (targets.length === 0) return { succeededIds: [], failedIds: [] };
    setActionLoading(true);
    try {
      const result = await runLimitedBatch(targets, (item) => updateItem(item.id, { ...toItemInput(item), ...(typeof patch === "function" ? patch(item) : patch) }), 5);
      if (result.failedIds.length > 0) setError(`批次更新：成功 ${result.succeededIds.length} 筆，失敗 ${result.failedIds.length} 筆`);
      else setToast(`已更新 ${result.succeededIds.length} 筆`);
      await refreshVisibleData();
      return result;
    } finally {
      setActionLoading(false);
    }
  }

  async function batchDelete(targets: MediaItem[]): Promise<BatchOperationResult> {
    if (targets.length === 0) return { succeededIds: [], failedIds: [] };
    if (!window.confirm(`確定要刪除 ${targets.length} 筆紀錄嗎？`)) return { succeededIds: [], failedIds: targets.map((item) => item.id), cancelled: true };
    setActionLoading(true);
    try {
      const result = await runLimitedBatch(targets, (item) => deleteItem(item.id), 5);
      if (result.succeededIds.length > 0) {
        setSelected(null);
      }
      if (result.failedIds.length > 0) setError(`批次刪除：成功 ${result.succeededIds.length} 筆，失敗 ${result.failedIds.length} 筆`);
      else setToast(`已刪除 ${result.succeededIds.length} 筆`);
      await refreshVisibleData();
      return result;
    } finally {
      setActionLoading(false);
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
    <div className={privateActive ? "app-shell private-app-shell" : "app-shell"}>
      <header className={privateActive ? "topbar private-shell-topbar" : "topbar"}>
        <button className="icon-button mobile-sidebar-button" onClick={() => setSidebarOpen(true)} title="開啟導覽" aria-label="開啟導覽" aria-expanded={sidebarOpen} aria-controls="private-sidebar"><Menu size={18} /></button>
        {privateActive ? (
          <div className="private-shell-main">
            <button className="icon-button private-return-home" onClick={returnHome} title="返回首頁" aria-label="返回首頁">
              <Home size={16} />
            </button>
            <div className="private-shell-title">
              <strong>{privatePageTitle}</strong>
              <span>{privateRecommendedActive ? "網友推薦" : `${privateSummary?.total ?? total} 筆作品`}</span>
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
        <button className="icon-button private-theme-toggle" onClick={() => setDark((value) => !value)} title={dark ? "切換淺色模式" : "切換深色模式"} aria-label={dark ? "切換淺色模式" : "切換深色模式"}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {error && !privateActive && <div className="notice danger">{error}</div>}
      {smartPreview && smartDraft && (
        <SmartAddPreview
          preview={smartPreview}
          draft={smartDraft}
          knownTags={privateActive ? privateTagSuggestions : publicTagSuggestions}
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
          {privateActive && !online && <div className="pwa-offline-banner" role="status">目前離線，可瀏覽已開啟內容；重新連線後再新增或修改資料。</div>}
          {tab === "log" && (
            <>
              {privateActive ? (
                <PrivateWorkbenchV3
                  filters={filters}
                  items={visibleItems}
                  loading={initialLoading}
                  refreshing={refreshing}
                  pageCount={pageCount}
                  total={total}
                  error={error}
                  batchBusy={actionLoading}
                  knownTags={privateTagSuggestions}
                  onPatchFilters={patchFilters}
                  onClearFilters={resetFilters}
                  onRetry={() => void loadItems()}
                  onOpenAdvanced={() => setFiltersOpen(true)}
                  onOpenSimpleAdd={() => setSimpleAddOpen(true)}
                  onCreate={quickCreateFromTable}
                  onSelect={(item) => void openItemDetail(item)}
                  onCellUpdate={quickUpdate}
                  onQuickUpdate={quickPrivateUpdate}
                  onBatchUpdate={batchUpdate}
                  onBatchDelete={batchDelete}
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
          knownTags={includePrivate ? privateTagSuggestions : publicTagSuggestions}
          loading={loading}
          onClose={() => setSimpleAddOpen(false)}
          onSubmit={submitSimpleAdd}
        />
      )}
      {selected && <ItemEditor item={selected} privateMode={privateActive} knownTags={privateActive || isPrivateItem(selected) ? privateTagSuggestions : publicTagSuggestions} onClose={() => setSelected(null)} onSave={saveItem} onDelete={removeItem} />}
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
  onBatchUpdate: (items: MediaItem[], patch: Partial<ItemInput> | ((item: MediaItem) => Partial<ItemInput>)) => Promise<unknown>;
  onBatchDelete: (items: MediaItem[]) => Promise<unknown>;
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
          <Metric label="完成" value={used.toString()} />
          <Metric label="待處理" value={unused.toString()} />
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
          狀態
          <select value={filters.usedFilter} onChange={(event) => onPatchFilters({ usedFilter: event.target.value as ListFilters["usedFilter"] })}>
            <option value="all">全部</option>
            <option value="used">完成</option>
            <option value="unused">待處理</option>
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
  onBatchUpdate: (items: MediaItem[], patch: Partial<ItemInput> | ((item: MediaItem) => Partial<ItemInput>)) => Promise<unknown>;
  onBatchDelete: (items: MediaItem[]) => Promise<unknown>;
}) {
  const summaryTotal = summary?.total ?? total;
  const used = summary?.used ?? 0;
  const unused = summary?.unused ?? Math.max(0, summaryTotal - used);
  const averageRating = summary?.averageRating === null || summary?.averageRating === undefined ? "-" : summary.averageRating.toFixed(1);
  const quickFilters: Array<{ label: string; patch: Partial<ListFilters> }> = [
    { label: "9+", patch: { ratingMin: "9", ratingMax: "", favoriteLevel: "all", unrated: false } },
    { label: "完成", patch: { usedFilter: "used" } },
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
            <SummaryValue label="完成" value={used.toString()} />
            <SummaryValue label="待處理" value={unused.toString()} />
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
  refreshing,
  pageCount,
  total,
  error,
  batchBusy,
  knownTags,
  onPatchFilters,
  onClearFilters,
  onRetry,
  onOpenAdvanced,
  onOpenSimpleAdd,
  onCreate,
  onSelect,
  onCellUpdate,
  onQuickUpdate,
  onBatchUpdate,
  onBatchDelete,
  onApplyFilters
}: {
  filters: ListFilters;
  items: MediaItem[];
  loading: boolean;
  refreshing: boolean;
  pageCount: number;
  total: number;
  error: string;
  batchBusy: boolean;
  knownTags: string[];
  onPatchFilters: (patch: Partial<ListFilters>) => void;
  onClearFilters: () => void;
  onRetry: () => void;
  onOpenAdvanced: () => void;
  onOpenSimpleAdd: () => void;
  onCreate: (input: ItemInput) => Promise<void>;
  onSelect: (item: MediaItem) => void;
  onCellUpdate: (item: MediaItem, patch: Partial<ItemInput>) => Promise<void>;
  onQuickUpdate: (item: MediaItem, field: "collection_level" | "rating" | "used" | "private_status", value: unknown) => Promise<void>;
  onBatchUpdate: (items: MediaItem[], patch: Partial<ItemInput> | ((item: MediaItem) => Partial<ItemInput>)) => Promise<BatchOperationResult>;
  onBatchDelete: (items: MediaItem[]) => Promise<BatchOperationResult>;
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addingRow, setAddingRow] = useState(false);
  const [newRow, setNewRow] = useState<PrivateRowDraft>(() => emptyPrivateRowDraft());
  const [newRowBusy, setNewRowBusy] = useState(false);
  const [newRowError, setNewRowError] = useState("");
  const [sheetFeedback, setSheetFeedback] = useState<PrivateSheetFeedback | null>(null);
  const visibleColumns = useMemo(
    () => columnPreferences.order.filter((id) => columnPreferences.visible[id]).map((id) => privateColumnMap[id]),
    [columnPreferences]
  );
  const selectedItems = useMemo(() => items.filter((item) => selectedIds.includes(item.id)), [items, selectedIds]);

  useEffect(() => {
    setSelectedIds((current) => retainVisibleSelection(current, items));
  }, [items]);

  useEffect(() => {
    setSelectedIds([]);
  }, [filters]);

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

  useEffect(() => {
    if (!sheetFeedback) return;
    const id = window.setTimeout(() => setSheetFeedback(null), sheetFeedback.tone === "error" ? 5000 : 2500);
    return () => window.clearTimeout(id);
  }, [sheetFeedback]);

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

  function moveConfiguredColumn(id: PrivateColumnId, offset: -1 | 1) {
    setColumnPreferences((current) => {
      const index = current.order.indexOf(id);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= current.order.length) return current;
      const order = [...current.order];
      [order[index], order[target]] = [order[target], order[index]];
      return normalizePrivateTablePreferences({ ...current, order });
    });
  }

  function autosizeAllColumns() {
    setColumnPreferences((current) => ({
      ...current,
      widths: Object.fromEntries(privateColumnDefinitions.map((column) => [
        column.id,
        Math.min(column.maxWidth, Math.max(column.minWidth, estimatePrivateColumnWidth(column.id, items)))
      ])) as Record<PrivateColumnId, number>
    }));
  }

  function beginNewRow() {
    setNewRow(emptyPrivateRowDraft());
    setNewRowError("");
    setSheetFeedback(null);
    setAddingRow(true);
  }

  function cancelNewRow() {
    if (newRowBusy) return;
    setAddingRow(false);
    setNewRowError("");
  }

  async function submitNewRow() {
    if (!newRow.code.trim()) {
      const message = "無法新增：番號不能空白。";
      setNewRowError(message);
      setSheetFeedback({ message, tone: "error" });
      return;
    }
    setNewRowBusy(true);
    setNewRowError("");
    try {
      await onCreate(privateRowDraftToInput(newRow));
      setAddingRow(false);
      setNewRow(emptyPrivateRowDraft());
      setSheetFeedback({ message: "新增完成", tone: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "新增失敗";
      setNewRowError(message);
      setSheetFeedback({ message, tone: "error" });
    } finally {
      setNewRowBusy(false);
    }
  }

  function keepFailedSelection(result: BatchOperationResult) {
    if (!result.cancelled) setSelectedIds(result.failedIds);
    return result;
  }

  async function updateSelectedCollection(collection: PrivateCollectionLevel) {
    return keepFailedSelection(await onBatchUpdate(selectedItems, privateCollectionPatch(collection)));
  }

  async function updateSelectedTags(input: string, mode: "add" | "remove") {
    return keepFailedSelection(await onBatchUpdate(selectedItems, (item) => privateBatchTagPatch(item, input, mode)));
  }

  async function deleteSelected() {
    return keepFailedSelection(await onBatchDelete(selectedItems));
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
    const restoredFilters = {
      ...view.filters,
      privateStatus: "all",
      usedFilter: "all",
      mediaStatus: "all",
      sort: view.filters.sort ?? (view.sorting?.field === "displayName" ? "displayName" : ""),
      order: view.filters.order ?? (view.sorting?.field === "displayName" ? view.sorting.direction : ""),
      page: 1,
      pageSize: preferences.pageSize
    } as Partial<ListFilters>;
    setColumnPreferences(preferences); onApplyFilters(restoredFilters); setSearchDraft(String(view.filters.query || "")); setActiveSavedView(view.id); setSavedViewsOpen(false);
  }

  function updateSavedView(view: SavedPrivateView<PrivateTablePreferences>) {
    const now = new Date().toISOString();
    persistViews(savedViews.map((entry) => entry.id === view.id ? {
      ...entry,
      filters: { ...filters, page: 1 },
      sorting: { field: filters.sort || "updated_at", direction: filters.order === "asc" ? "asc" : "desc" },
      tablePreferences: columnPreferences,
      updatedAt: now
    } : entry));
    setActiveSavedView(view.id);
  }

  function renameSavedView(view: SavedPrivateView<PrivateTablePreferences>) {
    const name = window.prompt("新的檢視名稱", view.name)?.trim();
    if (!name || (savedViews.some((entry) => entry.id !== view.id && entry.name.toLocaleLowerCase() === name.toLocaleLowerCase()))) { if (name) setSavedViewError("已有同名檢視"); return; }
    persistViews(savedViews.map((entry) => entry.id === view.id ? { ...entry, name, updatedAt: new Date().toISOString() } : entry));
  }

  const activeView = savedViews.find((view) => view.id === activeSavedView);
  const savedViewDirty = activeView ? savedViewSignature(filters, columnPreferences) !== savedViewSignature(activeView.filters, activeView.tablePreferences) : false;
  const visibleStart = total === 0 || items.length === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1;
  const visibleEnd = items.length === 0 ? 0 : Math.min(total, (filters.page - 1) * filters.pageSize + items.length);

  return (
    <section className="private-workbench private-workbench-v4" aria-busy={refreshing}>
      <div className="private-toolbar">
        <label className="private-search-field">
          <Search size={16} />
          <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="搜尋番號、片名、女優或標籤" />
        </label>
        <div className="private-toolbar-actions">
          <button className="filter-toggle advanced-filter" onClick={onOpenAdvanced}><SlidersHorizontal size={16} />進階篩選</button>
          {hasPrivateFilters(filters) && <button className="filter-chip-clear" onClick={onClearFilters}>清除篩選</button>}
          <div className="private-columns-menu">
            <button className="filter-toggle column-toggle" onClick={() => setColumnsOpen((value) => !value)}><Columns3 size={16} />欄位</button>
            {columnsOpen && (
              <div className="private-columns-popover" role="dialog" aria-label="欄位設定">
                <strong>資料表欄位</strong>
                <p>勾選顯示，使用箭頭調整順序；表頭邊緣可拖曳欄寬。</p>
                {columnPreferences.order.map((id, index) => {
                  const column = privateColumnMap[id];
                  return (
                    <div key={column.id} className="private-column-option">
                      <label>
                        <input type="checkbox" checked={columnPreferences.visible[column.id]} disabled={column.required} onChange={() => toggleColumn(column.id)} />
                        <span>{column.label}</span>
                      </label>
                      <button type="button" className="icon-button" onClick={() => moveConfiguredColumn(column.id, -1)} disabled={index === 0} title="上移" aria-label={`${column.label}上移`}><ArrowUp size={13} /></button>
                      <button type="button" className="icon-button" onClick={() => moveConfiguredColumn(column.id, 1)} disabled={index === columnPreferences.order.length - 1} title="下移" aria-label={`${column.label}下移`}><ArrowDown size={13} /></button>
                    </div>
                  );
                })}
                <div className="private-column-actions">
                  <button type="button" onClick={autosizeAllColumns}>自動欄寬</button>
                  <button type="button" className="filter-chip-clear" onClick={resetColumns}>恢復預設</button>
                </div>
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
          <button className="primary" onClick={beginNewRow} disabled={addingRow}><Plus size={16} />新增資料列</button>
        </div>
      </div>

      <PrivateFilterChips filters={filters} onPatch={onPatchFilters} onClear={onClearFilters} />

      {selectedItems.length > 0 && (
        <PrivateBatchToolbar
          selectedCount={selectedItems.length}
          knownTags={knownTags}
          busy={batchBusy}
          onCollection={updateSelectedCollection}
          onTags={updateSelectedTags}
          onDelete={deleteSelected}
          onClear={() => setSelectedIds([])}
        />
      )}

      <div className={refreshing ? "private-list-region is-refreshing" : "private-list-region"}>
        {loading && items.length === 0 ? (
          <PrivateSkeleton />
        ) : error && items.length === 0 ? (
          <PrivateErrorCard error={error} onRetry={onRetry} />
        ) : items.length === 0 && !addingRow ? (
          <PrivateEmptyState onClear={onClearFilters} onAdd={beginNewRow} />
        ) : (
          <>
            {refreshing && <div className="private-refresh-indicator" role="status">更新中...</div>}
            {error && <div className="notice danger private-refresh-error" role="alert">{error}</div>}
            <PrivateMobileCards items={items} selectedIds={selectedIds} onToggleSelected={(id) => setSelectedIds((current) => togglePageItemSelection(current, id))} onSelect={onSelect} />
            <PrivateDataTable
              items={items}
              columns={visibleColumns}
              preferences={columnPreferences}
              sort={filters.sort || ""}
              order={filters.order || ""}
              refreshing={refreshing}
              selectedIds={selectedIds}
              addingRow={addingRow}
              newRow={newRow}
              newRowBusy={newRowBusy}
              newRowError={newRowError}
              knownTags={knownTags}
              onSortTitle={() => onPatchFilters(nextTitleSort(filters))}
              onFilter={(patch) => onPatchFilters({ ...patch, page: 1 })}
              onPreferencesChange={setColumnPreferences}
              onToggleSelected={(id) => setSelectedIds((current) => togglePageItemSelection(current, id))}
              onToggleAll={() => setSelectedIds((current) => togglePageSelection(current, items))}
              onSelect={onSelect}
              onCellUpdate={onCellUpdate}
              onQuickUpdate={onQuickUpdate}
              onNewRowChange={setNewRow}
              onNewRowSubmit={() => void submitNewRow()}
              onNewRowCancel={cancelNewRow}
              onStatusChange={setSheetFeedback}
            />
          </>
        )}
        <div className="private-table-footer">
          <div className="private-table-footer-status">
            <span>顯示 {visibleStart}-{visibleEnd} / {total}</span>
            {sheetFeedback && <span className={`private-sheet-feedback is-${sheetFeedback.tone}`} aria-live="polite">{sheetFeedback.message}</span>}
          </div>
          <div className="pagination-controls private-pagination" aria-label="分頁">
            <button disabled={filters.page <= 1} onClick={() => onPatchFilters({ page: filters.page - 1 })}>上一頁</button>
            <span>{filters.page} / {pageCount}</span>
            <button disabled={filters.page >= pageCount} onClick={() => onPatchFilters({ page: filters.page + 1 })}>下一頁</button>
            <select value={filters.pageSize} onChange={(event) => updatePageSize(Number(event.target.value))} aria-label="每頁筆數">
              {[50, 100, 200].map((size) => <option key={size} value={size}>{size} / 頁</option>)}
            </select>
          </div>
        </div>
      </div>

      <nav className="private-mobile-dock" aria-label="私密工作台快捷操作">
        <button type="button" onClick={onOpenAdvanced} className={hasPrivateFilters(filters) ? "is-active" : ""}>
          <SlidersHorizontal size={19} />
          <span>{hasPrivateFilters(filters) ? "篩選中" : "篩選"}</span>
        </button>
        <button type="button" className="primary" onClick={onOpenSimpleAdd}>
          <Plus size={20} />
          <span>新增</span>
        </button>
      </nav>
    </section>
  );
}

function filterValues(value: string | undefined) {
  return (value || "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

function nextTitleSort(filters: ListFilters): Partial<ListFilters> {
  if (filters.sort !== "displayName") return { sort: "displayName", order: "asc", page: 1 };
  if (filters.order === "asc") return { sort: "displayName", order: "desc", page: 1 };
  return { sort: "", order: "", page: 1 };
}

type PrivateSheetFeedback = {
  message: string;
  tone: "neutral" | "success" | "error";
};

function PrivateDataTable({
  items,
  columns,
  preferences,
  sort,
  order,
  refreshing,
  selectedIds,
  addingRow,
  newRow,
  newRowBusy,
  newRowError,
  knownTags,
  onSortTitle,
  onPreferencesChange,
  onToggleSelected,
  onToggleAll,
  onFilter,
  onSelect,
  onCellUpdate,
  onQuickUpdate,
  onNewRowChange,
  onNewRowSubmit,
  onNewRowCancel,
  onStatusChange
}: {
  items: MediaItem[];
  columns: PrivateColumnDefinition[];
  preferences: PrivateTablePreferences;
  sort: ListFilters["sort"];
  order: ListFilters["order"];
  refreshing: boolean;
  selectedIds: string[];
  addingRow: boolean;
  newRow: PrivateRowDraft;
  newRowBusy: boolean;
  newRowError: string;
  knownTags: string[];
  onSortTitle: () => void;
  onPreferencesChange: (preferences: PrivateTablePreferences | ((current: PrivateTablePreferences) => PrivateTablePreferences)) => void;
  onToggleSelected: (id: string) => void;
  onToggleAll: () => void;
  onFilter: (patch: Partial<ListFilters>) => void;
  onSelect: (item: MediaItem) => void;
  onCellUpdate: (item: MediaItem, patch: Partial<ItemInput>) => Promise<void>;
  onQuickUpdate: (item: MediaItem, field: "collection_level" | "rating" | "used" | "private_status", value: unknown) => Promise<void>;
  onNewRowChange: (draft: PrivateRowDraft) => void;
  onNewRowSubmit: () => void;
  onNewRowCancel: () => void;
  onStatusChange: (feedback: PrivateSheetFeedback) => void;
}) {
  const [dragColumn, setDragColumn] = useState<PrivateColumnId | null>(null);
  const [editing, setEditing] = useState<{ itemId: string; column: PrivateColumnId } | null>(null);
  const [activeCell, setActiveCell] = useState<PrivateCellPosition | null>(null);
  const [failedCell, setFailedCell] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [identityDraft, setIdentityDraft] = useState<PrivateIdentityDraft>({ code: "", title: "" });
  const [quickPending, setQuickPending] = useState<string | null>(null);
  const [quickError, setQuickError] = useState("");
  const cancelBlur = useRef(false);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const cellRefs = useRef(new Map<string, HTMLTableCellElement>());
  const savingCellRef = useRef<string | null>(null);
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const someSelected = selectedIds.length > 0 && !allSelected;
  const totalWidth = 84 + columns.reduce((sum, column) => sum + preferences.widths[column.id], 0);
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const columnIds = useMemo(() => columns.map((column) => column.id), [columns]);
  const resolvedActiveCell = useMemo(() => activeCell && itemIds.includes(activeCell.itemId) && columnIds.includes(activeCell.column)
    ? activeCell
    : itemIds[0] && columnIds[0] ? { itemId: itemIds[0], column: columnIds[0] } : null, [activeCell, columnIds, itemIds]);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  useEffect(() => {
    if (!resolvedActiveCell) {
      setActiveCell(null);
      setEditing(null);
      return;
    }
    setActiveCell((current) => current && itemIds.includes(current.itemId) && columnIds.includes(current.column) ? current : resolvedActiveCell);
    setEditing((current) => current && itemIds.includes(current.itemId) && columnIds.includes(current.column) ? current : null);
  }, [columnIds, itemIds, resolvedActiveCell]);

  function registerCell(position: PrivateCellPosition, node: HTMLTableCellElement | null) {
    const key = privateCellKey(position);
    if (node) cellRefs.current.set(key, node);
    else cellRefs.current.delete(key);
  }

  function focusCell(position: PrivateCellPosition) {
    setActiveCell(position);
    setFailedCell(null);
    window.requestAnimationFrame(() => {
      const cell = cellRefs.current.get(privateCellKey(position));
      if (!cell) return;
      const target = position.column === "rating" || position.column === "favorite"
        ? cell.querySelector<HTMLElement>('[data-private-cell-control] [tabindex="0"], [data-private-cell-control], select') || cell
        : cell;
      target.focus({ preventScroll: true });
      cell.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  function moveCellFocus(position: PrivateCellPosition, movement: PrivateCellMovement) {
    const next = movePrivateCell(position, itemIds, columnIds, movement);
    if (next) focusCell(next);
  }

  function refocusEditor(position: PrivateCellPosition) {
    window.requestAnimationFrame(() => cellRefs.current.get(privateCellKey(position))?.querySelector<HTMLInputElement>("input")?.focus());
  }

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

  function beginCellEdit(item: MediaItem, column: PrivateColumnId) {
    if (quickPending) return;
    const position = { itemId: item.id, column };
    cancelBlur.current = false;
    setQuickError("");
    setFailedCell(null);
    setActiveCell(position);
    if (column === "identity") setIdentityDraft(privateIdentityValue(item));
    else if (column !== "rating" && column !== "favorite") setEditDraft(privateCellValue(item, column));
    setEditing(position);
  }

  function identityDraftFromEditor(editor: HTMLElement | null) {
    if (!editor) return identityDraft;
    const codeInput = editor.querySelector<HTMLInputElement>('input[aria-label="編輯番號"]');
    const titleInput = editor.querySelector<HTMLInputElement>('input[aria-label="編輯片名"]');
    return {
      code: codeInput?.value ?? identityDraft.code,
      title: titleInput?.value ?? identityDraft.title,
    };
  }

  function finishCellEdit(position: PrivateCellPosition, movement?: PrivateCellMovement) {
    setEditing(null);
    setFailedCell(null);
    if (movement) moveCellFocus(position, movement);
  }

  function cancelCellEdit(position: PrivateCellPosition) {
    cancelBlur.current = true;
    setEditing(null);
    setQuickError("");
    focusCell(position);
  }

  async function commitIdentityEdit(item: MediaItem, nextDraft = identityDraft, movement?: PrivateCellMovement) {
    const position = { itemId: item.id, column: "identity" } satisfies PrivateCellPosition;
    const key = privateCellKey(position);
    if (cancelBlur.current) {
      cancelBlur.current = false;
      return;
    }
    if (savingCellRef.current) return;
    const original = privateIdentityValue(item);
    if (nextDraft.code.trim() === original.code && nextDraft.title.trim() === original.title) {
      finishCellEdit(position, movement);
      return;
    }
    let patch: Partial<ItemInput>;
    try {
      patch = privateIdentityPatch(nextDraft);
    } catch (err) {
      const message = err instanceof Error ? err.message : "番號不能空白";
      setQuickError(message);
      setFailedCell(privateCellKey(position));
      setActiveCell(position);
      onStatusChange({ message, tone: "error" });
      refocusEditor(position);
      return;
    }
    savingCellRef.current = key;
    setQuickPending(key);
    setQuickError("");
    onStatusChange({ message: "儲存中...", tone: "neutral" });
    try {
      await onCellUpdate(item, patch);
      finishCellEdit(position, movement);
      onStatusChange({ message: "已儲存", tone: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "作品代號更新失敗";
      setQuickError(message);
      setFailedCell(key);
      setActiveCell(position);
      onStatusChange({ message, tone: "error" });
      refocusEditor(position);
    } finally {
      if (savingCellRef.current === key) savingCellRef.current = null;
      setQuickPending(null);
    }
  }

  async function commitCellEdit(item: MediaItem, column: PrivateEditableColumn, nextDraft = editDraft, movement?: PrivateCellMovement) {
    const position = { itemId: item.id, column } satisfies PrivateCellPosition;
    if (cancelBlur.current) {
      cancelBlur.current = false;
      return;
    }
    const key = privateCellKey(position);
    if (savingCellRef.current) return;
    if (nextDraft === privateCellValue(item, column)) {
      finishCellEdit(position, movement);
      return;
    }
    savingCellRef.current = key;
    setQuickPending(key);
    setQuickError("");
    onStatusChange({ message: "儲存中...", tone: "neutral" });
    try {
      await onCellUpdate(item, privateCellPatch(item, column, nextDraft));
      finishCellEdit(position, movement);
      onStatusChange({ message: "已儲存", tone: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "儲存格更新失敗";
      setQuickError(message);
      setFailedCell(key);
      setActiveCell(position);
      onStatusChange({ message, tone: "error" });
      refocusEditor(position);
    } finally {
      if (savingCellRef.current === key) savingCellRef.current = null;
      setQuickPending(null);
    }
  }

  function handleCellKeyDown(event: React.KeyboardEvent<HTMLInputElement>, item: MediaItem, column: PrivateEditableColumn) {
    const position = { itemId: item.id, column } satisfies PrivateCellPosition;
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      const movement: PrivateCellMovement = event.key === "Enter" ? "down" : event.shiftKey ? "tabBackward" : "tabForward";
      void commitCellEdit(item, column, event.currentTarget.value, movement);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelCellEdit(position);
    }
  }

  function handleIdentityKeyDown(event: React.KeyboardEvent<HTMLInputElement>, item: MediaItem) {
    const position = { itemId: item.id, column: "identity" } satisfies PrivateCellPosition;
    const activeField = event.currentTarget.getAttribute("aria-label") === "編輯片名" ? "title" : "code";
    if (event.key === "Tab" && ((activeField === "code" && !event.shiftKey) || (activeField === "title" && event.shiftKey))) {
      event.preventDefault();
      event.stopPropagation();
      const targetLabel = activeField === "code" ? "編輯片名" : "編輯番號";
      event.currentTarget.parentElement?.querySelector<HTMLInputElement>(`input[aria-label="${targetLabel}"]`)?.focus();
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      const nextDraft = {
        ...identityDraftFromEditor(event.currentTarget.parentElement),
        [activeField]: event.currentTarget.value,
      };
      setIdentityDraft(nextDraft);
      const movement: PrivateCellMovement = event.key === "Enter" ? "down" : event.shiftKey ? "tabBackward" : "tabForward";
      void commitIdentityEdit(item, nextDraft, movement);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelCellEdit(position);
    }
  }

  function handleIdentityBlur(event: React.FocusEvent<HTMLSpanElement>, item: MediaItem) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    const nextDraft = identityDraftFromEditor(event.currentTarget);
    setIdentityDraft(nextDraft);
    void commitIdentityEdit(item, nextDraft);
  }

  async function commitQuick(item: MediaItem, field: "collection_level" | "rating", value: unknown) {
    const key = `${item.id}:${field}`; if (quickPending) return;
    if (savingCellRef.current) return;
    savingCellRef.current = key;
    setQuickPending(key); setQuickError(""); setFailedCell(null);
    onStatusChange({ message: "儲存中...", tone: "neutral" });
    try {
      await onQuickUpdate(item, field, value);
      onStatusChange({ message: "已儲存", tone: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "快速更新失敗";
      setQuickError(message); setFailedCell(key);
      onStatusChange({ message, tone: "error" });
    }
    finally {
      if (savingCellRef.current === key) savingCellRef.current = null;
      setQuickPending(null);
    }
  }

  function activateCell(event: React.MouseEvent<HTMLTableCellElement>, position: PrivateCellPosition) {
    setActiveCell(position);
    setFailedCell(null);
    if (!(event.target as HTMLElement).closest("input,select,button")) event.currentTarget.focus({ preventScroll: true });
  }

  function handleCellNavigation(event: React.KeyboardEvent<HTMLTableCellElement>, item: MediaItem, column: PrivateColumnId) {
    const position = { itemId: item.id, column };
    if (editing?.itemId === item.id && editing.column === column) return;
    const target = event.target as HTMLElement;
    const directSelect = target instanceof HTMLSelectElement;
    if (event.key === "Tab") {
      event.preventDefault();
      moveCellFocus(position, event.shiftKey ? "tabBackward" : "tabForward");
      return;
    }
    if (directSelect) return;
    const movement = ({ ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" } as const)[event.key];
    if (movement) {
      event.preventDefault();
      moveCellFocus(position, movement);
    } else if (event.key === "Enter" || event.key === "F2") {
      event.preventDefault();
      beginCellEdit(item, column);
    }
  }

  function handleCellCopy(event: React.ClipboardEvent<HTMLTableCellElement>, item: MediaItem, column: PrivateColumnId) {
    if (editing?.itemId === item.id && editing.column === column) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", privateClipboardValue(item, column));
    setActiveCell({ itemId: item.id, column });
    onStatusChange({ message: `已複製「${privateColumnMap[column].label}」`, tone: "success" });
  }

  async function pasteCell(item: MediaItem, column: PrivateColumnId, value: string) {
    const position = { itemId: item.id, column };
    const key = privateCellKey(position);
    setActiveCell(position);
    setFailedCell(null);
    setQuickError("");
    let update;
    try {
      update = privateClipboardUpdate(item, column, value);
    } catch (err) {
      const message = err instanceof Error ? err.message : "貼上內容格式不正確";
      setFailedCell(key);
      onStatusChange({ message, tone: "error" });
      return;
    }
    const pendingKey = column === "favorite" ? `${item.id}:collection_level` : key;
    if (savingCellRef.current) return;
    savingCellRef.current = pendingKey;
    setQuickPending(pendingKey);
    onStatusChange({ message: "儲存中...", tone: "neutral" });
    try {
      if (update.kind === "quick") await onQuickUpdate(item, update.field, update.value);
      else await onCellUpdate(item, update.patch);
      onStatusChange({ message: `已貼上「${privateColumnMap[column].label}」`, tone: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "貼上失敗";
      setFailedCell(key);
      onStatusChange({ message, tone: "error" });
    } finally {
      if (savingCellRef.current === pendingKey) savingCellRef.current = null;
      setQuickPending(null);
    }
  }

  function handleCellPaste(event: React.ClipboardEvent<HTMLTableCellElement>, item: MediaItem, column: PrivateColumnId) {
    if (editing?.itemId === item.id && editing.column === column) return;
    event.preventDefault();
    void pasteCell(item, column, event.clipboardData.getData("text/plain"));
  }

  return (
    <div className="private-data-table-wrap">
      <table className="private-data-table private-dense-table" aria-busy={refreshing} style={{ "--private-table-width": `${Math.max(totalWidth, 760)}px` } as CSSProperties}>
        <colgroup>
          <col className="private-select-column" />
          {columns.map((column) => (
            <col
              key={column.id}
              style={{ width: preferences.widths[column.id] }}
            />
          ))}
          <col className="private-open-column" />
        </colgroup>
        <thead>
          <tr>
            <th className="private-select-column">
              <input ref={selectAllRef} type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label="選取目前頁全部資料" />
            </th>
            {columns.map((column) => (
              <th
                key={column.id}
                className={column.id === "identity" ? "private-sticky-column" : undefined}
                aria-sort={column.id === "identity" ? sort === "displayName" ? order === "desc" ? "descending" : "ascending" : "none" : undefined}
                draggable
                onDragStart={(event) => {
                  if ((event.target as HTMLElement).closest(".private-sort-header,.private-column-resize")) {
                    event.preventDefault();
                    return;
                  }
                  setDragColumn(column.id);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => moveColumn(column.id)}
              >
                {column.id === "identity" ? (
                  <button className="private-sort-header" type="button" onClick={onSortTitle} onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    onSortTitle();
                  }}>
                    <span>{column.label}</span>
                    <span className="private-sort-direction" aria-hidden="true">{sort === "displayName" ? order === "desc" ? <ArrowDown size={13} /> : <ArrowUp size={13} /> : null}</span>
                  </button>
                ) : (
                  <span>{column.label}</span>
                )}
                <span className="private-column-resize" onMouseDown={(event) => startResize(column, event)} onDoubleClick={() => autosize(column)} title="拖曳調整寬度，雙擊自動寬度" />
              </th>
            ))}
            <th className="private-open-column" aria-label="開啟詳細資料" />
          </tr>
        </thead>
        <tbody>
          {addingRow && (
            <PrivateNewSpreadsheetRow
              columns={columns}
              draft={newRow}
              busy={newRowBusy}
              error={newRowError}
              knownTags={knownTags}
              onChange={onNewRowChange}
              onSubmit={onNewRowSubmit}
              onCancel={onNewRowCancel}
            />
          )}
          {items.map((item) => {
            return (
              <tr key={item.id} className={selectedIds.includes(item.id) ? "selected" : ""}>
                <td className="private-select-column">
                  <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggleSelected(item.id)} onClick={(event) => event.stopPropagation()} aria-label={`選取 ${privateItemDetails(item).code}`} />
                </td>
                {columns.map((column) => {
                  const position = { itemId: item.id, column: column.id } satisfies PrivateCellPosition;
                  const key = privateCellKey(position);
                  const isActive = resolvedActiveCell?.itemId === item.id && resolvedActiveCell.column === column.id;
                  const isDirectSelect = column.id === "rating" || column.id === "favorite";
                  const className = [
                    column.id === "identity" ? "private-sticky-column" : "",
                    isActive ? "is-active-cell" : "",
                    failedCell === key ? "is-error-cell" : "",
                  ].filter(Boolean).join(" ");
                  return (
                    <td
                      key={column.id}
                      ref={(node) => registerCell(position, node)}
                      className={className || undefined}
                      tabIndex={isDirectSelect ? -1 : isActive ? 0 : -1}
                      aria-selected={isActive}
                      onClick={(event) => activateCell(event, position)}
                      onFocusCapture={() => setActiveCell(position)}
                      onKeyDown={(event) => handleCellNavigation(event, item, column.id)}
                      onCopy={(event) => handleCellCopy(event, item, column.id)}
                      onPaste={(event) => handleCellPaste(event, item, column.id)}
                    >
                      <PrivateTableCell
                        column={column.id}
                        item={item}
                        active={isActive}
                        editing={editing?.itemId === item.id && editing.column === column.id}
                        draft={editDraft}
                        identityDraft={identityDraft}
                        pending={quickPending === `${item.id}:${column.id === "favorite" ? "collection_level" : column.id}`}
                        error={editing?.itemId === item.id && editing.column === column.id ? quickError : ""}
                        onBeginEdit={() => beginCellEdit(item, column.id)}
                        onDraftChange={setEditDraft}
                        onIdentityDraftChange={setIdentityDraft}
                        onBlur={(event) => void commitCellEdit(item, column.id as PrivateEditableColumn, event.currentTarget.value)}
                        onIdentityBlur={(event) => handleIdentityBlur(event, item)}
                        onKeyDown={(event) => handleCellKeyDown(event, item, column.id as PrivateEditableColumn)}
                        onIdentityKeyDown={(event) => handleIdentityKeyDown(event, item)}
                        onCommit={(field, value) => void commitQuick(item, field, value)}
                        onFilter={onFilter}
                      />
                    </td>
                  );
                })}
                <td className="private-open-column">
                  <button type="button" className="private-open-row" onClick={() => onSelect(item)} title="編輯詳細資料" aria-label={`編輯 ${privateItemDetails(item).code}`}><Pencil size={13} /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PrivateTableCell({
  column,
  item,
  active,
  editing,
  draft,
  identityDraft,
  pending,
  error,
  onBeginEdit,
  onDraftChange,
  onIdentityDraftChange,
  onBlur,
  onIdentityBlur,
  onKeyDown,
  onIdentityKeyDown,
  onCommit
}: {
  column: PrivateColumnId;
  item: MediaItem;
  active: boolean;
  editing: boolean;
  draft: string;
  identityDraft: PrivateIdentityDraft;
  pending: boolean;
  error: string;
  onBeginEdit: () => void;
  onDraftChange: (value: string) => void;
  onIdentityDraftChange: (value: PrivateIdentityDraft) => void;
  onBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  onIdentityBlur: (event: React.FocusEvent<HTMLSpanElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onIdentityKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onCommit: (field: "collection_level" | "rating", value: unknown) => void;
  onFilter: (patch: Partial<ListFilters>) => void;
}) {
  if (column === "identity") {
    const identity = privateIdentityValue(item);
    if (editing) {
      return (
        <span className="private-identity-editor" onBlur={onIdentityBlur}>
          <input
            autoFocus
            value={identityDraft.code}
            disabled={pending}
            onChange={(event) => onIdentityDraftChange({ ...identityDraft, code: event.target.value })}
            onKeyDown={onIdentityKeyDown}
            placeholder="番號"
            aria-label="編輯番號"
          />
          <input
            value={identityDraft.title}
            disabled={pending}
            onChange={(event) => onIdentityDraftChange({ ...identityDraft, title: event.target.value })}
            onKeyDown={onIdentityKeyDown}
            placeholder="片名可留空"
            aria-label="編輯片名"
          />
          {error && <em role="alert">{error}</em>}
        </span>
      );
    }
    return (
      <span
        className={`private-identity-value${pending ? " is-saving" : ""}`}
        title={privateIdentityLabel(item) || "雙擊編輯"}
        onDoubleClick={onBeginEdit}
      >
        <strong>{identity.code}</strong>
        {identity.title && <><span className="private-identity-separator">—</span><span className="private-identity-title">{identity.title}</span></>}
      </span>
    );
  }
  if (column === "rating") {
    return (
      <PrivateStarRating
        value={item.rating}
        active={active}
        compact
        disabled={pending}
        label={`評分 ${privateItemDetails(item).code}`}
        onChange={(rating) => onCommit("rating", rating)}
      />
    );
  }
  if (column === "favorite") {
    return (
      <span className="private-sheet-select-cell">
        <select data-private-cell-control className="private-sheet-select" tabIndex={active ? 0 : -1} value={privateCollectionLevel(item)} disabled={pending} onChange={(event) => onCommit("collection_level", event.target.value)} aria-label={`收藏 ${privateItemDetails(item).code}`}>
          {privateCollectionLevels.map((value) => <option key={value} value={value}>{privateCollectionLevelLabels[value]}</option>)}
        </select>
        <ChevronDown size={12} aria-hidden="true" />
      </span>
    );
  }

  const editableColumn = column as PrivateEditableColumn;
  const value = privateCellValue(item, editableColumn);
  if (editing) {
    return (
      <span className="private-sheet-editor">
        <input
          autoFocus
          type={column === "releaseDate" ? "date" : "text"}
          value={draft}
          disabled={pending}
          onChange={(event) => onDraftChange(event.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          aria-label={`編輯${privateColumnMap[column].label}`}
        />
        {error && <em role="alert">{error}</em>}
      </span>
    );
  }
  return (
    <span
      className={`private-sheet-value private-sheet-${column}${pending ? " is-saving" : ""}`}
      title={value || "雙擊輸入"}
      onDoubleClick={onBeginEdit}
    >
      {value || ""}
    </span>
  );
}

function estimatePrivateColumnWidth(column: PrivateColumnId, items: MediaItem[]) {
  const sample = items.slice(0, 100).map((item) => {
    if (column === "identity") return privateIdentityLabel(item) || "-";
    if (column === "rating") return item.rating ? `${privateStarsFromRating(item.rating)} 星` : "-";
    if (column === "favorite") return privateFavoriteLevel(item);
    return privateCellValue(item, column) || "-";
  });
  const maxLength = Math.max(privateColumnMap[column].label.length, ...sample.map((value) => value.length));
  return maxLength * 8 + 34;
}

function PrivateNewSpreadsheetRow({ columns, draft, busy, error, knownTags, onChange, onSubmit, onCancel }: {
  columns: PrivateColumnDefinition[];
  draft: PrivateRowDraft;
  busy: boolean;
  error: string;
  knownTags: string[];
  onChange: (draft: PrivateRowDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  function patch(next: Partial<PrivateRowDraft>) {
    onChange({ ...draft, ...next });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  function cell(column: PrivateColumnId) {
    if (column === "identity") return <span className="private-new-identity-editor"><input autoFocus value={draft.code} onChange={(event) => patch({ code: event.target.value })} onKeyDown={handleKeyDown} placeholder="輸入番號" aria-label="新資料番號" /><input value={draft.title} onChange={(event) => patch({ title: event.target.value })} onKeyDown={handleKeyDown} placeholder="片名可留空" aria-label="新資料片名" /></span>;
    if (column === "rating") return <PrivateStarRating value={privateRatingFromStars(draft.rating)} compact label="新資料評分" onChange={(rating) => patch({ rating: rating === null ? "" : String(privateStarsFromRating(rating)) })} onKeyDown={handleKeyDown} />;
    if (column === "favorite") return <select value={draft.collection} onChange={(event) => patch({ collection: event.target.value as PrivateCollectionLevel })} onKeyDown={handleKeyDown} aria-label="新資料收藏">{privateCollectionLevels.map((value) => <option key={value} value={value}>{privateCollectionLevelLabels[value]}</option>)}</select>;
    if (column === "actress") return <input value={draft.actress} onChange={(event) => patch({ actress: event.target.value })} onKeyDown={handleKeyDown} placeholder="多人用逗號分隔" aria-label="新資料女優" />;
    if (column === "maker") return <input value={draft.maker} onChange={(event) => patch({ maker: event.target.value })} onKeyDown={handleKeyDown} placeholder="片商" aria-label="新資料片商" />;
    if (column === "tags") return <PrivateNewRowTagEditor value={draft.tags} knownTags={knownTags} onChange={(tags) => patch({ tags })} onKeyDown={handleKeyDown} />;
    if (column === "releaseDate") return <input type="date" value={draft.releaseDate} onChange={(event) => patch({ releaseDate: event.target.value })} onKeyDown={handleKeyDown} aria-label="新資料發行日期" />;
    return <input value={draft.summary} onChange={(event) => patch({ summary: event.target.value })} onKeyDown={handleKeyDown} placeholder="快速筆記" aria-label="新資料快速筆記" />;
  }

  return (
    <tr className="private-new-sheet-row">
      <td className="private-select-column" aria-hidden="true">+</td>
      {columns.map((column) => <td key={column.id} className={column.id === "identity" ? "private-sticky-column" : undefined}>{cell(column.id)}</td>)}
      <td className="private-open-column">
        <span className="private-new-row-actions">
          <button type="button" onClick={onSubmit} disabled={busy || !draft.code.trim()} title="儲存新資料" aria-label="儲存新資料"><Check size={14} /></button>
          <button type="button" onClick={onCancel} disabled={busy} title="取消新增" aria-label="取消新增"><X size={14} /></button>
          {error && <span className="private-new-row-error" role="alert"><CircleAlert size={15} aria-hidden="true" /><span>{error}</span></span>}
        </span>
      </td>
    </tr>
  );
}

function PrivateNewRowTagEditor({
  value,
  knownTags,
  onChange,
  onKeyDown
}: {
  value: string;
  knownTags: string[];
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedTags = useMemo(() => parseTagInput(value), [value]);
  const selectedKeys = useMemo(() => new Set(selectedTags.map((tag) => tag.toLocaleLowerCase())), [selectedTags]);
  const suggestions = useMemo(
    () => normalizeTags(knownTags).filter((tag) => !selectedKeys.has(tag.toLocaleLowerCase())).slice(0, 12),
    [knownTags, selectedKeys]
  );

  function addTag(tag: string) {
    onChange(addTags(selectedTags, tag).join(", "));
  }

  return (
    <span
      className="private-new-tag-editor"
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="輸入或點選標籤"
        aria-label="新資料標籤"
      />
      {open && suggestions.length > 0 && (
        <span className="private-new-tag-suggestions" aria-label="常用標籤">
          {suggestions.map((tag) => (
            <button key={tag} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addTag(tag)}>#{tag}</button>
          ))}
        </span>
      )}
    </span>
  );
}

function PrivateMobileCards({ items, selectedIds, onToggleSelected, onSelect }: { items: MediaItem[]; selectedIds: string[]; onToggleSelected: (id: string) => void; onSelect: (item: MediaItem) => void }) {
  return (
    <div className="private-mobile-list">
      {items.map((item) => <PrivateMobileCard key={item.id} item={item} selected={selectedIds.includes(item.id)} onToggleSelected={onToggleSelected} onSelect={onSelect} />)}
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

function PrivateMobileCard({ item, onSelect, desktop = false, selected = false, onToggleSelected }: { item: MediaItem; onSelect: (item: MediaItem) => void; desktop?: boolean; selected?: boolean; onToggleSelected?: (id: string) => void }) {
  const details = privateItemDetails(item);
  const title = details.title !== "-" && details.title !== details.code ? details.title : "";
  const source = Array.from(new Set([item.platform, item.maker || details.studio].map((value) => (value || "").trim()).filter((value) => value && value !== "-"))).join(" · ");
  const performers = details.performers === "-" ? PRIVATE_DEFAULT_ACTRESS : details.performers;
  const releaseDate = item.release_date?.slice(0, 10) || "";
  return (
    <article className={`${desktop ? "private-mobile-card private-desktop-card" : "private-mobile-card"}${selected ? " selected" : ""}`} onClick={() => onSelect(item)}>
      <div className="private-card-head">
        <span className="private-card-title">
          {onToggleSelected && <input type="checkbox" checked={selected} onChange={() => onToggleSelected(item.id)} onClick={(event) => event.stopPropagation()} aria-label={`選取 ${details.code}`} />}
          <span className="private-card-identity">
            <strong>{details.code}</strong>
            {title && <span>{title}</span>}
          </span>
        </span>
        <button type="button" className="private-card-open" onClick={(event) => { event.stopPropagation(); onSelect(item); }} aria-label={`編輯 ${details.code}`}><Pencil size={16} aria-hidden="true" /></button>
      </div>
      <div className="private-card-summary">
        <PrivateRating item={item} />
        <PrivateBadge tone="favorite">{privateFavoriteLevel(item)}</PrivateBadge>
      </div>
      <div className="private-card-meta">
        {source && <span>{source}</span>}
        <span>{performers}</span>
        {releaseDate && <time dateTime={releaseDate}>{releaseDate}</time>}
      </div>
      {item.quick_note && <p className="private-card-note">{item.quick_note}</p>}
      {item.tags.length > 0 && <div className="private-card-bottom"><PrivateTags tags={item.tags} /></div>}
    </article>
  );
}

function PrivateRating({ item }: { item: MediaItem }) {
  return <PrivateStarDisplay value={item.rating} />;
}

function PrivateFavoriteMark({ level }: { level: string }) {
  const normalized = level === "已刪" || level === "已刪除" || level === "淘汰" ? "淘汰" : level;
  if (normalized === "未分類") return <span className="private-favorite-unset" aria-label="收藏：未分類">—</span>;
  const icon = normalized === "已使用"
    ? <Check size={14} />
    : normalized === "神作"
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

function PrivateSource({ item, onSelect }: { item: MediaItem; onSelect?: (source: string) => void }) {
  const source = privateSourceLabel(item);
  if (!source) return <span className="private-muted-cell">—</span>;
  const filterSource = (item.platform || "").trim();
  if (onSelect && filterSource) return <button className="private-cell-filter" onClick={(event) => { event.stopPropagation(); onSelect(filterSource); }} title={`篩選來源 ${filterSource}`}><PrivateBadge tone="platform">{source}</PrivateBadge></button>;
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

function PrivateTags({ tags, onSelect }: { tags: string[]; onSelect?: (tag: string) => void }) {
  if (tags.length === 0) return <span className="private-muted-cell">-</span>;
  return (
    <span className="private-tags">
      {tags.slice(0, 3).map((tag) => onSelect
        ? <button key={tag} onClick={(event) => { event.stopPropagation(); onSelect(tag); }} title={`篩選標籤 ${tag}`}>#{tag}</button>
        : <span key={tag}>#{tag}</span>)}
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
  return privateCollectionLevelLabels[privateCollectionLevel(item)];
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
    filters.collectionLevel.trim() ||
    filters.favoriteLevel !== "all" ||
    filters.platformFilters?.trim() ||
    filters.makerFilters?.trim() ||
    filters.favoriteLevelFilters?.trim() ||
    filters.personFilters?.trim() ||
    filters.missingPeople ||
    (filters.hasNote && filters.hasNote !== "all") ||
    (filters.hasCover && filters.hasCover !== "all") ||
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
  if (filters.usedFilter === "used") chips.push("完成");
  if (filters.usedFilter === "unused") chips.push("待處理");
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

export function SimpleAddModal({
  privateMode,
  knownTags = [],
  loading,
  onClose,
  onSubmit
}: {
  privateMode: boolean;
  knownTags?: string[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: ItemInput) => Promise<void>;
}) {
  const [restoredDraft] = useState(() => privateMode ? readPrivateSimpleAddDraft() : null);
  const [draft, setDraft] = useState<PrivateSimpleAddDraft>(() => restoredDraft?.draft ?? emptyPrivateSimpleAddDraft(todayDate()));
  const [draftStatus, setDraftStatus] = useState<"idle" | "restored" | "saving" | "saved" | "error" | "cleared">(
    restoredDraft ? "restored" : "idle"
  );
  const [draftSavedAt, setDraftSavedAt] = useState(restoredDraft?.savedAt || "");
  const [submitError, setSubmitError] = useState("");
  const draftRef = useRef(draft);
  const saveTimerRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const historyEntryActiveRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const canSubmit = privateMode ? Boolean(draft.code.trim() || draft.title.trim()) : Boolean(draft.title.trim());
  const hasDraft = privateMode && hasMeaningfulPrivateDraft(draft);
  const draftMessage = privateMode ? privateDraftStatusMessage(draftStatus, draftSavedAt) : "";

  useEffect(() => {
    if (!privateMode) return;
    if (!historyEntryActiveRef.current) {
      historyEntryActiveRef.current = pushPrivateSimpleAddHistoryEntry();
    }
    const handlePopState = () => {
      if (!historyEntryActiveRef.current) return;
      historyEntryActiveRef.current = false;
      onCloseRef.current();
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [privateMode]);

  useEffect(() => {
    if (!privateMode) return;
    const flushDraft = () => {
      if (submittedRef.current) return;
      savePrivateSimpleAddDraft(draftRef.current);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      window.removeEventListener("pagehide", flushDraft);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      flushDraft();
    };
  }, [privateMode]);

  function patch(patch: Partial<typeof draft>) {
    if (submitError) setSubmitError("");
    const nextDraft = { ...draftRef.current, ...patch };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    if (!privateMode) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    setDraftStatus("saving");
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      const saved = savePrivateSimpleAddDraft(draftRef.current);
      if (!saved) {
        setDraftStatus("error");
        return;
      }
      setDraftSavedAt(saved.savedAt);
      setDraftStatus(hasMeaningfulPrivateDraft(draftRef.current) ? "saved" : "idle");
    }, 250);
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitError("");
    try {
      await onSubmit(simpleDraftToInput(draft, privateMode));
      if (privateMode) {
        submittedRef.current = true;
        if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
        clearPrivateSimpleAddDraft();
      }
      closePreservingDraft();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "無法新增這筆資料，請檢查內容後再試一次。");
    }
  }

  function closePreservingDraft() {
    if (privateMode && historyEntryActiveRef.current) {
      historyEntryActiveRef.current = false;
      popPrivateSimpleAddHistoryEntry();
    }
    onClose();
  }

  function clearDraft() {
    if (!window.confirm("確定要清除這份尚未新增的草稿嗎？")) return;
    if (!clearPrivateSimpleAddDraft()) {
      setDraftStatus("error");
      return;
    }
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    const nextDraft = emptyPrivateSimpleAddDraft(todayDate());
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setSubmitError("");
    setDraftSavedAt("");
    setDraftStatus("cleared");
  }

  function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) closePreservingDraft();
  }

  return (
    <div className="simple-add-backdrop" onClick={handleBackdropClick}>
      <section className="simple-add-modal" role="dialog" aria-modal="true" aria-label={privateMode ? "簡單新增私密紀錄" : "簡單新增紀錄"}>
        <header className="simple-add-head">
          <div>
            <p className="eyebrow">簡單新增</p>
            <h2>{privateMode ? "新增私密資料" : "核心欄位"}</h2>
          </div>
          <button className="icon-button" onClick={closePreservingDraft} aria-label={privateMode ? "關閉並保留草稿" : "關閉"}>×</button>
        </header>
        <div className="simple-add-grid">
          {privateMode && <Field label="番號" value={draft.code} onChange={(value) => patch({ code: value })} />}
          <Field label={privateMode ? "片名" : "標題"} value={draft.title} onChange={(value) => patch({ title: value })} required={!privateMode} />
          {privateMode
            ? <label className="private-star-field">評分<PrivateStarRating value={privateRatingFromStars(draft.rating)} label="私密評分" onChange={(rating) => patch({ rating: rating === null ? "" : String(privateStarsFromRating(rating)) })} /></label>
            : <Field label="評分" value={draft.rating} onChange={(value) => patch({ rating: value })} inputMode="decimal" />}
          {privateMode && (
            <label>
              收藏
              <select value={draft.collection} onChange={(event) => patch({ collection: event.target.value as PrivateCollectionLevel })}>
                {privateCollectionLevels.map((value) => <option key={value} value={value}>{privateCollectionLevelLabels[value]}</option>)}
              </select>
            </label>
          )}
          {privateMode && <Field label="女優" value={draft.actress} onChange={(value) => patch({ actress: value })} />}
          {privateMode && <Field label="平台" value={draft.platform} onChange={(value) => patch({ platform: value })} />}
          {privateMode && <Field label="片商" value={draft.maker} onChange={(value) => patch({ maker: value })} />}
          {privateMode && <Field label="發行日期" value={draft.release_date} onChange={(value) => patch({ release_date: value })} type="date" />}
          {!privateMode && <TagEditor tags={draft.tags} knownTags={knownTags} maxSuggestions={16} onChange={(tags) => patch({ tags })} placeholder="輸入標籤後按 Enter" />}
          {!privateMode && <Field label="觀看日" value={draft.watched_at} onChange={(value) => patch({ watched_at: value })} type="date" />}
          {privateMode && <label className="wide">快速筆記<input value={draft.summary} onChange={(event) => patch({ summary: event.target.value })} /></label>}
          {privateMode && <TagEditor tags={draft.tags} knownTags={knownTags} maxSuggestions={12} onChange={(tags) => patch({ tags })} placeholder="輸入或直接點選常用標籤" />}
        </div>
        {(privateMode || submitError) && (
          <div className="simple-add-feedback">
            {privateMode && (
              <div className={`simple-add-draft-status ${draftStatus === "error" ? "error" : ""}`} role={draftStatus === "error" ? "alert" : "status"} aria-live="polite">
                <span>{draftMessage}</span>
                {hasDraft && <button type="button" className="simple-add-clear-draft" onClick={clearDraft}><Trash2 size={14} aria-hidden="true" />清除草稿</button>}
              </div>
            )}
            {submitError && <div className="simple-add-error" role="alert" aria-live="assertive"><CircleAlert size={17} aria-hidden="true" /><span>{submitError}</span></div>}
          </div>
        )}
        <footer className="simple-add-actions">
          <button onClick={closePreservingDraft}>{privateMode ? "稍後繼續" : "取消"}</button>
          <button className="primary" onClick={() => void submit()} disabled={loading || !canSubmit}>新增</button>
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

function simpleDraftToInput(draft: { code: string; title: string; rating: string; collection: PrivateCollectionLevel; actress: string; platform: string; maker: string; summary: string; tags: string[]; release_date: string; watched_at: string }, privateMode: boolean): ItemInput {
  const code = draft.code.trim();
  const title = draft.title.trim();
  const tags = normalizeTags(draft.tags);
  if (privateMode) {
    return privateRowDraftToInput({
      code,
      title,
      rating: draft.rating,
      collection: draft.collection,
      actress: draft.actress,
      platform: draft.platform,
      maker: draft.maker,
      tags: tags.join(", "),
      releaseDate: draft.release_date,
      watchedAt: draft.watched_at,
      summary: draft.summary
    });
  }
  return {
    raw_title: title,
    watched_at: draft.watched_at || null,
    rating: numberOrNull(draft.rating),
    tags,
    status: "raw"
  };
}

function privateDraftStatusMessage(
  status: "idle" | "restored" | "saving" | "saved" | "error" | "cleared",
  savedAt: string
) {
  if (status === "restored") return `已恢復 ${formatDraftSavedAt(savedAt)} 的未完成草稿`;
  if (status === "saving") return "正在保存草稿...";
  if (status === "saved") return "草稿已自動儲存";
  if (status === "error") return "無法自動保存草稿，請勿離開此頁";
  if (status === "cleared") return "草稿已清除";
  return "輸入內容會自動保存在這台裝置";
}

function formatDraftSavedAt(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "上次";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
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
  knownTags = [],
  loading,
  onChange,
  onCancel,
  onConfirm
}: {
  preview: SmartAddResponse;
  draft: ItemInput;
  knownTags?: string[];
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
        <TagEditor className="wide" tags={draft.tags || []} knownTags={knownTags} onChange={(tags) => onChange({ tags })} placeholder="MLB, 棒球, 藍鳥" />
      </div>
      <div className="smart-preview-actions">
        <button onClick={onCancel}>取消</button>
        <button className="primary" disabled={loading || !draft.raw_title.trim()} onClick={onConfirm}>確認新增</button>
      </div>
    </section>
  );
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
    release_date: null,
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
