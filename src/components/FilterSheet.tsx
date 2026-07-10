import { SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ListFilters, PrivateFacetItem, PrivateFacets } from "../types";

const favoriteLevels = ["神作", "收藏", "一般", "雷片", "已刪"] as const;
const mediaStatuses = ["待觀看", "已觀看", "想重看", "已刪除"] as const;
const platforms = ["FC2", "JAV", "糖心"] as const;
const makers = ["S1", "SOD", "Prestige", "Moodyz", "FALENO", "其他片商"] as const;
const tags = ["高顏值", "素人感", "劇情好", "畫質差", "有碼", "無碼", "雷"] as const;

export function FilterSheet({
  open,
  filters,
  privateMode = false,
  privateFacets,
  onChange,
  onClose
}: {
  open: boolean;
  filters: ListFilters;
  privateMode?: boolean;
  privateFacets?: PrivateFacets | null;
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
          <PrivateFilters filters={filters} facets={privateFacets} onChange={onChange} />
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

function PrivateFilters({ filters, facets, onChange }: { filters: ListFilters; facets?: PrivateFacets | null; onChange: (patch: Partial<ListFilters>) => void }) {
  return (
    <>
      <div className="filter-grid private-filter-grid">
        <Field label="搜尋" value={filters.query} onChange={(value) => onChange({ query: value })} placeholder="代號、女優、平台、片商、標籤、心得" />
        <Field label="作品代號" value={filters.codeQuery} onChange={(value) => onChange({ codeQuery: value })} placeholder="FC2PPV-2255291" />
        <Field label="女優 / 創作者" value={filters.person} onChange={(value) => onChange({ person: value })} />
        <Field label="系列 / 番號前綴" value={filters.series} onChange={(value) => onChange({ series: value })} placeholder="SSIS / IPZZ / FC2PPV" />
        <Field label="評分下限" value={filters.ratingMin} inputMode="decimal" onChange={(value) => onChange({ ratingMin: value, unrated: false })} />
        <Field label="評分上限" value={filters.ratingMax} inputMode="decimal" onChange={(value) => onChange({ ratingMax: value, unrated: false })} />
        <OptionSelect label="平台" value={filters.platform} options={platforms} onChange={(value) => onChange({ platform: value })} />
        <OptionSelect label="片商" value={filters.maker} options={makers} onChange={(value) => onChange({ maker: value })} />
        <OptionSelect label="收藏等級" value={filters.favoriteLevel || "all"} options={favoriteLevels} allLabel="全部" onChange={(value) => onChange({ favoriteLevel: value as ListFilters["favoriteLevel"] })} />
        <Select label="已使用" value={filters.usedFilter} options={["all", "used", "unused"]} labels={{ all: "全部", used: "已使用", unused: "未使用" }} onChange={(value) => onChange({ usedFilter: value as ListFilters["usedFilter"] })} />
        <OptionSelect label="狀態" value={filters.mediaStatus || "all"} options={mediaStatuses} allLabel="全部" onChange={(value) => onChange({ mediaStatus: value as ListFilters["mediaStatus"] })} />
        <Field label="年份" value={filters.year} inputMode="numeric" onChange={(value) => onChange({ year: value })} />
        <OptionSelect label="標籤" value={filters.tag} options={tags} onChange={(value) => onChange({ tag: value })} />
        <label className="check"><input type="checkbox" checked={Boolean(filters.unrated)} onChange={(event) => onChange({ unrated: event.target.checked, ratingMin: "", ratingMax: "" })} />未評分</label>
      </div>
      <PrivateFacetPanel filters={filters} facets={facets} onChange={onChange} />
    </>
  );
}

function PrivateFacetPanel({ filters, facets, onChange }: { filters: ListFilters; facets?: PrivateFacets | null; onChange: (patch: Partial<ListFilters>) => void }) {
  const sourceItems = sourceFacetItems(facets?.source || []);
  return (
    <section className="private-facet-panel" aria-label="私密分面篩選">
      <FacetGroup
        title="評分區間"
        items={facets?.ratingBuckets || []}
        active={(value) => ratingBucketActive(filters, value)}
        onSelect={(value) => onChange(ratingBucketPatch(value))}
      />
      <FacetGroup
        title="收藏等級"
        items={facets?.favoriteLevel || []}
        active={(value) => filters.favoriteLevel === value}
        onSelect={(value) => onChange({ favoriteLevel: value as ListFilters["favoriteLevel"] })}
      />
      <FacetGroup
        title="已使用"
        items={facets?.used || []}
        active={(value) => (value === "已使用" && filters.usedFilter === "used") || (value === "未使用" && filters.usedFilter === "unused")}
        onSelect={(value) => onChange({ usedFilter: value === "已使用" ? "used" : "unused" })}
      />
      <FacetGroup
        title="來源快捷"
        items={sourceItems}
        active={(value) => filters.platform === value}
        onSelect={(value) => onChange({ platform: value })}
      />
      <SearchFacetGroup title="片商 maker" items={facets?.maker || []} activeValue={filters.maker} onSelect={(value) => onChange({ maker: value === "未設定" ? "" : value })} />
      <SearchFacetGroup title="系列 / 番號前綴" items={facets?.series || []} activeValue={filters.series} onSelect={(value) => onChange({ series: value === "未設定" ? "" : value })} />
      <SearchFacetGroup title="女優 / 創作者" items={facets?.actress || []} activeValue={filters.person} onSelect={(value) => onChange({ person: value })} />
      <SearchFacetGroup title="標籤" items={facets?.tags || []} activeValue={filters.tag} onSelect={(value) => onChange({ tag: value })} />
    </section>
  );
}

function FacetGroup({ title, items, active, onSelect }: { title: string; items: PrivateFacetItem[]; active: (value: string) => boolean; onSelect: (value: string) => void }) {
  return (
    <div className="private-facet-group">
      <h3>{title}</h3>
      <div className="private-facet-options">
        {items.length === 0 ? <span className="private-facet-empty">沒有資料</span> : items.map((item) => (
          <button key={item.value} className={active(item.value) ? "active" : ""} onClick={() => onSelect(item.value)}>
            <span>{item.value}</span>
            <b>{item.count}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

function SearchFacetGroup({ title, items, activeValue, onSelect }: { title: string; items: PrivateFacetItem[]; activeValue: string; onSelect: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => item.value.toLowerCase().includes(normalized));
  }, [items, query]);

  return (
    <div className="private-facet-group private-facet-search-group">
      <h3>{title}</h3>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋分面" />
      <div className="private-facet-options">
        {filtered.length === 0 ? <span className="private-facet-empty">沒有資料</span> : filtered.map((item) => (
          <button key={item.value} className={activeValue === item.value ? "active" : ""} onClick={() => onSelect(item.value)}>
            <span>{item.value}</span>
            <b>{item.count}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

function sourceFacetItems(items: PrivateFacetItem[]) {
  const counts = new Map(items.map((item) => [item.value, item.count]));
  return platforms.map((value) => ({ value, count: counts.get(value) || 0 }));
}

function ratingBucketPatch(value: string): Partial<ListFilters> {
  if (value === "9+") return { ratingMin: "9", ratingMax: "", unrated: false };
  if (value === "8+") return { ratingMin: "8", ratingMax: "", unrated: false };
  if (value === "6-7") return { ratingMin: "6", ratingMax: "7", unrated: false };
  if (value === "1-5") return { ratingMin: "1", ratingMax: "5", unrated: false };
  return { ratingMin: "", ratingMax: "", unrated: true };
}

function ratingBucketActive(filters: ListFilters, value: string) {
  if (value === "9+") return filters.ratingMin === "9" && !filters.ratingMax && !filters.unrated;
  if (value === "8+") return filters.ratingMin === "8" && !filters.ratingMax && !filters.unrated;
  if (value === "6-7") return filters.ratingMin === "6" && filters.ratingMax === "7" && !filters.unrated;
  if (value === "1-5") return filters.ratingMin === "1" && filters.ratingMax === "5" && !filters.unrated;
  return value === "未評分" && Boolean(filters.unrated);
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
