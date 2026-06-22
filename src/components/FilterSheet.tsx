import { SlidersHorizontal, X } from "lucide-react";
import type { ListFilters } from "../types";

export function FilterSheet({
  open,
  filters,
  onChange,
  onClose
}: {
  open: boolean;
  filters: ListFilters;
  onChange: (patch: Partial<ListFilters>) => void;
  onClose: () => void;
}) {
  return (
    <div className={open ? "filter-sheet open" : "filter-sheet"}>
      <div className="filter-sheet-panel">
        <header className="sheet-head">
          <span><SlidersHorizontal size={18} />篩選</span>
          <button className="ghost-icon" onClick={onClose} aria-label="關閉篩選"><X size={18} /></button>
        </header>
        <div className="filter-grid">
          <label>
            整理狀態
            <select value={filters.status} onChange={(event) => onChange({ status: event.target.value as ListFilters["status"] })}>
              <option value="all">全部</option>
              <option value="inbox">待整理</option>
              <option value="raw">原始</option>
              <option value="partial">部分整理</option>
              <option value="organized">已整理</option>
              <option value="complete">完成</option>
            </select>
          </label>
          <label>
            類型
            <input value={filters.type} onChange={(event) => onChange({ type: event.target.value })} placeholder="電影、影集、動畫..." />
          </label>
          <label>
            標籤
            <input value={filters.tag} onChange={(event) => onChange({ tag: event.target.value })} placeholder="輸入標籤..." />
          </label>
          <label>
            平台
            <input value={filters.platform} onChange={(event) => onChange({ platform: event.target.value })} placeholder="Netflix、YouTube..." />
          </label>
          <label>
            年份
            <input value={filters.year} onChange={(event) => onChange({ year: event.target.value })} inputMode="numeric" placeholder="2026" />
          </label>
          <label>
            起始日期
            <input value={filters.watchedFrom} onChange={(event) => onChange({ watchedFrom: event.target.value })} type="date" />
          </label>
          <label>
            結束日期
            <input value={filters.watchedTo} onChange={(event) => onChange({ watchedTo: event.target.value })} type="date" />
          </label>
          <label className="check"><input type="checkbox" checked={filters.favorite} onChange={(event) => onChange({ favorite: event.target.checked })} />只看收藏</label>
          <label className="check"><input type="checkbox" checked={filters.highRated} onChange={(event) => onChange({ highRated: event.target.checked })} />高評分</label>
        </div>
      </div>
    </div>
  );
}
