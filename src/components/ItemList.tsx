import { Calendar, Star } from "lucide-react";
import type { MediaItem } from "../types";

export function ItemList({ items, loading, mode, onSelect }: { items: MediaItem[]; loading: boolean; mode: "log" | "organize"; onSelect: (item: MediaItem) => void }) {
  if (loading) return <div className="empty">讀取中</div>;
  if (items.length === 0) return <div className="empty">沒有資料</div>;

  return mode === "organize" ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>標題</th>
            <th>狀態</th>
            <th>分類</th>
            <th>平台</th>
            <th>評分</th>
            <th>觀看日</th>
            <th>標籤</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} onClick={() => onSelect(item)}>
              <td>
                <strong>{item.official_title || item.raw_title}</strong>
                {item.code && <small>{item.code}</small>}
              </td>
              <td>{statusLabel(item.status)}</td>
              <td>{item.category || item.type || "未分類"}</td>
              <td>{item.platform || "未設定"}</td>
              <td>{item.rating ?? "-"}</td>
              <td>{item.watched_at || "-"}</td>
              <td>{item.tags.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="card-list">
      {items.map((item) => (
        <button className="item-card" key={item.id} onClick={() => onSelect(item)}>
          {item.cover_url ? <img src={item.cover_url} alt="" /> : <TextCover item={item} />}
          <span className="item-body">
            <span className="item-title">{item.official_title || item.raw_title}</span>
            <span className="item-note">{item.quick_note || item.long_note || item.category || "待整理"}</span>
            <span className="item-meta">
              {item.favorite && <Star size={14} fill="currentColor" />}
              {item.rating !== null && <b>{item.rating}</b>}
              {item.watched_at && <><Calendar size={14} />{item.watched_at}</>}
              <em>{statusLabel(item.status)}</em>
            </span>
            {item.tags.length > 0 && <span className="tag-row">{item.tags.slice(0, 4).map((tag) => <i key={tag}>#{tag}</i>)}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

function TextCover({ item }: { item: MediaItem }) {
  const title = item.official_title || item.raw_title;
  return <span className="text-cover">{title.slice(0, 8)}</span>;
}

function statusLabel(status: string) {
  return ({ raw: "待整理", partial: "部分", complete: "完成", archived: "封存", deleted: "刪除" } as Record<string, string>)[status] || status;
}
