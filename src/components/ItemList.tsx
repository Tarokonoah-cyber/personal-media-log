import { Sparkles, Star, Trash2 } from "lucide-react";
import { MouseEvent } from "react";
import { displayDate } from "../lib/date";
import { privateItemDetails } from "../lib/privacy";
import { classifyItem, libraryTree } from "../lib/taxonomy";
import { displayDateForItem, getWatchProgress, getWatchStatus, isSeriesLike, progressLabel, watchStatusLabel } from "../lib/watch";
import type { ItemInput, MediaItem } from "../types";

const typeOptions: string[] = libraryTree.map((entry) => entry.label);

export function ItemList({
  items,
  view,
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
  if (loading) return <div className="empty">讀取中...</div>;
  if (items.length === 0) return <div className="empty">{emptyMessage}</div>;
  if (view === "poster") return <PosterWall items={items} onSelect={onSelect} />;

  return (
    <>
      {view === "table" && privateMode && (
        <PrivateTable items={items} density={density} onSelect={onSelect} />
      )}

      {view === "table" && !privateMode && (
        <div className={`database-table-wrap density-${density}`}>
          <table className="database-table">
            <thead>
              <tr>
                <th className="title-col">標題</th>
                <th>類型</th>
                <th>年份</th>
                <th>狀態</th>
                <th>進度</th>
                <th>平台</th>
                <th>評分</th>
                <th>標籤</th>
                <th>更新日</th>
                <th>更多操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const classification = classifyItem(item);
                return (
                  <tr key={item.id} onClick={() => onSelect(item)}>
                    <td className="title-cell">
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
                    </td>
                    <td>
                      <select className="inline-type" value={displayType(item, classification)} onClick={stop} onChange={(event) => onQuickUpdate?.(item, { type: event.target.value })}>
                        {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                        {!typeOptions.includes(displayType(item, classification)) && <option value={displayType(item, classification)}>{displayType(item, classification)}</option>}
                      </select>
                    </td>
                    <td className="muted-cell">{item.release_year || "-"}</td>
                    <td><StatusPill item={item} /></td>
                    <td className="muted-cell">{tableProgressLabel(item)}</td>
                    <td><PlatformBadge platform={item.platform} /></td>
                    <td><RatingValue item={item} /></td>
                    <td><Tags tags={item.tags} /></td>
                    <td className="muted-cell">{dateLabel(item)}</td>
                    <td>
                      <RowActions item={item} onToggleFavorite={onToggleFavorite} onDelete={onDelete} onMetadata={onMetadata} />
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
            <em>{item.rating ? `★ ${Number(item.rating).toFixed(1)}` : "尚未評分"}{isSeriesLike(item) && progressLabel(item) ? ` · ${progressLabel(item)}` : ""}</em>
          </span>
        </button>
      ))}
    </div>
  );
}

function PrivateTable({
  items,
  density,
  onSelect
}: {
  items: MediaItem[];
  density: "comfortable" | "standard" | "compact";
  onSelect: (item: MediaItem) => void;
}) {
  return (
    <div className={`database-table-wrap private-table-wrap density-${density}`}>
      <table className="database-table private-table">
        <colgroup>
          <col className="private-code-col" />
          <col className="private-title-col" />
          <col className="private-performer-col" />
          <col className="private-studio-col" />
          <col className="private-year-col" />
          <col className="private-rating-col" />
          <col className="private-tags-col" />
        </colgroup>
        <thead>
          <tr>
            <th>番號</th>
            <th>片名</th>
            <th>女優・演員</th>
            <th>片商</th>
            <th>年份</th>
            <th>評分</th>
            <th>標籤</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const details = privateItemDetails(item);
            return (
              <tr key={item.id} onClick={() => onSelect(item)}>
                <td className="private-code-cell">{details.code}</td>
                <td className="private-title-cell">
                  <strong title={details.title}>{details.title}</strong>
                </td>
                <td className="private-text-cell" title={details.performers}>{details.performers}</td>
                <td className="private-text-cell" title={details.studio}>{details.studio}</td>
                <td className="muted-cell private-year-cell">{details.releaseYear}</td>
                <td><RatingValue item={item} /></td>
                <td><Tags tags={item.tags} limit={4} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
