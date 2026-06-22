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
          <span><SlidersHorizontal size={18} />Filter</span>
          <button className="ghost-icon" onClick={onClose} aria-label="Close filter"><X size={18} /></button>
        </header>
        <div className="filter-grid">
          <label>
            Legacy Status
            <select value={filters.status} onChange={(event) => onChange({ status: event.target.value as ListFilters["status"] })}>
              <option value="all">All</option>
              <option value="inbox">Inbox</option>
              <option value="raw">Raw</option>
              <option value="partial">Partial</option>
              <option value="organized">Organized</option>
              <option value="complete">Complete</option>
            </select>
          </label>
          <label>
            Type
            <input value={filters.type} onChange={(event) => onChange({ type: event.target.value })} placeholder="Movie, Series, Anime..." />
          </label>
          <label>
            Tag
            <input value={filters.tag} onChange={(event) => onChange({ tag: event.target.value })} placeholder="Search a tag..." />
          </label>
          <label>
            Platform
            <input value={filters.platform} onChange={(event) => onChange({ platform: event.target.value })} placeholder="Netflix, YouTube..." />
          </label>
          <label>
            Year
            <input value={filters.year} onChange={(event) => onChange({ year: event.target.value })} inputMode="numeric" placeholder="2026" />
          </label>
          <label>
            From
            <input value={filters.watchedFrom} onChange={(event) => onChange({ watchedFrom: event.target.value })} type="date" />
          </label>
          <label>
            To
            <input value={filters.watchedTo} onChange={(event) => onChange({ watchedTo: event.target.value })} type="date" />
          </label>
          <label className="check"><input type="checkbox" checked={filters.favorite} onChange={(event) => onChange({ favorite: event.target.checked })} />Favorites</label>
          <label className="check"><input type="checkbox" checked={filters.highRated} onChange={(event) => onChange({ highRated: event.target.checked })} />High rated</label>
        </div>
      </div>
    </div>
  );
}
