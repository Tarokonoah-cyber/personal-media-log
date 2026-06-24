import { Plus, RotateCcw, Sparkles, Star, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { displayDate } from "../lib/date";
import { privateItemDetails } from "../lib/privacy";
import { classifyItem, libraryTree } from "../lib/taxonomy";
import { displayDateForItem, getWatchProgress, getWatchStatus, isSeriesLike, progressLabel, watchStatusLabel } from "../lib/watch";
import type { ItemInput, MediaItem } from "../types";

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
  onQuickUpdate
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
}) {
  const storageKey = `${columnStoragePrefix}:${privateMode ? "private" : "public"}:${columnScope}`;
  const customStorageKey = `${customColumnStoragePrefix}:${privateMode ? "private" : "public"}:${columnScope}`;
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

  useEffect(() => {
    const available = new Set(allColumns.map((column) => column.id));
    const stored = loadStoredColumns(storageKey, available);
    setSelectedColumnIds(stored.length > 0 ? stored : defaultColumnIds.filter((id) => available.has(id)));
  }, [allColumns, defaultColumnIds, storageKey]);

  useEffect(() => {
    setCustomColumns(loadCustomColumns(customStorageKey));
  }, [customStorageKey]);

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
  if (items.length === 0) return <div className="empty">{emptyMessage}</div>;
  if (view === "poster") return <PosterWall items={items} onSelect={onSelect} />;

  return (
    <>
      {view === "table" && (
        <DataTable
          items={items}
          density={density}
          privateMode={privateMode}
          columns={visibleColumns}
          onSelect={onSelect}
        />
      )}

      <div className={view === "list" ? "compact-list force-list" : "compact-list"}>
        {items.map((item) => (
          <article className="compact-row" key={item.id} onClick={() => onSelect(item)}>
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

function DataTable({
  items,
  density,
  privateMode,
  columns,
  onSelect
}: {
  items: MediaItem[];
  density: "comfortable" | "standard" | "compact";
  privateMode: boolean;
  columns: ColumnDef[];
  onSelect: (item: MediaItem) => void;
}) {
  return (
    <div className={`database-table-wrap ${privateMode ? "private-table-wrap" : ""} density-${density}`}>
      <table className={privateMode ? "database-table private-table" : "database-table"}>
        <colgroup>
          {columns.map((column) => <col key={column.id} className={column.colClassName} />)}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} className={column.headerClassName}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} onClick={() => onSelect(item)}>
              {columns.map((column) => (
                <td key={column.id} className={column.cellClassName}>{column.render(item)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    { id: "tags", label: "標籤", colClassName: "general-tags-col", render: (item) => <Tags tags={item.tags} /> },
    { id: "updated", label: "更新日", colClassName: "general-updated-col", cellClassName: "muted-cell", render: dateLabel },
    {
      id: "actions",
      label: "更多操作",
      colClassName: "general-actions-col",
      render: (item) => <RowActions item={item} onToggleFavorite={onToggleFavorite} onDelete={onDelete} onMetadata={onMetadata} />
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
  if (privateMode) return ["code", "title", "performers", "studio", "year", "rating", "tags"];
  if (scope.includes("電影")) return ["title", "year", "status", "platform", "rating", "tags", "updated", "actions"];
  if (scope.includes("影集") || scope.includes("動畫")) return ["title", "year", "status", "progress", "platform", "rating", "tags", "updated", "actions"];
  if (scope.includes("YouTube")) return ["title", "status", "platform", "rating", "tags", "updated", "actions"];
  if (scope.includes("其他")) return ["title", "type", "status", "rating", "tags", "updated", "actions"];
  return ["title", "type", "year", "status", "progress", "platform", "rating", "tags", "updated", "actions"];
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
  if (scope === "completed") return "已完成";
  if (scope === "favorites") return "收藏";
  return scope;
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
  onMetadata
}: {
  item: MediaItem;
  onToggleFavorite?: (item: MediaItem) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onMetadata?: (item: MediaItem) => void;
}) {
  return (
    <div className="row-actions">
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
