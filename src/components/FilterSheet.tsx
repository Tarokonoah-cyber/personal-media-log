import { SlidersHorizontal, X } from "lucide-react";
import type { ListFilters } from "../types";

export function FilterSheet({
  open,
  filters,
  privateMode = false,
  onChange,
  onClose
}: {
  open: boolean;
  filters: ListFilters;
  privateMode?: boolean;
  onChange: (patch: Partial<ListFilters>) => void;
  onClose: () => void;
}) {
  return (
    <div className={open ? "filter-sheet open" : "filter-sheet"} onClick={onClose}>
      <div className="filter-sheet-panel" onClick={(event) => event.stopPropagation()}>
        <header className="sheet-head">
          <span><SlidersHorizontal size={18} />{privateMode ? "私密篩選" : "進階篩選"}</span>
          <button className="ghost-icon" onClick={onClose} aria-label="關閉篩選"><X size={18} /></button>
        </header>
        {privateMode ? (
          <PrivateFilters filters={filters} onChange={onChange} />
        ) : (
          <GeneralFilters filters={filters} onChange={onChange} />
        )}
      </div>
    </div>
  );
}

function GeneralFilters({ filters, onChange }: { filters: ListFilters; onChange: (patch: Partial<ListFilters>) => void }) {
  return (
    <div className="filter-grid">
      <label>
        狀態
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
        日期起
        <input value={filters.watchedFrom} onChange={(event) => onChange({ watchedFrom: event.target.value })} type="date" />
      </label>
      <label>
        日期迄
        <input value={filters.watchedTo} onChange={(event) => onChange({ watchedTo: event.target.value })} type="date" />
      </label>
      <label className="check"><input type="checkbox" checked={filters.favorite} onChange={(event) => onChange({ favorite: event.target.checked })} />只看收藏</label>
      <label className="check"><input type="checkbox" checked={filters.highRated} onChange={(event) => onChange({ highRated: event.target.checked })} />高分</label>
    </div>
  );
}

function PrivateFilters({ filters, onChange }: { filters: ListFilters; onChange: (patch: Partial<ListFilters>) => void }) {
  return (
    <div className="filter-grid private-filter-grid">
      <label>
        番號關鍵字
        <input value={filters.codeQuery} onChange={(event) => onChange({ codeQuery: event.target.value })} placeholder="例如 SSIS-001" />
      </label>
      <label>
        片名關鍵字
        <input value={filters.titleQuery} onChange={(event) => onChange({ titleQuery: event.target.value })} placeholder="輸入片名..." />
      </label>
      <label>
        女優 / 演員
        <input value={filters.person} onChange={(event) => onChange({ person: event.target.value })} placeholder="輸入名稱..." />
      </label>
      <label>
        片商
        <input value={filters.studio} onChange={(event) => onChange({ studio: event.target.value, platform: event.target.value })} placeholder="輸入片商..." />
      </label>
      <label>
        發售年份
        <input value={filters.year} onChange={(event) => onChange({ year: event.target.value })} inputMode="numeric" placeholder="2026" />
      </label>
      <label>
        類型
        <input value={filters.type} onChange={(event) => onChange({ type: event.target.value })} placeholder="企劃、劇情、素人..." />
      </label>
      <label>
        標籤
        <input value={filters.tag} onChange={(event) => onChange({ tag: event.target.value })} placeholder="輸入私密標籤..." />
      </label>
      <label>
        更新日期起
        <input value={filters.updatedFrom} onChange={(event) => onChange({ updatedFrom: event.target.value })} type="date" />
      </label>
      <label>
        更新日期迄
        <input value={filters.updatedTo} onChange={(event) => onChange({ updatedTo: event.target.value })} type="date" />
      </label>
      <label className="check"><input type="checkbox" checked={filters.favorite} onChange={(event) => onChange({ favorite: event.target.checked })} />只看收藏</label>
      <label className="check"><input type="checkbox" checked={filters.highRated} onChange={(event) => onChange({ highRated: event.target.checked })} />高分</label>
    </div>
  );
}
