import { Star, Trash2 } from "lucide-react";
import { MouseEvent } from "react";
import { displayDate } from "../lib/date";
import type { ItemInput, ItemStatus, MediaItem } from "../types";

export function ItemList({
  items,
  loading,
  emptyMessage = "還沒有紀錄。先在上方快速新增一筆，不用完整。",
  onSelect,
  onToggleFavorite,
  onDelete,
  onQuickUpdate
}: {
  items: MediaItem[];
  loading: boolean;
  emptyMessage?: string;
  onSelect: (item: MediaItem) => void;
  onToggleFavorite?: (item: MediaItem) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
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
              <th className="title-col">標題</th>
              <th>評分</th>
              <th>類型</th>
              <th>標籤</th>
              <th>狀態</th>
              <th>收藏</th>
              <th>日期</th>
              <th>備註摘要</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
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
                  <input
                    className="inline-type"
                    defaultValue={item.type || item.category || ""}
                    placeholder="未分類"
                    onClick={stop}
                    onBlur={(event) => onQuickUpdate?.(item, { type: event.target.value || null })}
                  />
                </td>
                <td><Tags tags={item.tags} /></td>
                <td>
                  <select className="inline-status" value={item.status} onClick={stop} onChange={(event) => onQuickUpdate?.(item, { status: event.target.value as ItemStatus })}>
                    <option value="raw">待整理</option>
                    <option value="partial">部分整理</option>
                    <option value="complete">已整理</option>
                    <option value="archived">封存</option>
                  </select>
                </td>
                <td>
                  <button className={item.favorite ? "row-icon active" : "row-icon"} onClick={(event) => action(event, () => onToggleFavorite?.(item))} title="切換收藏">
                    <Star size={15} fill={item.favorite ? "currentColor" : "none"} />
                  </button>
                </td>
                <td className="muted-cell">{displayDate(item.watched_at || item.created_at)}</td>
                <td className="note-cell">{item.quick_note || item.long_note || ""}</td>
                <td>
                  <button className="row-icon danger-button" onClick={(event) => action(event, () => onDelete?.(item.id))} title="刪除">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
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
                <span>{item.type || item.category || "未分類"}</span>
                <span>{displayDate(item.watched_at || item.created_at)}</span>
              </div>
              {(item.tags.length > 0 || item.quick_note || item.long_note) && (
                <div className="compact-sub">
                  <Tags tags={item.tags} />
                  <span>{item.quick_note || item.long_note || ""}</span>
                </div>
              )}
            </div>
            <div className="compact-actions">
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
  const labels: Record<ItemStatus, string> = { raw: "待整理", partial: "部分", complete: "已整理", archived: "封存", deleted: "刪除" };
  return <span className={`status-pill ${status}`}>{labels[status]}</span>;
}

function stop(event: MouseEvent) {
  event.stopPropagation();
}

function action(event: MouseEvent, fn?: () => void | Promise<void>) {
  event.stopPropagation();
  void fn?.();
}
