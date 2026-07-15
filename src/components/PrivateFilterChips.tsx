import { X } from "lucide-react";
import { privateFilterChips } from "../lib/privateFilterChips";
import type { ListFilters } from "../types";

export function PrivateFilterChips({ filters, onPatch, onClear }: { filters: ListFilters; onPatch: (patch: Partial<ListFilters>) => void; onClear: () => void }) {
  const chips = privateFilterChips(filters);
  if (chips.length === 0) return null;
  return (
    <div className="private-filter-chip-row" aria-label="目前篩選條件">
      {chips.map((chip) => (
        <button key={chip.key} className="private-filter-chip" onClick={() => onPatch(chip.patch)} title={`移除 ${chip.label}`}>
          <span>{chip.label}</span><X size={13} aria-hidden="true" />
        </button>
      ))}
      <button className="filter-chip-clear" onClick={onClear}>全部清除</button>
    </div>
  );
}
