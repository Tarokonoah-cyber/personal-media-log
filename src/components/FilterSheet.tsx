import { SlidersHorizontal, X } from "lucide-react";
import type { ListFilters } from "../types";

const favoriteLevels = ["神作", "收藏", "一般", "雷片", "已刪"] as const;
const mediaStatuses = ["待觀看", "已觀看", "想重看", "已刪除"] as const;
const platforms = ["FC2", "JAV", "SWAG", "麻豆", "糖心", "自拍", "歐美", "其他"] as const;
const makers = ["S1", "SOD", "Prestige", "Moodyz", "FALENO", "其他片商"] as const;
const tags = ["高顏值", "素人感", "劇情好", "畫質差", "有碼", "無碼", "雷"] as const;

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
    <div className="filter-grid private-filter-grid">
      <Field label="搜尋" value={filters.query} onChange={(value) => onChange({ query: value })} placeholder="代號、女優、平台、片商、標籤、心得" />
      <Field label="作品代號" value={filters.codeQuery} onChange={(value) => onChange({ codeQuery: value })} placeholder="FC2PPV-2255291" />
      <Field label="女優 / 創作者" value={filters.person} onChange={(value) => onChange({ person: value })} />
      <Field label="系列 / 番號前綴" value={filters.series} onChange={(value) => onChange({ series: value })} placeholder="SSIS / IPZZ / FC2PPV" />
      <Field label="評分下限" value={filters.ratingMin} inputMode="decimal" onChange={(value) => onChange({ ratingMin: value })} />
      <Field label="評分上限" value={filters.ratingMax} inputMode="decimal" onChange={(value) => onChange({ ratingMax: value })} />
      <OptionSelect label="平台" value={filters.platform} options={platforms} onChange={(value) => onChange({ platform: value })} />
      <OptionSelect label="片商" value={filters.maker} options={makers} onChange={(value) => onChange({ maker: value })} />
      <OptionSelect label="收藏等級" value={filters.favoriteLevel || "all"} options={favoriteLevels} allLabel="全部" onChange={(value) => onChange({ favoriteLevel: value as ListFilters["favoriteLevel"] })} />
      <Select label="已使用" value={filters.usedFilter} options={["all", "used", "unused"]} labels={{ all: "全部", used: "已使用", unused: "未使用" }} onChange={(value) => onChange({ usedFilter: value as ListFilters["usedFilter"] })} />
      <OptionSelect label="狀態" value={filters.mediaStatus || "all"} options={mediaStatuses} allLabel="全部" onChange={(value) => onChange({ mediaStatus: value as ListFilters["mediaStatus"] })} />
      <Field label="年份" value={filters.year} inputMode="numeric" onChange={(value) => onChange({ year: value })} />
      <OptionSelect label="標籤" value={filters.tag} options={tags} onChange={(value) => onChange({ tag: value })} />
      <label className="check"><input type="checkbox" checked={Boolean(filters.unrated)} onChange={(event) => onChange({ unrated: event.target.checked })} />未評分</label>
    </div>
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
