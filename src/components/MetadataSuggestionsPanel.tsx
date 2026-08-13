import { Check, Eye, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { applyMetadataSuggestions, decideMetadataSuggestions, listMetadataSuggestions, previewMetadataSuggestions, refreshMetadataSuggestions } from "../lib/api";
import type { MetadataSuggestion, MetadataSuggestionPreviewResponse, MetadataSuggestionStatus } from "../types";

const statusLabels: Record<MetadataSuggestionStatus, string> = {
  pending: "待處理",
  accepted: "已接受",
  rejected: "已拒絕",
  ignored: "已忽略"
};

const fieldLabels: Record<MetadataSuggestion["field"], string> = {
  official_title: "正式標題",
  platform: "平台",
  maker: "片商"
};

export function MetadataSuggestionsPanel({ onOpenItem }: { onOpenItem: (id: string) => void }) {
  const [status, setStatus] = useState<MetadataSuggestionStatus>("pending");
  const [page, setPage] = useState(1);
  const [suggestions, setSuggestions] = useState<MetadataSuggestion[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [preview, setPreview] = useState<MetadataSuggestionPreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (nextStatus: MetadataSuggestionStatus, nextPage: number) => {
    setBusy(true);
    setError("");
    try {
      const response = await listMetadataSuggestions(nextStatus, nextPage, 50);
      setSuggestions(response.suggestions);
      setTotal(response.total);
      setSelectedIds(new Set());
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Metadata 建議載入失敗");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(status, page); }, [load, page, status]);

  async function regenerate() {
    setBusy(true);
    setError("");
    try {
      await refreshMetadataSuggestions();
      setStatus("pending");
      setPage(1);
      await load("pending", 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "建議重新檢查失敗");
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPreview(null);
  }

  async function openPreview() {
    if (!selectedIds.size) return;
    setBusy(true);
    setError("");
    try { setPreview(await previewMetadataSuggestions(Array.from(selectedIds))); }
    catch (err) { setError(err instanceof Error ? err.message : "建議預覽失敗"); }
    finally { setBusy(false); }
  }

  async function applyPreview() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      await applyMetadataSuggestions(preview.changes.map((change) => change.suggestionId));
      await load("pending", page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "建議套用失敗");
      setBusy(false);
    }
  }

  async function decide(decision: "rejected" | "ignored") {
    if (!selectedIds.size) return;
    setBusy(true);
    setError("");
    try {
      await decideMetadataSuggestions(Array.from(selectedIds), decision);
      await load(status, page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "建議狀態更新失敗");
      setBusy(false);
    }
  }

  const allSelected = suggestions.length > 0 && suggestions.every((suggestion) => selectedIds.has(suggestion.id));

  return (
    <details className="metadata-suggestions" open>
      <summary><span>Metadata 建議</span><b>{status === "pending" ? total : statusLabels[status]}</b></summary>
      <div className="suggestion-toolbar">
        <div role="tablist" aria-label="建議狀態">
          {(Object.keys(statusLabels) as MetadataSuggestionStatus[]).map((value) => (
            <button key={value} role="tab" aria-selected={status === value} className={status === value ? "active" : ""} onClick={() => { setStatus(value); setPage(1); }}>
              {statusLabels[value]}
            </button>
          ))}
        </div>
        <button onClick={() => void regenerate()} disabled={busy}><RefreshCw size={14}/>重新推導</button>
      </div>
      {error ? <div className="notice danger" role="alert">{error}</div> : null}
      {status === "pending" ? (
        <div className="suggestion-actions">
          <label><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? new Set() : new Set(suggestions.map((item) => item.id)))} /> 本頁全選</label>
          <span>已選 {selectedIds.size}</span>
          <button disabled={!selectedIds.size || busy} onClick={() => void openPreview()}><Eye size={14}/>預覽套用</button>
          <button disabled={!selectedIds.size || busy} onClick={() => void decide("rejected")}><X size={14}/>拒絕</button>
          <button disabled={!selectedIds.size || busy} onClick={() => void decide("ignored")}>忽略</button>
        </div>
      ) : null}
      {busy && !suggestions.length ? <p className="quality-state">載入中...</p> : null}
      <div className="suggestion-list" role="list" aria-label="Metadata 建議列表">
        {suggestions.map((suggestion) => (
          <article key={suggestion.id} role="listitem">
            {status === "pending" ? <input aria-label={`選取 ${suggestion.code || suggestion.title || suggestion.item_id}`} type="checkbox" checked={selectedIds.has(suggestion.id)} onChange={() => toggle(suggestion.id)} /> : null}
            <button className="quality-code" onClick={() => onOpenItem(suggestion.item_id)}>{suggestion.code || suggestion.title || suggestion.item_id}</button>
            <b>{fieldLabels[suggestion.field]}</b>
            <span title={suggestion.current_value || "空白"}>{suggestion.current_value || "空白"}</span>
            <span aria-hidden="true">→</span>
            <strong title={suggestion.suggested_value}>{suggestion.suggested_value}</strong>
            <small title={suggestion.reason}>{suggestion.source} · {suggestion.reason}</small>
          </article>
        ))}
      </div>
      {!busy && suggestions.length === 0 ? <p className="quality-state">目前沒有這類建議</p> : null}
      <div className="quality-list-head">
        <span>第 {page} 頁，共 {total} 筆</span>
        <div><button disabled={page <= 1 || busy} onClick={() => setPage((value) => value - 1)}>上一頁</button><button disabled={page * 50 >= total || busy} onClick={() => setPage((value) => value + 1)}>下一頁</button></div>
      </div>
      {preview ? (
        <section className="suggestion-preview" aria-label="建議套用預覽">
          <header><div><strong>Before → After</strong><small>{preview.changes.length} 個建議；整批原子套用</small></div><button onClick={() => setPreview(null)}>關閉</button></header>
          <div>{preview.changes.map((change) => <p key={change.suggestionId}><b>{fieldLabels[change.field]}</b><span>{change.before || "空白"}</span><span>→</span><strong>{change.after}</strong><small>{change.source} · {change.reason}</small></p>)}</div>
          <button className="primary" disabled={busy} onClick={() => void applyPreview()}><Check size={15}/>確認套用</button>
        </section>
      ) : null}
    </details>
  );
}
