import { SlidersHorizontal, X } from "lucide-react";
import { PRIVATE_TAG_PRESETS } from "../lib/tagPresets";
import type { ListFilters } from "../types";

const mediaStatuses = ["待觀看", "已觀看", "想重看", "已刪除"] as const;

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
          <span><SlidersHorizontal size={18} />{privateMode ? "私密進階篩選" : "進階篩選"}</span>
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
      <Select label="狀態" value={filters.status} onChange={(value) => onChange({ status: value as ListFilters["status"] })} options={["all", "inbox", "raw", "partial", "organized", "complete"]} />
      <Field label="類型" value={filters.type} onChange={(value) => onChange({ type: value })} />
      <Field label="分類" value={filters.category || ""} onChange={(value) => onChange({ category: value })} />
      <Field label="標籤" value={filters.tag} onChange={(value) => onChange({ tag: value })} />
      <Field label="平台" value={filters.platform} onChange={(value) => onChange({ platform: value })} />
      <Field label="年份" value={filters.year} inputMode="numeric" onChange={(value) => onChange({ year: value })} />
      <Field label="觀看起日" value={filters.watchedFrom} type="date" onChange={(value) => onChange({ watchedFrom: value })} />
      <Field label="觀看迄日" value={filters.watchedTo} type="date" onChange={(value) => onChange({ watchedTo: value })} />
      <label className="check"><input type="checkbox" checked={filters.favorite} onChange={(event) => onChange({ favorite: event.target.checked })} />收藏</label>
      <label className="check"><input type="checkbox" checked={filters.highRated} onChange={(event) => onChange({ highRated: event.target.checked })} />高分</label>
    </div>
  );
}

function PrivateFilters({ filters, onChange }: { filters: ListFilters; onChange: (patch: Partial<ListFilters>) => void }) {
  return (
    <>
      <div className="filter-grid private-filter-grid">
        <Field label="搜尋" value={filters.query} onChange={(value) => onChange({ query: value })} placeholder="代號、女優、平台、片商、標籤、心得" />
        <Field label="作品代號" value={filters.codeQuery} onChange={(value) => onChange({ codeQuery: value })} placeholder="FC2PPV-2255291" />
        <Field label="系列 / 番號前綴" value={filters.series} onChange={(value) => onChange({ series: value })} placeholder="SSIS / IPZZ / FC2PPV" />
        <Field label="評分下限" value={filters.ratingMin} inputMode="decimal" onChange={(value) => onChange({ ratingMin: value, unrated: false })} />
        <Field label="評分上限" value={filters.ratingMax} inputMode="decimal" onChange={(value) => onChange({ ratingMax: value, unrated: false })} />
        <Select label="狀態" value={filters.usedFilter} options={["all", "used", "unused"]} labels={{ all: "全部", used: "完成", unused: "待處理" }} onChange={(value) => onChange({ usedFilter: value as ListFilters["usedFilter"] })} />
        <OptionSelect label="狀態" value={filters.mediaStatus || "all"} options={mediaStatuses} allLabel="全部" onChange={(value) => onChange({ mediaStatus: value as ListFilters["mediaStatus"] })} />
        <Field label="年份" value={filters.year} inputMode="numeric" onChange={(value) => onChange({ year: value })} />
        <OptionSelect label="標籤" value={filters.tag} options={PRIVATE_TAG_PRESETS} onChange={(value) => onChange({ tag: value })} />
        <Select label="心得" value={filters.hasNote || "all"} options={["all", "yes", "no"]} labels={{ all: "全部", yes: "有心得", no: "無心得" }} onChange={(value) => onChange({ hasNote: value as ListFilters["hasNote"] })} />
        <Select label="封面" value={filters.hasCover || "all"} options={["all", "yes", "no"]} labels={{ all: "全部", yes: "有封面", no: "無封面" }} onChange={(value) => onChange({ hasCover: value as ListFilters["hasCover"] })} />
        <label className="check"><input type="checkbox" checked={Boolean(filters.unrated)} onChange={(event) => onChange({ unrated: event.target.checked, ratingMin: "", ratingMax: "" })} />未評分</label>
      </div>
    </>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; inputMode?: "numeric" | "decimal" }) {
  return (
    <label>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} inputMode={inputMode} />
    </label>
  );
}

function Select({ label, value, options, labels, onChange }: { label: string; value: string; options: readonly string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{labels?.[option] || option}</option>)}
      </select>
    </label>
  );
}

function OptionSelect<T extends string>({ label, value, options, allLabel = "不限", onChange }: { label: string; value: string; options: readonly T[]; allLabel?: string; onChange: (value: "" | T | "all") => void }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value as "" | T | "all")}>
        <option value={label === "收藏等級" || label === "狀態" ? "all" : ""}>{allLabel}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
