import { CalendarDays, Edit3, Star, Trash2 } from "lucide-react";
import { MouseEvent } from "react";
import { displayDate } from "../lib/date";
import type { ItemInput, ItemStatus, MediaItem } from "../types";

type ListMode = "cards" | "organize";

export function ItemList({
  items,
  loading,
  mode,
  emptyMessage = "還沒有紀錄，先快速記一筆就好，不用完整。",
  onSelect,
  onToggleFavorite,
  onDelete,
  onQuickUpdate
}: {
  items: MediaItem[];
  loading: boolean;
  mode: ListMode;
  emptyMessage?: string;
  onSelect: (item: MediaItem) => void;
  onToggleFavorite?: (item: MediaItem) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onQuickUpdate?: (item: MediaItem, patch: Partial<ItemInput>) => Promise<void>;
}) {
  if (loading) return <div className="empty">讀取中，先喘一口氣。</div>;
  if (items.length === 0) return <div className="empty">{emptyMessage}</div>;

  return (
    <>
      {mode === "organize" && (
        <div className="table-wrap desktop-table">
          <table>
            <thead>
              <tr>
                <th>標題</th>
                <th>狀態</th>
                <th>分類</th>
                <th>平台</th>
                <th>評分</th>
                <th>日期</th>
                <th>收藏</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} onClick={() => onSelect(item)}>
                  <td>
                    <strong>{item.official_title || item.raw_title}</strong>
                    <small>{item.quick_note || item.code || item.tags.slice(0, 3).map((tag) => `#${tag}`).join(" ")}</small>
                  </td>
                  <td>
                    <select className="inline-control" value={item.status} onClick={stop} onChange={(event) => onQuickUpdate?.(item, { status: event.target.value as ItemStatus })}>
                      <option value="raw">待整理</option>
                      <option value="partial">部分整理</option>
                      <option value="complete">已整理</option>
                      <option value="archived">封存</option>
                    </select>
                  </td>
                  <td>{item.category || item.type || "未分類"}</td>
                  <td>{item.platform || "未設定"}</td>
                  <td>
                    <input
                      className="inline-rating"
                      defaultValue={item.rating ?? ""}
                      inputMode="decimal"
                      onClick={stop}
                      onBlur={(event) => onQuickUpdate?.(item, { rating: event.target.value ? Number(event.target.value) : null })}
                    />
                  </td>
                  <td>{displayDate(item.watched_at || item.created_at)}</td>
                  <td>
                    <button className={item.favorite ? "mini-action active" : "mini-action"} onClick={(event) => action(event, () => onToggleFavorite?.(item))} title="切換收藏">
                      <Star size={15} fill={item.favorite ? "currentColor" : "none"} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={mode === "organize" ? "card-list mobile-list" : "card-list"}>
        {items.map((item) => (
          <article className="media-card" key={item.id} onClick={() => onSelect(item)}>
            {item.cover_url ? <img className="media-cover" src={item.cover_url} alt="" /> : <TextCover item={item} />}
            <div className="media-content">
              <div className="media-title-row">
                <div>
                  <h3>{item.official_title || item.raw_title}</h3>
                  {item.official_title && item.raw_title !== item.official_title && <p>{item.raw_title}</p>}
                </div>
                <Rating item={item} />
              </div>
              <p className="media-note">{item.quick_note || item.long_note || item.category || "待整理，之後再補也可以"}</p>
              <div className="badge-row">
                <StatusBadge item={item} />
                {item.favorite && <span className="status-badge favorite"><Star size={13} fill="currentColor" />收藏</span>}
                <span className="date-badge"><CalendarDays size={13} />{displayDate(item.watched_at || item.created_at)}</span>
              </div>
              {item.tags.length > 0 && (
                <div className="chip-row">
                  {item.tags.slice(0, 5).map((tag) => <span className="chip" key={tag}>#{tag}</span>)}
                </div>
              )}
              <div className="card-actions">
                <button onClick={(event) => action(event, () => onSelect(item))}><Edit3 size={15} />編輯</button>
                <button className={item.favorite ? "active" : ""} onClick={(event) => action(event, () => onToggleFavorite?.(item))}><Star size={15} fill={item.favorite ? "currentColor" : "none"} />收藏</button>
                <button className="danger-button" onClick={(event) => action(event, () => onDelete?.(item.id))}><Trash2 size={15} />刪除</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function TextCover({ item }: { item: MediaItem }) {
  const title = item.official_title || item.raw_title;
  const initials = title.replace(/\s+/g, "").slice(0, 4);
  return (
    <div className="text-cover" data-tone={tone(title)}>
      <span>{initials}</span>
      <i>{item.category || item.type || item.platform || "MEDIA"}</i>
    </div>
  );
}

function Rating({ item }: { item: MediaItem }) {
  if (item.rating === null) return <span className="rating muted">未評</span>;
  return <span className="rating"><Star size={14} fill="currentColor" />{item.rating}</span>;
}

function StatusBadge({ item }: { item: MediaItem }) {
  const labels: Record<string, string> = { raw: "待整理", partial: "部分整理", complete: "已整理", archived: "封存", deleted: "刪除" };
  return <span className={`status-badge ${item.status}`}>{labels[item.status] || item.status}</span>;
}

function tone(title: string) {
  const code = Array.from(title).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return String((code % 5) + 1);
}

function stop(event: MouseEvent) {
  event.stopPropagation();
}

function action(event: MouseEvent, fn?: () => void | Promise<void>) {
  event.stopPropagation();
  void fn?.();
}
