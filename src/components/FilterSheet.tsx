import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { mergePrivateFilterValues, privateFilterValues, reconcilePrivateTagFilters } from "../lib/privateFilters";
import type { ListFilters } from "../types";

export function FilterSheet({
  open,
  filters,
  privateMode = false,
  suggestions,
  onChange,
  onClose
}: {
  open: boolean;
  filters: ListFilters;
  privateMode?: boolean;
  suggestions?: FilterSuggestions;
  onChange: (patch: Partial<ListFilters>) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  return (
    <div className={open ? "filter-sheet open" : "filter-sheet"} onClick={onClose}>
      <div className="filter-sheet-panel" onClick={(event) => event.stopPropagation()}>
        <header className="sheet-head">
          <span><SlidersHorizontal size={18} />{privateMode ? "私密進階篩選" : "進階篩選"}</span>
          <button className="ghost-icon" onClick={onClose} aria-label="關閉篩選"><X size={18} /></button>
        </header>
        {privateMode ? (
          <PrivateFilters filters={filters} suggestions={suggestions} onChange={onChange} />
        ) : (
          <GeneralFilters filters={filters} suggestions={suggestions} onChange={onChange} />
        )}
      </div>
    </div>
  );
}

interface FilterSuggestions {
  types?: string[];
  categories?: string[];
  tags?: string[];
  platforms?: string[];
  people?: string[];
}

function GeneralFilters({ filters, suggestions, onChange }: { filters: ListFilters; suggestions?: FilterSuggestions; onChange: (patch: Partial<ListFilters>) => void }) {
  return (
    <div className="filter-grid">
      <Select label="狀態" value={filters.status} onChange={(value) => onChange({ status: value as ListFilters["status"] })} options={["all", "inbox", "raw", "partial", "organized", "complete"]} />
      <Field label="類型" value={filters.type} suggestions={suggestions?.types} onChange={(value) => onChange({ type: value })} />
      <Field label="分類" value={filters.category || ""} suggestions={suggestions?.categories} onChange={(value) => onChange({ category: value })} />
      <Field label="標籤" value={filters.tag} suggestions={suggestions?.tags} onChange={(value) => onChange({ tag: value })} />
      <Field label="平台" value={filters.platform} suggestions={suggestions?.platforms} onChange={(value) => onChange({ platform: value })} />
      <Field label="年份" value={filters.year} inputMode="numeric" onChange={(value) => onChange({ year: value })} />
      <Field label="觀看起日" value={filters.watchedFrom} type="date" onChange={(value) => onChange({ watchedFrom: value })} />
      <Field label="觀看迄日" value={filters.watchedTo} type="date" onChange={(value) => onChange({ watchedTo: value })} />
      <label className="check"><input type="checkbox" checked={filters.favorite} onChange={(event) => onChange({ favorite: event.target.checked })} />收藏</label>
      <label className="check"><input type="checkbox" checked={filters.highRated} onChange={(event) => onChange({ highRated: event.target.checked })} />高分</label>
    </div>
  );
}

function PrivateFilters({ filters, suggestions, onChange }: { filters: ListFilters; suggestions?: FilterSuggestions; onChange: (patch: Partial<ListFilters>) => void }) {
  const includedTags = mergePrivateFilterValues(filters.tag, filters.includeTags);
  const excludedTags = mergePrivateFilterValues(filters.excludeTag, filters.excludeTags);
  const changeTags = (next: string, changed: "include" | "exclude") => {
    const reconciled = reconcilePrivateTagFilters(changed === "include" ? next : includedTags, changed === "exclude" ? next : excludedTags, changed);
    onChange({ ...reconciled, tag: "", excludeTag: "" });
  };
  return (
    <>
      <div className="filter-grid private-filter-grid">
        <Field label="搜尋" value={filters.query} onChange={(value) => onChange({ query: value })} placeholder="代號、女優、平台、片商、標籤、心得" />
        <Field label="作品代號" value={filters.codeQuery} onChange={(value) => onChange({ codeQuery: value })} placeholder="FC2PPV-2255291" />
        <Field label="系列 / 番號前綴" value={filters.series} onChange={(value) => onChange({ series: value })} placeholder="SSIS / IPZZ / FC2PPV" />
        <Field label="最低評分" value={filters.ratingMin} type="number" inputMode="decimal" min="0" max="10" step="0.5" onChange={(value) => onChange({ ratingMin: value, unrated: false })} />
        <Field label="最高評分" value={filters.ratingMax} type="number" inputMode="decimal" min="0" max="10" step="0.5" onChange={(value) => onChange({ ratingMax: value, unrated: false })} />
        <Field label="年份" value={filters.year} inputMode="numeric" onChange={(value) => onChange({ year: value })} />
        <MultiValueFilter label="平台" value={filters.platformFilters || ""} suggestions={suggestions?.platforms} onChange={(value) => onChange({ platformFilters: value })} />
        <MultiValueFilter label="女優 / 人物" value={filters.personFilters || ""} suggestions={suggestions?.people} onChange={(value) => onChange({ personFilters: value, missingPeople: false })} />
        <MultiValueFilter label="包含 Tags" value={includedTags} suggestions={suggestions?.tags} onChange={(value) => changeTags(value, "include")} />
        <MultiValueFilter label="排除 Tags" value={excludedTags} suggestions={suggestions?.tags} onChange={(value) => changeTags(value, "exclude")} />
        <Select label="已使用" value={filters.usedFilter} options={["all", "used", "unused"]} labels={{ all: "不限", used: "是", unused: "否" }} onChange={(value) => onChange({ usedFilter: value as ListFilters["usedFilter"], privateStatus: "all" })} />
        <Select label="收藏" value={filters.favorite ? "yes" : "all"} options={["all", "yes"]} labels={{ all: "不限", yes: "是" }} onChange={(value) => onChange({ favorite: value === "yes" })} />
        <Field label="Metadata Quality 低於" value={filters.metadataQualityBelow || ""} type="number" inputMode="numeric" min="1" max="101" step="1" placeholder="60" onChange={(value) => onChange({ metadataQualityBelow: value })} />
        <Select label="心得" value={filters.hasNote || "all"} options={["all", "yes", "no"]} labels={{ all: "全部", yes: "有心得", no: "無心得" }} onChange={(value) => onChange({ hasNote: value as ListFilters["hasNote"] })} />
        <Select label="封面" value={filters.hasCover || "all"} options={["all", "yes", "no"]} labels={{ all: "全部", yes: "有封面", no: "無封面" }} onChange={(value) => onChange({ hasCover: value as ListFilters["hasCover"] })} />
        <label className="check"><input type="checkbox" checked={Boolean(filters.unrated)} onChange={(event) => onChange({ unrated: event.target.checked, ratingMin: "", ratingMax: "" })} />未評分</label>
        <label className="check"><input type="checkbox" checked={Boolean(filters.missingPeople)} onChange={(event) => onChange({ missingPeople: event.target.checked, personFilters: event.target.checked ? "" : filters.personFilters })} />無人物</label>
        <label className="check"><input type="checkbox" checked={Boolean(filters.missingTags || filters.qualityView === "missing_tags")} onChange={(event) => onChange({ missingTags: event.target.checked, qualityView: filters.qualityView === "missing_tags" ? "" : filters.qualityView })} />無 Tag</label>
        <label className="check"><input type="checkbox" checked={Boolean(filters.incompleteMetadata || filters.qualityView === "incomplete_metadata")} onChange={(event) => onChange({ incompleteMetadata: event.target.checked, qualityView: filters.qualityView === "incomplete_metadata" ? "" : filters.qualityView })} />資料不完整</label>
        <label className="check"><input type="checkbox" checked={Boolean(filters.duplicateCandidate || filters.qualityView === "suspected_duplicate")} onChange={(event) => onChange({ duplicateCandidate: event.target.checked, qualityView: filters.qualityView === "suspected_duplicate" ? "" : filters.qualityView })} />Duplicate candidate</label>
      </div>
      <p className="smart-filter-conflict-note">Include / Exclude 選到同一 Tag 時，以最後加入的一側為準。</p>
    </>
  );
}

function MultiValueFilter({ label, value, suggestions, onChange }: { label: string; value: string; suggestions?: string[]; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const selected = privateFilterValues(value);
  const addDraft = () => {
    const next = draft.trim();
    if (!next) return;
    onChange(mergePrivateFilterValues(value, next));
    setDraft("");
  };
  return (
    <fieldset className="smart-multi-filter">
      <legend>{label}</legend>
      {selected.length > 0 ? <div className="smart-multi-values">{selected.map((entry) => <button type="button" key={entry} onClick={() => onChange(selected.filter((value) => value !== entry).join(","))} title={`移除 ${entry}`}><span>{entry}</span><X size={12} aria-hidden="true" /></button>)}</div> : null}
      <div className="smart-multi-input">
        <input value={draft} list={suggestions?.length ? listId : undefined} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addDraft(); } }} placeholder="搜尋或輸入後按 Enter" />
        <button type="button" onClick={addDraft} disabled={!draft.trim()}>加入</button>
      </div>
      {suggestions?.length ? <datalist id={listId}>{suggestions.map((option) => <option key={option} value={option} />)}</datalist> : null}
    </fieldset>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", inputMode, suggestions, min, max, step }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; inputMode?: "numeric" | "decimal"; suggestions?: string[]; min?: string; max?: string; step?: string }) {
  const listId = suggestions?.length ? `filter-suggestions-${label}` : undefined;
  return (
    <label>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} inputMode={inputMode} list={listId} min={min} max={max} step={step} />
      {listId && <datalist id={listId}>{suggestions?.map((option) => <option key={option} value={option} />)}</datalist>}
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
