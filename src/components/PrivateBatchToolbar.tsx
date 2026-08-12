import { Check, Tags, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { privateCollectionLevelLabels, privateCollectionLevels, type PrivateCollectionLevel } from "../../shared/privateModel";
import type { BatchOperationResult } from "../lib/privateBatch";
import { canonicalizeTagInput, rankTagSuggestions, readRecentTags, rememberRecentTags } from "../lib/tagWorkflow";

export type PrivateBatchField = "collection" | "rating" | "platform" | "maker" | "people";

export function PrivateBatchToolbar({
  selectedCount,
  knownTags,
  busy,
  onCollection,
  onField,
  onTags,
  onDelete,
  onClear
}: {
  selectedCount: number;
  knownTags: string[];
  busy: boolean;
  onCollection: (collection: PrivateCollectionLevel) => Promise<BatchOperationResult>;
  onField?: (field: PrivateBatchField, value: string) => Promise<BatchOperationResult>;
  onTags: (input: string, mode: "add" | "remove") => Promise<BatchOperationResult>;
  onDelete: () => Promise<BatchOperationResult>;
  onClear: () => void;
}) {
  const [field, setField] = useState<PrivateBatchField>("collection");
  const [fieldValue, setFieldValue] = useState("");
  const [tagMode, setTagMode] = useState<"add" | "remove">("add");
  const [tagInput, setTagInput] = useState("");
  const [activeTagSuggestion, setActiveTagSuggestion] = useState(-1);
  const [recentTags, setRecentTags] = useState(() => readRecentTags());
  const tagSuggestions = useMemo(() => rankTagSuggestions(knownTags, tagInput, recentTags).slice(0, 8), [knownTags, recentTags, tagInput]);

  async function applyField() {
    if (busy || !fieldValue) return;
    const result = field === "collection"
      ? await onCollection(fieldValue as PrivateCollectionLevel)
      : onField
        ? await onField(field, fieldValue)
        : { succeededIds: [], failedIds: [] };
    if (!result.cancelled && result.failedIds.length === 0 && (field === "maker" || field === "people")) setFieldValue("");
  }

  async function applyTags(value = tagInput) {
    if (busy || !value.trim()) return;
    const canonical = canonicalizeTagInput(value, knownTags);
    if (canonical.length === 0) return;
    const result = await onTags(canonical.join(","), tagMode);
    if (!result.cancelled && result.failedIds.length === 0) {
      setRecentTags(rememberRecentTags(canonical));
      setTagInput("");
      setActiveTagSuggestion(-1);
    }
  }

  return (
    <div className="private-batch-toolbar" role="region" aria-label="批次整理">
      <strong>{selectedCount} 筆已選</strong>
      <div className="private-batch-group private-batch-field-group">
        <select value={field} onChange={(event) => { setField(event.target.value as PrivateBatchField); setFieldValue(""); }} disabled={busy} aria-label="批次欄位">
          <option value="collection">收藏狀態</option>
          <option value="rating">評分</option>
          <option value="platform">平台分類</option>
          <option value="maker">片商</option>
          <option value="people">加入人物</option>
        </select>
        <BatchValueInput field={field} value={fieldValue} busy={busy} onChange={setFieldValue} onEnter={() => void applyField()} />
        <button disabled={busy || !fieldValue || (field !== "collection" && !onField)} onClick={() => void applyField()}><Check size={14} />套用</button>
      </div>
      <div className="private-batch-tags">
        <div className="segmented-control" aria-label="批次標籤模式">
          <button className={tagMode === "add" ? "active" : ""} onClick={() => setTagMode("add")} disabled={busy}>加入</button>
          <button className={tagMode === "remove" ? "active" : ""} onClick={() => setTagMode("remove")} disabled={busy}>移除</button>
        </div>
        <span className="private-batch-tag-input">
          <input
            value={tagInput}
            onChange={(event) => { setTagInput(event.target.value); setActiveTagSuggestion(-1); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && tagSuggestions.length) { event.preventDefault(); setActiveTagSuggestion((index) => Math.min(index + 1, tagSuggestions.length - 1)); return; }
              if (event.key === "ArrowUp" && tagSuggestions.length) { event.preventDefault(); setActiveTagSuggestion((index) => Math.max(index - 1, 0)); return; }
              if (event.key !== "Enter" || busy || !tagInput.trim()) return;
              event.preventDefault();
              void applyTags(activeTagSuggestion >= 0 ? tagSuggestions[activeTagSuggestion] : tagInput);
            }}
            placeholder="輸入或搜尋標籤"
            disabled={busy}
            aria-label="批次標籤"
            role="combobox"
            aria-expanded={tagSuggestions.length > 0}
            aria-controls="private-batch-tag-suggestions"
          />
          {tagSuggestions.length > 0 && <span id="private-batch-tag-suggestions" className="private-batch-tag-suggestions" role="listbox" aria-label="最近與常用標籤">{tagSuggestions.map((tag, index) => <button key={tag} type="button" role="option" aria-selected={index === activeTagSuggestion} className={index === activeTagSuggestion ? "active" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => void applyTags(tag)}>#{tag}</button>)}</span>}
        </span>
        <button disabled={busy || !tagInput.trim()} onClick={() => void applyTags()}><Tags size={14} />套用</button>
      </div>
      <span className="private-batch-spacer" />
      <button className="danger-text" disabled={busy} onClick={() => void onDelete()}><Trash2 size={14} />刪除</button>
      <button className="icon-button" disabled={busy} onClick={onClear} title="清除選取" aria-label="清除選取"><X size={15} /></button>
    </div>
  );
}
function BatchValueInput({ field, value, busy, onChange, onEnter }: { field: PrivateBatchField; value: string; busy: boolean; onChange: (value: string) => void; onEnter: () => void }) {
  const keyboard = (event: React.KeyboardEvent<HTMLElement>) => { if (event.key === "Enter") { event.preventDefault(); onEnter(); } };
  if (field === "collection") return <select value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={keyboard} disabled={busy} aria-label="批次值"><option value="">選擇收藏狀態</option>{privateCollectionLevels.map((level) => <option key={level} value={level}>{privateCollectionLevelLabels[level]}</option>)}</select>;
  if (field === "rating") return <select value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={keyboard} disabled={busy} aria-label="批次值"><option value="">選擇評分</option><option value="clear">清除評分</option>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} 星</option>)}</select>;
  if (field === "platform") return <select value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={keyboard} disabled={busy} aria-label="批次值"><option value="">選擇平台</option><option value="FC2">FC2</option><option value="JAV">JAV</option><option value="其他">其他</option></select>;
  return <input value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={keyboard} disabled={busy} aria-label="批次值" placeholder={field === "maker" ? "輸入片商" : "輸入人物，可用逗號分隔"} />;
}
