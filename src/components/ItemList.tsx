import { Sparkles, Star, Trash2 } from "lucide-react";
import { MouseEvent } from "react";
import { displayDate } from "../lib/date";
import { classifyItem } from "../lib/taxonomy";
import type { ItemInput, ItemStatus, MediaItem } from "../types";

export function ItemList({
  items,
  loading,
  emptyMessage = "還沒有紀錄。先在上方快速新增一筆，不用完整。",
  onSelect,
  onToggleFavorite,
  onDelete,
  onMetadata,
  onQuickUpdate
}: {
  items: MediaItem[];
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

  return (
    <>
      <div className="database-table-wrap">
        <table className="database-table">
          <thead>
            <tr>
              <th className="title-col">Title</th>
              <th>Rating</th>
              <th>Type</th>
              <th>Category</th>
              <th>Tags</th>
              <th>Status</th>
              <th>Favorite</th>
              <th>Date</th>
              <th>Note</th>
              <th>Actions</th>
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
                    <input
                      className="inline-rating"
                      defaultValue={item.rating ?? ""}
                      inputMode="decimal"
                      onClick={stop}
                      onBlur={(event) => onQuickUpdate?.(item, { rating: event.target.value ? Number(event.target.value) : null })}
                    />
                  </td>
                  <td>
                    <select className="inline-type" value={classification.type} onClick={stop} onChange={(event) => onQuickUpdate?.(item, { type: event.target.value })}>
                      <option value="Movie">Movie</option>
                      <option value="Series">Series</option>
                      <option value="Anime">Anime</option>
                      <option value="YouTube">YouTube</option>
                      <option value="Other">Other</option>
                    </select>
                  </td>
                  <td className="muted-cell">{classification.category || "-"}</td>
                  <td><Tags tags={item.tags} /></td>
                  <td>
                    <select className="inline-status" value={item.status} onClick={stop} onChange={(event) => onQuickUpdate?.(item, { status: event.target.value as ItemStatus })}>
                      <option value="raw">Inbox</option>
                      <option value="partial">Partial</option>
                      <option value="complete">Done</option>
                      <option value="archived">Archived</option>
                    </select>
                  </td>
                  <td>
                    <button className={item.favorite ? "row-icon active" : "row-icon"} onClick={(event) => action(event, () => onToggleFavorite?.(item))} title="Toggle favorite">
                      <Star size={15} fill={item.favorite ? "currentColor" : "none"} />
                    </button>
                  </td>
                  <td className="muted-cell">{displayDate(item.watched_at || item.created_at)}</td>
                  <td className="note-cell">{item.quick_note || item.long_note || ""}</td>
                  <td>
                  <button className="row-icon danger-button" onClick={(event) => action(event, () => onDelete?.(item.id))} title="Delete">
                    <Trash2 size={15} />
                  </button>
                  <button className="row-action" onClick={(event) => action(event, () => onMetadata?.(item))} title="補資料">
                    <Sparkles size={14} />
                    補資料
                  </button>
                </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="compact-list">
        {items.map((item) => (
          <article className="compact-row" key={item.id} onClick={() => onSelect(item)}>
            <div className="compact-main">
              <div className="compact-title">
                <strong>{item.official_title || item.raw_title}</strong>
                {item.favorite && <Star size={13} fill="currentColor" />}
              </div>
              <div className="compact-meta">
                <span>{item.rating ?? "未評"}</span>
                <Status status={item.status} />
                <span>{displayDate(item.watched_at || item.created_at)}</span>
              </div>
            </div>
            <div className="compact-actions">
              <button className="row-icon" onClick={(event) => action(event, () => onMetadata?.(item))} title="補資料">
                <Sparkles size={15} />
              </button>
              <button className={item.favorite ? "row-icon active" : "row-icon"} onClick={(event) => action(event, () => onToggleFavorite?.(item))} title="切換收藏">
                <Star size={15} fill={item.favorite ? "currentColor" : "none"} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
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

function Status({ status }: { status: ItemStatus }) {
  const labels: Record<ItemStatus, string> = { raw: "Inbox", partial: "Partial", complete: "Done", archived: "Archived", deleted: "Deleted" };
  return <span className={`status-pill ${status}`}>{labels[status]}</span>;
}

function stop(event: MouseEvent) {
  event.stopPropagation();
}

function action(event: MouseEvent, fn?: () => void | Promise<void>) {
  event.stopPropagation();
  void fn?.();
}
