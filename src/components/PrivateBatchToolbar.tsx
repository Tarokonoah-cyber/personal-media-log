import { Check, Tags, Trash2, X } from "lucide-react";
import { useState } from "react";
import { privateCollectionLevelLabels, privateCollectionLevels, type PrivateCollectionLevel } from "../../shared/privateModel";
import type { BatchOperationResult } from "../lib/privateBatch";

export function PrivateBatchToolbar({
  selectedCount,
  knownTags,
  busy,
  onCollection,
  onTags,
  onDelete,
  onClear
}: {
  selectedCount: number;
  knownTags: string[];
  busy: boolean;
  onCollection: (collection: PrivateCollectionLevel) => Promise<BatchOperationResult>;
  onTags: (input: string, mode: "add" | "remove") => Promise<BatchOperationResult>;
  onDelete: () => Promise<BatchOperationResult>;
  onClear: () => void;
}) {
  const [collection, setCollection] = useState<PrivateCollectionLevel | "">("");
  const [tagMode, setTagMode] = useState<"add" | "remove">("add");
  const [tagInput, setTagInput] = useState("");

  return (
    <div className="private-batch-toolbar" role="region" aria-label="批次整理">
      <strong>{selectedCount} 筆已選</strong>
      <div className="private-batch-group">
        <select value={collection} onChange={(event) => setCollection(event.target.value as PrivateCollectionLevel | "")} disabled={busy} aria-label="批次收藏">
          <option value="">設定收藏</option>
          {privateCollectionLevels.map((value) => <option key={value} value={value}>{privateCollectionLevelLabels[value]}</option>)}
        </select>
        <button disabled={busy || !collection} onClick={() => collection && void onCollection(collection)}><Check size={14} />套用</button>
      </div>
      <div className="private-batch-tags">
        <div className="segmented-control" aria-label="批次標籤模式">
          <button className={tagMode === "add" ? "active" : ""} onClick={() => setTagMode("add")} disabled={busy}>加入</button>
          <button className={tagMode === "remove" ? "active" : ""} onClick={() => setTagMode("remove")} disabled={busy}>移除</button>
        </div>
        <input value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="輸入標籤" list="private-batch-known-tags" disabled={busy} />
        <datalist id="private-batch-known-tags">{knownTags.slice(0, 30).map((tag) => <option key={tag} value={tag} />)}</datalist>
        <button disabled={busy || !tagInput.trim()} onClick={() => void onTags(tagInput, tagMode).then((result) => { if (!result.cancelled && result.failedIds.length === 0) setTagInput(""); })}><Tags size={14} />套用</button>
      </div>
      <span className="private-batch-spacer" />
      <button className="danger-text" disabled={busy} onClick={() => void onDelete()}><Trash2 size={14} />刪除</button>
      <button className="icon-button" disabled={busy} onClick={onClear} title="清除選取" aria-label="清除選取"><X size={15} /></button>
    </div>
  );
}
