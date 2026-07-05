import { Ban, CheckCircle2, Pause, Plus, Repeat2, RotateCcw, SkipForward, Sparkles, Star, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { displayDate } from "../lib/date";
import { privateItemDetails } from "../lib/privacy";
import { getItemReflection, moodOptions, rewatchIntentOptions } from "../lib/reflection";
import { classifyItem, libraryTree } from "../lib/taxonomy";
import { displayDateForItem, getWatchProgress, getWatchStatus, isSeriesLike, progressLabel, updateWatchProgress, watchStatusLabel, watchStatuses } from "../lib/watch";
import type { ItemInput, MediaItem, WatchStatus } from "../types";

type ColumnId = string;

type ColumnDef = {
  id: ColumnId;
  label: string;
  colClassName: string;
  headerClassName?: string;
  cellClassName?: string;
  custom?: boolean;
  render: (item: MediaItem) => ReactNode;
};

type CustomColumn = {
  id: string;
  label: string;
  source: string;
};

const typeOptions: string[] = libraryTree.map((entry) => entry.label);
const platformOptions = ["Netflix", "Disney+", "Prime Video", "Apple TV+", "HBO Max", "YouTube", "Crunchyroll", "電影院", "DVD / BD", "其他"];
const shadiaoType = "沙雕动画";
const shadiaoUpdateStatuses = ["連載中", "已完結", "已斷更", "休更中", "不確定"];
const columnStoragePrefix = "itemTableColumns";
const customColumnStoragePrefix = "itemTableCustomColumns";

export function ItemList({
  items,
  view,
  columnScope = "home",
  columnManagerOpen = false,
  onColumnManagerClose,
  privateMode = false,
  density,
  loading,
  emptyMessage = "還沒有紀錄，先從上方快速新增一筆就好。",
  onSelect,
  onToggleFavorite,
  onDelete,
  onMetadata,
  onQuickUpdate,
  onQuickCreate,
  onBatchUpdate,
  onBatchDelete
}: {
  items: MediaItem[];
  view: "table" | "list" | "poster";
  columnScope?: string;
  columnManagerOpen?: boolean;
  onColumnManagerClose?: () => void;
  privateMode?: boolean;
  density: "comfortable" | "standard" | "compact";
  loading: boolean;
  emptyMessage?: string;
  onSelect: (item: MediaItem) => void;
  onToggleFavorite?: (item: MediaItem) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onMetadata?: (item: MediaItem) => void;
  onQuickUpdate?: (item: MediaItem, patch: Partial<ItemInput>) => Promise<void>;
  onQuickCreate?: (input: ItemInput) => Promise<void>;
  onBatchUpdate?: (items: MediaItem[], patch: Partial<ItemInput> | ((item: MediaItem) => Partial<ItemInput>)) => Promise<void>;
  onBatchDelete?: (items: MediaItem[]) => Promise<void>;
}) {
  const storageKey = `${columnStoragePrefix}:${privateMode ? "private" : "public"}:${columnScope}`;
  const customStorageKey = `${customColumnStoragePrefix}:${privateMode ? "private" : "public"}:${columnScope}`;
  const sheetMode = !privateMode && isShadiaoScope(columnScope);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const allColumns = useMemo(
    () => [
      ...(privateMode ? privateColumnDefs() : generalColumnDefs({ onToggleFavorite, onDelete, onMetadata, onQuickUpdate })),
      ...customColumns.map(customColumnDef)
    ],
    [customColumns, privateMode, onDelete, onMetadata, onQuickUpdate, onToggleFavorite]
  );
  const defaultColumnIds = useMemo(() => defaultColumnsForScope(columnScope, privateMode), [columnScope, privateMode]);
  const [selectedColumnIds, setSelectedColumnIds] = useState<ColumnId[]>(defaultColumnIds);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedItems = useMemo(() => items.filter((item) => selectedIds.includes(item.id)), [items, selectedIds]);

  useEffect(() => {
    const available = new Set(allColumns.map((column) => column.id));
    const stored = loadStoredColumns(storageKey, available);
    setSelectedColumnIds(stored.length > 0 ? stored : defaultColumnIds.filter((id) => available.has(id)));
  }, [allColumns, defaultColumnIds, storageKey]);

  useEffect(() => {
    setCustomColumns(loadCustomColumns(customStorageKey));
  }, [customStorageKey]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  const visibleColumns = useMemo(() => {
    const selected = new Set(selectedColumnIds);
    const columns = allColumns.filter((column) => selected.has(column.id));
    return columns.length > 0 ? columns : allColumns.filter((column) => defaultColumnIds.includes(column.id));
  }, [allColumns, defaultColumnIds, selectedColumnIds]);

  function updateColumns(next: ColumnId[]) {
    const available = new Set(allColumns.map((column) => column.id));
    const clean = next.filter((id) => available.has(id));
    const fallback = defaultColumnIds.filter((id) => available.has(id));
    const value = clean.length > 0 ? clean : fallback;
    setSelectedColumnIds(value);
    localStorage.setItem(storageKey, JSON.stringify(value));
  }

  function toggleColumn(id: ColumnId) {
    if (selectedColumnIds.includes(id)) {
      updateColumns(selectedColumnIds.filter((columnId) => columnId !== id));
      return;
    }
    const order = allColumns.map((column) => column.id);
    updateColumns([...selectedColumnIds, id].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  }

  function resetColumns() {
    localStorage.removeItem(storageKey);
    setSelectedColumnIds(defaultColumnIds);
  }

  function addCustomColumn(label: string, source: string) {
    const nextColumn = {
      id: `custom:${Date.now().toString(36)}`,
      label: label.trim(),
      source: source.trim()
    };
    if (!nextColumn.label || !nextColumn.source) return;
    const next = [...customColumns, nextColumn];
    setCustomColumns(next);
    localStorage.setItem(customStorageKey, JSON.stringify(next));
    updateColumns([...selectedColumnIds, nextColumn.id]);
  }

  function deleteCustomColumn(id: string) {
    const next = customColumns.filter((column) => column.id !== id);
    setCustomColumns(next);
    localStorage.setItem(customStorageKey, JSON.stringify(next));
    updateColumns(selectedColumnIds.filter((columnId) => columnId !== id));
  }

  if (loading) return <div className="empty">讀取中...</div>;
  if (items.length === 0 && !(sheetMode && view === "table")) return <div className="empty">{emptyMessage}</div>;
  if (view === "poster") return <PosterWall items={items} onSelect={onSelect} />;

  return (
    <>
      {view === "table" && (
        <>
          <BatchToolbar
            selectedItems={selectedItems}
            privateMode={privateMode}
            onUpdate={onBatchUpdate}
            onDelete={onBatchDelete}
            onClear={() => setSelectedIds([])}
          />
          <DataTable
            items={items}
            density={density}
            privateMode={privateMode}
            sheetMode={sheetMode}
            columns={visibleColumns}
            selectedIds={selectedIds}
            onToggleSelected={(id) => setSelectedIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id])}
            onToggleAll={() => setSelectedIds(selectedIds.length === items.length ? [] : items.map((item) => item.id))}
            onSelect={onSelect}
            onQuickCreate={onQuickCreate}
          />
        </>
      )}

      <div className={view === "list" ? "compact-list force-list" : "compact-list"}>
        {items.map((item) => (
          <article className="compact-row" key={item.id} onClick={() => onSelect(item)}>
            <span className="compact-cover" aria-hidden="true">
              {item.cover_url ? <img src={item.cover_url} alt="" /> : coverInitial(item)}
            </span>
            <div className="compact-main">
              <div className="compact-title">
                <strong>{item.official_title || item.raw_title}</strong>
                {item.favorite && <Star size={13} fill="currentColor" />}
              </div>
              <div className="compact-meta">
                <span>{compactTypeLabel(item)}</span>
                <StatusPill item={item} />
                {progressLabel(item) && <span>{progressLabel(item)}</span>}
                <span>{dateLabel(item)}</span>
              </div>
              {(item.quick_note || item.tags.length > 0) && (
                <div className="compact-sub">
                  {item.quick_note && <span>{item.quick_note}</span>}
                  {item.tags.length > 0 && <Tags tags={item.tags} limit={3} />}
                </div>
              )}
            </div>
            <div className="compact-actions">
              <QuickProgressActions item={item} onQuickUpdate={onQuickUpdate} compact />
              <RatingStars item={item} onQuickUpdate={onQuickUpdate} compact />
              {!privateMode && (
                <button className="row-icon" onClick={(event) => action(event, () => onMetadata?.(item))} title="補資料">
                  <Sparkles size={15} />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {columnManagerOpen && (
        <ColumnManager
          columns={allColumns}
          selectedColumnIds={selectedColumnIds}
          scope={scopeLabel(columnScope)}
          onToggle={toggleColumn}
          onReset={resetColumns}
          onAddCustom={addCustomColumn}
          onDeleteCustom={deleteCustomColumn}
          onClose={onColumnManagerClose || (() => undefined)}
        />
      )}
    </>
  );
}

function BatchToolbar({
  selectedItems,
  privateMode,
  onUpdate,
  onDelete,
  onClear
}: {
  selectedItems: MediaItem[];
  privateMode: boolean;
  onUpdate?: (items: MediaItem[], patch: Partial<ItemInput> | ((item: MediaItem) => Partial<ItemInput>)) => Promise<void>;
  onDelete?: (items: MediaItem[]) => Promise<void>;
  onClear: () => void;
}) {
  const [watchStatus, setWatchStatus] = useState<WatchStatus | "">("");
  const [type, setType] = useState("");
  const [platform, setPlatform] = useState("");
  const [tags, setTags] = useState("");
  const disabled = selectedItems.length === 0;

  if (disabled) return null;

  async function applyWatchStatus() {
    if (!watchStatus || disabled) return;
    await onUpdate?.(selectedItems, (item) => updateWatchProgress(item, { watch_status: watchStatus }));
    setWatchStatus("");
  }

  async function applyFields() {
    if (disabled) return;
    const patch: Partial<ItemInput> = {};
    if (type.trim()) patch.type = type.trim();
    if (platform.trim()) patch.platform = platform.trim();
    if (Object.keys(patch).length === 0) return;
    await onUpdate?.(selectedItems, patch);
    setType("");
    setPlatform("");
  }

  async function appendTags() {
    const nextTags = splitTags(tags);
    if (disabled || nextTags.length === 0) return;
    await onUpdate?.(selectedItems, (item) => ({ tags: Array.from(new Set([...item.tags, ...nextTags])) }));
    setTags("");
  }

  return (
    <div className="batch-toolbar" aria-label="批次整理">
      <strong>{selectedItems.length} 筆已選</strong>
      <select value={watchStatus} onChange={(event) => setWatchStatus(event.target.value as WatchStatus | "")} disabled={disabled || privateMode}>
        <option value="">觀看狀態</option>
        {watchStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
      </select>
      <button onClick={applyWatchStatus} disabled={disabled || !watchStatus || privateMode}>套用</button>
      <input value={type} onChange={(event) => setType(event.target.value)} placeholder="類型" disabled={disabled} />
      <input value={platform} onChange={(event) => setPlatform(event.target.value)} placeholder={privateMode ? "片商" : "平台"} disabled={disabled} />
      <button onClick={applyFields} disabled={disabled || (!type.trim() && !platform.trim())}>批次更新</button>
      <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="加入標籤" disabled={disabled} />
      <button onClick={appendTags} disabled={disabled || !tags.trim()}>加標籤</button>
      <button onClick={() => onUpdate?.(selectedItems, { favorite: true })} disabled={disabled}>收藏</button>
      <button className="danger-button" onClick={() => onDelete?.(selectedItems)} disabled={disabled}>刪除</button>
      <button onClick={onClear} disabled={disabled}>清除選取</button>
    </div>
  );
}

function DataTable({
  items,
  density,
  privateMode,
  sheetMode,
  columns,
  selectedIds,
  onToggleSelected,
  onToggleAll,
  onSelect,
  onQuickCreate
}: {
  items: MediaItem[];
  density: "comfortable" | "standard" | "compact";
  privateMode: boolean;
  sheetMode: boolean;
  columns: ColumnDef[];
  selectedIds: string[];
  onToggleSelected: (id: string) => void;
  onToggleAll: () => void;
  onSelect: (item: MediaItem) => void;
  onQuickCreate?: (input: ItemInput) => Promise<void>;
}) {
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  return (
    <div className={`database-table-wrap ${privateMode ? "private-table-wrap" : ""} ${sheetMode ? "shadiao-sheet-wrap" : ""} density-${density}`}>
      <table className={privateMode ? "database-table private-table" : sheetMode ? "database-table shadiao-sheet-table" : "database-table"}>
        <colgroup>
          <col className="select-col" />
          {columns.map((column) => <col key={column.id} className={column.colClassName} />)}
        </colgroup>
        <thead>
          <tr>
            <th className="select-cell">
              <input type="checkbox" checked={allSelected} onChange={onToggleAll} onClick={stop} aria-label="選取全部" />
            </th>
            {columns.map((column) => (
              <th key={column.id} className={column.headerClassName}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={selectedIds.includes(item.id) ? "selected" : ""} onClick={() => onSelect(item)}>
              <td className="select-cell">
                <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggleSelected(item.id)} onClick={stop} aria-label={`選取 ${item.official_title || item.raw_title}`} />
              </td>
              {columns.map((column) => (
                <td key={column.id} className={column.cellClassName}>{column.render(item)}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {sheetMode && <ShadiaoAddFooter columns={columns} extraColumns={1} onQuickCreate={onQuickCreate} />}
      </table>
    </div>
  );
}

function ShadiaoAddFooter({ columns, extraColumns = 0, onQuickCreate }: { columns: ColumnDef[]; extraColumns?: number; onQuickCreate?: (input: ItemInput) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    author: "",
    animationStatus: "watching" as WatchStatus,
    updateStatus: "連載中",
    progress: "",
    rating: "",
    mood: "",
    rewatch: "",
    tags: ""
  });

  async function save() {
    if (!draft.title.trim() || !onQuickCreate) return;
    setSaving(true);
    try {
      const progress = numberOrNull(draft.progress);
      const metadata = {
        ...(draft.updateStatus ? { update_status: draft.updateStatus } : {}),
        reflection: {
          ...(draft.mood ? { mood: draft.mood } : {}),
          ...(draft.rewatch ? { rewatch_intent: draft.rewatch } : {})
        }
      };
      await onQuickCreate({
        raw_title: draft.title.trim(),
        type: shadiaoType,
        platform: "B站",
        status: watchStatuses.find((entry) => entry.value === draft.animationStatus)?.legacy || "partial",
        rating: numberOrNull(draft.rating),
        tags: splitTags(draft.tags),
        people: draft.author.trim() ? [draft.author.trim()] : [],
        metadata_json: JSON.stringify(metadata),
        progress_json: JSON.stringify({
          watch_status: draft.animationStatus,
          current_episode: progress,
          total_episodes: null
        })
      });
      setDraft({ title: "", author: "", animationStatus: "watching", updateStatus: "連載中", progress: "", rating: "", mood: "", rewatch: "", tags: "" });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <tfoot>
        <tr className="sheet-plus-row">
          <td colSpan={columns.length + extraColumns}>
            <button type="button" onClick={() => setOpen(true)} title="新增一筆沙雕动画">+</button>
          </td>
        </tr>
      </tfoot>
    );
  }

  return (
    <tfoot>
      <tr className="sheet-draft-row">
        {extraColumns > 0 && <td />}
        {columns.map((column) => (
          <td key={column.id}>{renderShadiaoDraftCell(column.id, draft, setDraft, save, saving)}</td>
        ))}
      </tr>
    </tfoot>
  );
}

function ColumnManager({
  columns,
  selectedColumnIds,
  scope,
  onToggle,
  onReset,
  onAddCustom,
  onDeleteCustom,
  onClose
}: {
  columns: ColumnDef[];
  selectedColumnIds: ColumnId[];
  scope: string;
  onToggle: (id: ColumnId) => void;
  onReset: () => void;
  onAddCustom: (label: string, source: string) => void;
  onDeleteCustom: (id: string) => void;
  onClose: () => void;
}) {
  const [customLabel, setCustomLabel] = useState("");
  const [customSource, setCustomSource] = useState("");

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  function submitCustomColumn() {
    onAddCustom(customLabel, customSource);
    setCustomLabel("");
    setCustomSource("");
  }

  return (
    <div className="column-manager-backdrop" onClick={handleBackdropClick}>
      <section className="column-manager" role="dialog" aria-modal="true" aria-label="欄位顯示設定">
        <header className="column-manager-head">
          <div>
            <p className="eyebrow">欄位顯示設定</p>
            <h2>{scope}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="關閉">
            <X size={17} />
          </button>
        </header>
        <div className="column-option-grid">
          {columns.map((column) => (
            <label className="column-option" key={column.id}>
              <input
                type="checkbox"
                checked={selectedColumnIds.includes(column.id)}
                onChange={() => onToggle(column.id)}
              />
              <span>{column.label}</span>
              {column.custom && (
                <button type="button" className="column-delete" onClick={(event) => action(event, () => onDeleteCustom(column.id))} aria-label={`刪除 ${column.label}`}>
                  <Trash2 size={14} />
                </button>
              )}
            </label>
          ))}
        </div>
        <div className="custom-column-form">
          <label>
            欄位名稱
            <input value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} placeholder="例如：導演" />
          </label>
          <label>
            資料鍵
            <input value={customSource} onChange={(event) => setCustomSource(event.target.value)} placeholder="例如：director" />
          </label>
          <button type="button" onClick={submitCustomColumn} disabled={!customLabel.trim() || !customSource.trim()}>
            <Plus size={15} />
            新增欄位
          </button>
        </div>
        <footer className="column-manager-actions">
          <button onClick={onReset}>
            <RotateCcw size={15} />
            重設此分類
          </button>
          <button className="primary" onClick={onClose}>完成</button>
        </footer>
      </section>
    </div>
  );
}

function generalColumnDefs({
  onToggleFavorite,
  onDelete,
  onMetadata,
  onQuickUpdate
}: {
  onToggleFavorite?: (item: MediaItem) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onMetadata?: (item: MediaItem) => void;
  onQuickUpdate?: (item: MediaItem, patch: Partial<ItemInput>) => Promise<void>;
}): ColumnDef[] {
  return [
    {
      id: "sheet_title",
      label: "標題",
      colClassName: "sheet-title-col",
      cellClassName: "sheet-text-cell",
      render: (item) => (
        <InlineText
          value={item.official_title || item.raw_title}
          onCommit={(value) => onQuickUpdate?.(item, { raw_title: value, official_title: value })}
        />
      )
    },
    {
      id: "shadiao_author",
      label: "動畫作者",
      colClassName: "sheet-author-col",
      cellClassName: "sheet-text-cell",
      render: (item) => (
        <InlineText
          value={item.people[0] || ""}
          placeholder="-"
          onCommit={(value) => onQuickUpdate?.(item, { people: value ? [value] : [] })}
        />
      )
    },
    {
      id: "shadiao_status",
      label: "動畫狀態",
      colClassName: "sheet-status-col",
      render: (item) => (
        <select className="sheet-select" value={getWatchStatus(item)} onClick={stop} onChange={(event) => onQuickUpdate?.(item, updateWatchProgress(item, { watch_status: event.target.value as WatchStatus }))}>
          {watchStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
      )
    },
    {
      id: "shadiao_update_status",
      label: "更新狀態",
      colClassName: "sheet-status-col",
      render: (item) => (
        <select className="sheet-select" value={metadataText(item, "update_status")} onClick={stop} onChange={(event) => onQuickUpdate?.(item, { metadata_json: mergeMetadata(item.metadata_json, "update_status", event.target.value) })}>
          <option value="">-</option>
          {shadiaoUpdateStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      )
    },
    {
      id: "shadiao_progress",
      label: "追更進度",
      colClassName: "sheet-progress-col",
      render: (item) => {
        const progress = getWatchProgress(item);
        return (
          <InlineText
            value={progress.current_episode ? String(progress.current_episode) : ""}
            inputMode="numeric"
            placeholder="-"
            onCommit={(value) => onQuickUpdate?.(item, updateWatchProgress(item, { current_episode: numberOrNull(value), total_episodes: progress.total_episodes || null }))}
          />
        );
      }
    },
    {
      id: "sheet_rating",
      label: "評分",
      colClassName: "sheet-rating-col",
      render: (item) => (
        <InlineText
          value={item.rating ? String(item.rating) : ""}
          inputMode="decimal"
          placeholder="-"
          onCommit={(value) => onQuickUpdate?.(item, { rating: numberOrNull(value) })}
        />
      )
    },
    {
      id: "sheet_mood",
      label: "心情",
      colClassName: "sheet-mood-col",
      render: (item) => {
        const reflection = getItemReflection(item);
        return (
          <select className="sheet-select" value={reflection.mood} onClick={stop} onChange={(event) => onQuickUpdate?.(item, { metadata_json: mergeReflectionField(item.metadata_json, "mood", event.target.value) })}>
            <option value="">-</option>
            {moodOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        );
      }
    },
    {
      id: "sheet_rewatch",
      label: "重看",
      colClassName: "sheet-rewatch-col",
      render: (item) => {
        const reflection = getItemReflection(item);
        return (
          <select className="sheet-select" value={reflection.rewatch_intent} onClick={stop} onChange={(event) => onQuickUpdate?.(item, { metadata_json: mergeReflectionField(item.metadata_json, "rewatch_intent", event.target.value) })}>
            <option value="">-</option>
            {rewatchIntentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        );
      }
    },
    {
      id: "sheet_tags",
      label: "標籤",
      colClassName: "sheet-tags-col",
      cellClassName: "sheet-text-cell",
      render: (item) => (
        <InlineText
          value={item.tags.join(", ")}
          placeholder="-"
          onCommit={(value) => onQuickUpdate?.(item, { tags: splitTags(value) })}
        />
      )
    },
    {
      id: "title",
      label: "標題",
      colClassName: "general-title-col",
      headerClassName: "title-col",
      cellClassName: "title-cell",
      render: (item) => (
        <div className="title-cell-inner">
          {item.cover_url ? (
            <img className="table-cover" src={item.cover_url} alt="" loading="lazy" />
          ) : (
            <span className="table-cover placeholder">{coverInitial(item)}</span>
          )}
          <span className="title-copy">
            <strong>{item.official_title || item.raw_title}</strong>
            {item.code && <small>{item.code}</small>}
            {item.quick_note && <small>{item.quick_note}</small>}
          </span>
        </div>
      )
    },
    {
      id: "type",
      label: "類型",
      colClassName: "general-type-col",
      render: (item) => {
        const classification = classifyItem(item);
        return (
          <select className="inline-type" value={displayType(item, classification)} onClick={stop} onChange={(event) => onQuickUpdate?.(item, { type: event.target.value })}>
            {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
            {!typeOptions.includes(displayType(item, classification)) && <option value={displayType(item, classification)}>{displayType(item, classification)}</option>}
          </select>
        );
      }
    },
    { id: "year", label: "年份", colClassName: "general-year-col", cellClassName: "muted-cell", render: (item) => item.release_year || "-" },
    { id: "status", label: "狀態", colClassName: "general-status-col", render: (item) => <StatusPill item={item} /> },
    { id: "progress", label: "進度", colClassName: "general-progress-col", cellClassName: "muted-cell", render: tableProgressLabel },
    {
      id: "platform",
      label: "平台",
      colClassName: "general-platform-col",
      render: (item) => (
        <select className="inline-platform" value={item.platform || ""} onClick={stop} onChange={(event) => onQuickUpdate?.(item, { platform: event.target.value || null })}>
          <option value="">-</option>
          {platformOptions.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
          {item.platform && !platformOptions.includes(item.platform) && <option value={item.platform}>{item.platform}</option>}
        </select>
      )
    },
    { id: "rating", label: "評分", colClassName: "general-rating-col", render: (item) => <RatingValue item={item} /> },
    { id: "mood", label: "心情", colClassName: "reflection-col", render: (item) => <ReflectionBadge value={getItemReflection(item).mood} /> },
    { id: "rewatch_intent", label: "重看", colClassName: "reflection-col", render: (item) => <ReflectionBadge value={getItemReflection(item).rewatch_intent} /> },
    { id: "collection_level", label: "收藏等級", colClassName: "reflection-col", render: (item) => <ReflectionBadge value={getItemReflection(item).collection_level} /> },
    { id: "tags", label: "標籤", colClassName: "general-tags-col", render: (item) => <Tags tags={item.tags} /> },
    { id: "updated", label: "更新日", colClassName: "general-updated-col", cellClassName: "muted-cell", render: dateLabel },
    {
      id: "actions",
      label: "更多操作",
      colClassName: "general-actions-col",
      render: (item) => <RowActions item={item} onToggleFavorite={onToggleFavorite} onDelete={onDelete} onMetadata={onMetadata} onQuickUpdate={onQuickUpdate} />
    }
  ];
}

function privateColumnDefs(): ColumnDef[] {
  return [
    { id: "code", label: "番號", colClassName: "private-code-col", cellClassName: "private-code-cell", render: (item) => privateItemDetails(item).code },
    {
      id: "title",
      label: "片名",
      colClassName: "private-title-col",
      cellClassName: "private-title-cell",
      render: (item) => {
        const title = privateItemDetails(item).title;
        return <strong title={title}>{title}</strong>;
      }
    },
    {
      id: "performers",
      label: "女優・演員",
      colClassName: "private-performer-col",
      cellClassName: "private-text-cell",
      render: (item) => {
        const performers = privateItemDetails(item).performers;
        return <span title={performers}>{performers}</span>;
      }
    },
    {
      id: "studio",
      label: "片商",
      colClassName: "private-studio-col",
      cellClassName: "private-text-cell",
      render: (item) => {
        const studio = privateItemDetails(item).studio;
        return <span title={studio}>{studio}</span>;
      }
    },
    { id: "year", label: "年份", colClassName: "private-year-col", cellClassName: "muted-cell private-year-cell", render: (item) => privateItemDetails(item).releaseYear },
    { id: "rating", label: "評分", colClassName: "private-rating-col", render: (item) => <RatingValue item={item} /> },
    { id: "mood", label: "心情", colClassName: "reflection-col", render: (item) => <ReflectionBadge value={getItemReflection(item).mood} /> },
    { id: "rewatch_intent", label: "重看", colClassName: "reflection-col", render: (item) => <ReflectionBadge value={getItemReflection(item).rewatch_intent} /> },
    { id: "collection_level", label: "收藏等級", colClassName: "reflection-col", render: (item) => <ReflectionBadge value={getItemReflection(item).collection_level} /> },
    { id: "tags", label: "標籤", colClassName: "private-tags-col", render: (item) => <Tags tags={item.tags} limit={4} /> }
  ];
}

function customColumnDef(column: CustomColumn): ColumnDef {
  return {
    id: column.id,
    label: column.label,
    colClassName: "custom-data-col",
    cellClassName: "muted-cell custom-data-cell",
    custom: true,
    render: (item) => readCustomColumn(item, column.source) || "-"
  };
}

function defaultColumnsForScope(scope: string, privateMode: boolean): ColumnId[] {
  if (privateMode) return ["code", "title", "performers", "studio", "year", "rating", "mood", "rewatch_intent", "collection_level", "tags"];
  if (isShadiaoScope(scope)) return ["sheet_title", "shadiao_author", "shadiao_status", "shadiao_update_status", "shadiao_progress", "sheet_rating", "sheet_mood", "sheet_rewatch", "sheet_tags", "updated", "actions"];
  if (scope.includes("電影")) return ["title", "year", "status", "platform", "rating", "mood", "rewatch_intent", "tags", "updated", "actions"];
  if (scope.includes("影集") || scope.includes("動畫")) return ["title", "year", "status", "progress", "platform", "rating", "mood", "rewatch_intent", "tags", "updated", "actions"];
  if (scope.includes("YouTube")) return ["title", "status", "platform", "rating", "mood", "tags", "updated", "actions"];
  if (scope.includes("其他")) return ["title", "type", "status", "rating", "mood", "tags", "updated", "actions"];
  return ["title", "type", "year", "status", "progress", "platform", "rating", "mood", "rewatch_intent", "tags", "updated", "actions"];
}

function loadStoredColumns(key: string, available: Set<ColumnId>) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is ColumnId => typeof id === "string" && available.has(id as ColumnId));
  } catch {
    return [];
  }
}

function loadCustomColumns(key: string): CustomColumn[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is CustomColumn => (
        entry &&
        typeof entry === "object" &&
        typeof entry.id === "string" &&
        typeof entry.label === "string" &&
        typeof entry.source === "string"
      ))
      .filter((entry) => entry.label.trim() && entry.source.trim());
  } catch {
    return [];
  }
}

function readCustomColumn(item: MediaItem, source: string) {
  const key = source.trim();
  if (!key) return "";
  const directValue = (item as unknown as Record<string, unknown>)[key];
  const directText = valueToText(directValue);
  if (directText) return directText;
  if (!item.metadata_json) return "";
  try {
    const metadata = JSON.parse(item.metadata_json) as Record<string, unknown>;
    return valueToText(metadata[key]);
  } catch {
    return "";
  }
}

function valueToText(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function scopeLabel(scope: string) {
  if (scope === "home") return "全部";
  if (scope === "plan_to_watch") return "待觀看";
  if (scope === "watching") return "觀看中";
  if (scope === "completed") return "看完";
  if (scope === "favorites") return "收藏";
  return scope;
}

function isShadiaoScope(scope: string) {
  return scope.includes(shadiaoType);
}

function renderShadiaoDraftCell(
  id: ColumnId,
  draft: {
    title: string;
    author: string;
    animationStatus: WatchStatus;
    updateStatus: string;
    progress: string;
    rating: string;
    mood: string;
    rewatch: string;
    tags: string;
  },
  setDraft: (draft: {
    title: string;
    author: string;
    animationStatus: WatchStatus;
    updateStatus: string;
    progress: string;
    rating: string;
    mood: string;
    rewatch: string;
    tags: string;
  }) => void,
  onSave: () => void,
  saving: boolean
) {
  const patch = (next: Partial<typeof draft>) => setDraft({ ...draft, ...next });
  if (id === "sheet_title") return <input className="sheet-input" value={draft.title} onChange={(event) => patch({ title: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") void onSave(); }} placeholder="標題" autoFocus />;
  if (id === "shadiao_author") return <input className="sheet-input" value={draft.author} onChange={(event) => patch({ author: event.target.value })} placeholder="動畫作者" />;
  if (id === "type") return <span className="muted-cell">{shadiaoType}</span>;
  if (id === "shadiao_status") {
    return (
      <select className="sheet-select" value={draft.animationStatus} onChange={(event) => patch({ animationStatus: event.target.value as WatchStatus })}>
        {watchStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
      </select>
    );
  }
  if (id === "shadiao_update_status") {
    return (
      <select className="sheet-select" value={draft.updateStatus} onChange={(event) => patch({ updateStatus: event.target.value })}>
        {shadiaoUpdateStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </select>
    );
  }
  if (id === "shadiao_progress") return <input className="sheet-input" value={draft.progress} onChange={(event) => patch({ progress: event.target.value })} inputMode="numeric" placeholder="0" />;
  if (id === "sheet_rating") return <input className="sheet-input" value={draft.rating} onChange={(event) => patch({ rating: event.target.value })} inputMode="decimal" placeholder="0-10" />;
  if (id === "sheet_mood") {
    return (
      <select className="sheet-select" value={draft.mood} onChange={(event) => patch({ mood: event.target.value })}>
        <option value="">-</option>
        {moodOptions.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }
  if (id === "sheet_rewatch") {
    return (
      <select className="sheet-select" value={draft.rewatch} onChange={(event) => patch({ rewatch: event.target.value })}>
        <option value="">-</option>
        {rewatchIntentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }
  if (id === "sheet_tags") return <input className="sheet-input" value={draft.tags} onChange={(event) => patch({ tags: event.target.value })} placeholder="標籤" />;
  if (id === "actions") return <button type="button" className="sheet-save" onClick={() => void onSave()} disabled={saving || !draft.title.trim()}>{saving ? "..." : "新增"}</button>;
  return <span className="muted-cell">-</span>;
}

function InlineText({
  value,
  onCommit,
  placeholder,
  inputMode
}: {
  value: string;
  onCommit?: (value: string) => void | Promise<void>;
  placeholder?: string;
  inputMode?: "numeric" | "decimal";
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    const next = draft.trim();
    if (next === value.trim()) return;
    void onCommit?.(next);
  }

  return (
    <input
      className="sheet-input"
      value={draft}
      placeholder={placeholder}
      inputMode={inputMode}
      onClick={stop}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function metadataText(item: MediaItem, key: string) {
  const value = parseMetadata(item.metadata_json)[key];
  return typeof value === "string" ? value : "";
}

function mergeMetadata(value: string | null, key: string, nextValue: string) {
  const metadata = parseMetadata(value);
  if (nextValue.trim()) metadata[key] = nextValue.trim();
  else delete metadata[key];
  return JSON.stringify(metadata);
}

function mergeReflectionField(value: string | null, key: "mood" | "rewatch_intent", nextValue: string) {
  const metadata = parseMetadata(value);
  const reflection = metadata.reflection && typeof metadata.reflection === "object" && !Array.isArray(metadata.reflection)
    ? metadata.reflection as Record<string, unknown>
    : {};
  if (nextValue.trim()) reflection[key] = nextValue.trim();
  else delete reflection[key];
  if (Object.keys(reflection).length > 0) metadata.reflection = reflection;
  else delete metadata.reflection;
  return JSON.stringify(metadata);
}

function parseMetadata(value: string | null) {
  if (!value) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function splitTags(value: string) {
  return value.split(/[#,，、\s]+/).map((tag) => tag.trim()).filter(Boolean);
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function PosterWall({ items, onSelect }: { items: MediaItem[]; onSelect: (item: MediaItem) => void }) {
  const posterItems = items.filter((item) => item.cover_url);
  if (posterItems.length === 0) return <div className="empty">目前沒有海報。可以用「補資料」從 TMDb 補上封面連結。</div>;
  return (
    <div className="poster-wall">
      {posterItems.map((item) => (
        <button className="poster-card" key={item.id} onClick={() => onSelect(item)}>
          <img src={item.cover_url || ""} alt="" />
          <span>
            <strong>{item.official_title || item.raw_title}</strong>
            <em>{item.release_year || "-"} · {watchStatusLabel(getWatchStatus(item))}</em>
            <em>{item.rating ? `★ ${Number(item.rating).toFixed(1)}` : "尚未評分"}{isSeriesLike(item) && progressLabel(item) ? ` · ${progressLabel(item)}` : ""}</em>
          </span>
        </button>
      ))}
    </div>
  );
}

function RatingStars({ item, compact, onQuickUpdate }: { item: MediaItem; compact?: boolean; onQuickUpdate?: (item: MediaItem, patch: Partial<ItemInput>) => Promise<void> }) {
  const value = item.rating || 0;
  return (
    <span className={compact ? "rating-stars compact" : "rating-stars"} onClick={stop}>
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          className={value >= rating ? "filled" : ""}
          onClick={(event) => action(event, () => onQuickUpdate?.(item, { rating }))}
          title={`${rating} 星`}
        >
          <Star size={compact ? 13 : 16} fill={value >= rating ? "currentColor" : "none"} />
        </button>
      ))}
    </span>
  );
}

function RatingValue({ item }: { item: MediaItem }) {
  if (!item.rating) return <span className="muted-cell">-</span>;
  return (
    <span className="rating-value" aria-label={`${item.rating} 星`}>
      <Star size={14} fill="currentColor" />
      {Number(item.rating).toFixed(1)}
    </span>
  );
}

function ReflectionBadge({ value }: { value: string }) {
  if (!value) return <span className="muted-cell">-</span>;
  return <span className="reflection-badge">{value}</span>;
}

function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return <span className="muted-cell">-</span>;
  return (
    <span className="platform-badge" title={platform}>
      {platform}
    </span>
  );
}

function RowActions({
  item,
  onToggleFavorite,
  onDelete,
  onMetadata,
  onQuickUpdate
}: {
  item: MediaItem;
  onToggleFavorite?: (item: MediaItem) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onMetadata?: (item: MediaItem) => void;
  onQuickUpdate?: (item: MediaItem, patch: Partial<ItemInput>) => Promise<void>;
}) {
  return (
    <div className="row-actions">
      <QuickProgressActions item={item} onQuickUpdate={onQuickUpdate} />
      <button className={item.favorite ? "row-icon active" : "row-icon"} onClick={(event) => action(event, () => onToggleFavorite?.(item))} title="切換收藏">
        <Star size={15} fill={item.favorite ? "currentColor" : "none"} />
      </button>
      {onMetadata && (
        <button className="row-icon subtle-action" onClick={(event) => action(event, () => onMetadata(item))} title="補資料" aria-label="補資料">
          <Sparkles size={14} />
        </button>
      )}
      <button className="row-icon danger-button" onClick={(event) => action(event, () => onDelete?.(item.id))} title="刪除">
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function QuickProgressActions({ item, compact, onQuickUpdate }: { item: MediaItem; compact?: boolean; onQuickUpdate?: (item: MediaItem, patch: Partial<ItemInput>) => Promise<void> }) {
  if (!onQuickUpdate) return null;
  const progress = getWatchProgress(item);
  const current = Number(progress.current_episode || 0);
  const total = Number(progress.total_episodes || 0);
  const nextEpisode = total > 0 ? Math.min(total, current + 1) : current + 1;
  const completeEpisode = total > 0 ? total : Math.max(1, current);
  const size = compact ? 13 : 14;

  return (
    <span className={compact ? "quick-progress compact" : "quick-progress"} onClick={stop}>
      {isSeriesLike(item) && (
        <button className="row-icon" onClick={(event) => action(event, () => onQuickUpdate(item, updateWatchProgress(item, { watch_status: "watching", current_episode: nextEpisode, total_episodes: progress.total_episodes || null })))} title="下一集">
          <SkipForward size={size} />
        </button>
      )}
      <button className="row-icon" onClick={(event) => action(event, () => onQuickUpdate(item, updateWatchProgress(item, { watch_status: "completed", current_episode: completeEpisode, total_episodes: total || completeEpisode })))} title="標記看完">
        <CheckCircle2 size={size} />
      </button>
      <button className="row-icon" onClick={(event) => action(event, () => onQuickUpdate(item, updateWatchProgress(item, { watch_status: "paused" })))} title="暫停">
        <Pause size={size} />
      </button>
      <button className="row-icon" onClick={(event) => action(event, () => onQuickUpdate(item, updateWatchProgress(item, { watch_status: "dropped" })))} title="放棄">
        <Ban size={size} />
      </button>
      <button className="row-icon" onClick={(event) => action(event, () => onQuickUpdate(item, updateWatchProgress(item, { watch_status: "rewatching" })))} title="重看">
        <Repeat2 size={size} />
      </button>
    </span>
  );
}

function Tags({ tags, limit = 4 }: { tags: string[]; limit?: number }) {
  if (tags.length === 0) return <span className="muted-cell">-</span>;
  return (
    <span className="mini-tags">
      {tags.slice(0, limit).map((tag) => <span key={tag}>#{tag}</span>)}
      {tags.length > limit && <span>+{tags.length - limit}</span>}
    </span>
  );
}

function displayType(item: MediaItem, classification = classifyItem(item)) {
  return item.type || classification.type;
}

function compactTypeLabel(item: MediaItem) {
  const parts = [displayType(item), item.category, item.platform].filter(Boolean);
  return parts.join(" · ");
}

function tableProgressLabel(item: MediaItem) {
  const progress = getWatchProgress(item);
  const total = progress.total_episodes || (isSeriesLike(item) ? null : 1);
  const current = progress.current_episode || (getWatchStatus(item) === "completed" ? total || 1 : 0);
  if (total) return `${current} / ${total}`;
  if (current) return `${current} / ?`;
  return "-";
}

function coverInitial(item: MediaItem) {
  return (item.official_title || item.raw_title || "?").trim().slice(0, 1).toUpperCase();
}

function dateLabel(item: MediaItem) {
  if (isSmartAdd(item) && !item.watched_at && !item.completed_at && !item.started_at && !item.planned_at) return "未記日期";
  return displayDate(displayDateForItem(item));
}

function isSmartAdd(item: MediaItem) {
  if (!item.metadata_json) return false;
  try {
    return Boolean((JSON.parse(item.metadata_json) as { smart_add?: unknown }).smart_add);
  } catch {
    return false;
  }
}

function StatusPill({ item }: { item: MediaItem }) {
  const status = getWatchStatus(item);
  return <span className={`status-pill ${status}`}>{watchStatusLabel(status)}</span>;
}

function stop(event: MouseEvent) {
  event.stopPropagation();
}

function action(event: MouseEvent, fn?: () => void | Promise<void>) {
  event.stopPropagation();
  void fn?.();
}
