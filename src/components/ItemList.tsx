import { Sparkles, Star, Trash2 } from "lucide-react";
import { MouseEvent } from "react";
import { displayDate } from "../lib/date";
import { classifyItem, libraryTree } from "../lib/taxonomy";
import { displayDateForItem, getWatchStatus, isSeriesLike, progressLabel, updateWatchProgress, watchStatusLabel, watchStatuses } from "../lib/watch";
import type { ItemInput, MediaItem, WatchStatus } from "../types";

const typeOptions = libraryTree.map((entry) => entry.label);

export function ItemList({
  items,
  view,
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
  loading: boolean;
  emptyMessage?: string;
  onSelect: (item: MediaItem) => void;
  onToggleFavorite?: (item: MediaItem) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onMetadata?: (item: MediaItem) => void;
  onQuickUpdate?: (item: MediaItem, patch: Partial<ItemInput>) => Promise<void>;
}) {
  if (loading) return <div className="empty">讀取中...</div>;
  if (items.length === 0) return <div className="empty">{emptyMessage}</div>;
  if (view === "poster") return <PosterWall items={items} onSelect={onSelect} />;

  return (
    <>
      {view === "table" && (
        <div className="database-table-wrap">
          <table className="database-table">
            <thead>
              <tr>
                <th className="title-col">標題</th>
                <th>類型</th>
                <th>觀看狀態</th>
                <th>進度</th>
                <th>評分</th>
                <th>分類 / 地區</th>
                <th>平台</th>
                <th>標籤</th>
                <th>年份</th>
                <th>日期</th>
                <th>收藏</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const classification = classifyItem(item);
                return (
                  <tr key={item.id} onClick={() => onSelect(item)}>
                    <td className="title-cell">
                      <strong>{item.official_title || item.raw_title}</strong>
                      {item.code && <small>{item.code}</small>}
                    </td>
                    <td>
                      <select className="inline-type" value={classification.type} onClick={stop} onChange={(event) => onQuickUpdate?.(item, { type: event.target.value })}>
                        {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </td>
                    <td><WatchStatusSelect item={item} onQuickUpdate={onQuickUpdate} /></td>
                    <td className="muted-cell">{progressLabel(item) || "-"}</td>
                    <td><RatingStars item={item} onQuickUpdate={onQuickUpdate} /></td>
                    <td className="muted-cell">{classification.category || "-"}</td>
                    <td className="muted-cell">{item.platform || "-"}</td>
                    <td><Tags tags={item.tags} /></td>
                    <td className="muted-cell">{item.release_year || "-"}</td>
                    <td className="muted-cell">{displayDate(displayDateForItem(item))}</td>
                    <td>
                      <button className={item.favorite ? "row-icon active" : "row-icon"} onClick={(event) => action(event, () => onToggleFavorite?.(item))} title="切換收藏">
                        <Star size={15} fill={item.favorite ? "currentColor" : "none"} />
                      </button>
                    </td>
                    <td>
                      <RowActions item={item} onDelete={onDelete} onMetadata={onMetadata} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
                <span>{classifyItem(item).type}</span>
                <StatusPill item={item} />
                {progressLabel(item) && <span>{progressLabel(item)}</span>}
                <span>{displayDate(displayDateForItem(item))}</span>
              </div>
            </div>
            <div className="compact-actions">
              <RatingStars item={item} onQuickUpdate={onQuickUpdate} compact />
              <button className="row-icon" onClick={(event) => action(event, () => onMetadata?.(item))} title="補資料">
                <Sparkles size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
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
            <em>{item.rating ? `${item.rating}/5` : "尚未評分"}{isSeriesLike(item) && progressLabel(item) ? ` · ${progressLabel(item)}` : ""}</em>
          </span>
        </button>
      ))}
    </div>
  );
}

function WatchStatusSelect({ item, onQuickUpdate }: { item: MediaItem; onQuickUpdate?: (item: MediaItem, patch: Partial<ItemInput>) => Promise<void> }) {
  return (
    <select
      className="inline-status"
      value={getWatchStatus(item)}
      onClick={stop}
      onChange={(event) => onQuickUpdate?.(item, updateWatchProgress(item, { watch_status: event.target.value as WatchStatus }))}
    >
      {watchStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
    </select>
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

function RowActions({ item, onDelete, onMetadata }: { item: MediaItem; onDelete?: (id: string) => Promise<void>; onMetadata?: (item: MediaItem) => void }) {
  return (
    <div className="row-actions">
      <button className="row-icon danger-button" onClick={(event) => action(event, () => onDelete?.(item.id))} title="刪除">
        <Trash2 size={15} />
      </button>
      <button className="row-action" onClick={(event) => action(event, () => onMetadata?.(item))} title="補資料">
        <Sparkles size={14} />
        補資料
      </button>
    </div>
  );
}

function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="muted-cell">-</span>;
  return (
    <span className="mini-tags">
      {tags.slice(0, 4).map((tag) => <span key={tag}>#{tag}</span>)}
    </span>
  );
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
