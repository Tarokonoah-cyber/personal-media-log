import { CheckCircle2, Eye, Inbox, RotateCcw, SkipForward } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { applyMetadataSuggestions, getOrganizationInboxSummary, listMetadataSuggestions, listOrganizationInbox, previewMetadataSuggestions, setOrganizationInboxState } from "../lib/api";
import type { MetadataSuggestionPreviewResponse, OrganizationInboxCategory, OrganizationInboxEntry, OrganizationInboxState, OrganizationInboxSummary } from "../types";
import type { PrivateEditorInitialFocus } from "./ItemEditor";

const categoryLabels: Record<OrganizationInboxCategory, string> = {
  new: "New",
  missing_metadata: "缺 Metadata",
  missing_tags: "缺 Tags",
  missing_people: "缺人物",
  duplicate_suspected: "疑似重複",
  normalization_needed: "待正規化",
  metadata_conflict: "Metadata 衝突",
  ready: "Ready",
  skipped: "Skipped"
};

export function OrganizationInbox({ onOpenItem }: {
  onOpenItem: (id: string, focus?: PrivateEditorInitialFocus, queueIds?: string[]) => void;
}) {
  const inboxRef = useRef<HTMLElement>(null);
  const [summary, setSummary] = useState<OrganizationInboxSummary | null>(null);
  const [category, setCategory] = useState<OrganizationInboxCategory>("missing_metadata");
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<OrganizationInboxEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [suggestionPreview, setSuggestionPreview] = useState<MetadataSuggestionPreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (nextCategory: OrganizationInboxCategory, nextPage: number) => {
    setBusy(true);
    setError("");
    try {
      const [nextSummary, response] = await Promise.all([
        getOrganizationInboxSummary(),
        listOrganizationInbox(nextCategory, nextPage, 50)
      ]);
      setSummary(nextSummary);
      setEntries(response.items);
      setTotal(response.total);
      setActiveIndex(0);
      setSelectedIds(new Set());
      setSuggestionPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "整理 Inbox 載入失敗");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(category, page); }, [category, load, page]);

  async function updateState(ids: string[], state: OrganizationInboxState) {
    if (!ids.length) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await setOrganizationInboxState(ids, state);
      setMessage(state === "ready" ? `已將 ${ids.length} 筆標記 Ready` : state === "skipped" ? `已跳過 ${ids.length} 筆` : `已將 ${ids.length} 筆移回待整理`);
      await load(category, page);
      inboxRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inbox 狀態更新失敗");
      setBusy(false);
    }
  }

  async function previewItemSuggestion(entry: OrganizationInboxEntry) {
    setBusy(true); setError(""); setMessage("");
    try {
      const list = await listMetadataSuggestions("pending", 1, 100, entry.item.id);
      if (!list.suggestions.length) {
        setSuggestionPreview(null);
        setMessage("這筆目前沒有待處理的 Metadata 建議");
        return;
      }
      setSuggestionPreview(await previewMetadataSuggestions(list.suggestions.map((suggestion) => suggestion.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "建議預覽失敗");
    } finally {
      setBusy(false);
    }
  }

  async function confirmSuggestions() {
    if (!suggestionPreview) return;
    setBusy(true); setError("");
    try {
      await applyMetadataSuggestions(suggestionPreview.changes.map((change) => change.suggestionId));
      setMessage(`已套用 ${suggestionPreview.changes.length} 個建議`);
      await load(category, page);
      inboxRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "建議套用失敗");
      setBusy(false);
    }
  }

  function openActive(focus?: PrivateEditorInitialFocus) {
    const entry = entries[activeIndex];
    if (entry) onOpenItem(entry.item.id, focus, entries.map((item) => item.item.id));
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = entries.length > 0 && entries.every((entry) => selectedIds.has(entry.item.id));
  const active = entries[activeIndex];

  return (
    <section
      ref={inboxRef}
      className="organization-inbox"
      tabIndex={0}
      aria-label="Organization Inbox"
      onKeyDown={(event) => {
        if (!active || event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
        const key = event.key.toLocaleLowerCase();
        if (key === "j" || event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(entries.length - 1, index + 1)); }
        else if (key === "k" || event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)); }
        else if (event.key === "Enter") { event.preventDefault(); openActive(); }
        else if (key === "t") { event.preventDefault(); openActive("tags"); }
        else if (key === "p") { event.preventDefault(); openActive("people"); }
        else if (key === "r") { event.preventDefault(); openActive("rating"); }
        else if (key === "f") { event.preventDefault(); openActive("collection"); }
        else if (key === "a") { event.preventDefault(); void previewItemSuggestion(active); }
        else if (key === "s") { event.preventDefault(); void updateState([active.item.id], "skipped"); }
      }}
    >
      <header><div><p>連續整理</p><h2><Inbox size={19}/> Organization Inbox</h2><small>J/K 移動 · T Tags · P People · R Rating · F Favorite/收藏 · A 預覽建議 · S Skip · Enter 開啟</small></div><strong>{summary?.needsAttention || 0} items need attention</strong></header>
      <div className="inbox-categories" role="tablist" aria-label="Inbox 原因分類">{(Object.keys(categoryLabels) as OrganizationInboxCategory[]).map((value) => <button key={value} role="tab" aria-selected={category === value} className={category === value ? "active" : ""} onClick={() => { setCategory(value); setPage(1); }}>{categoryLabels[value]}<b>{summary?.categories[value] || 0}</b></button>)}</div>
      {error ? <div className="notice danger" role="alert">{error}</div> : null}
      {message ? <div className="notice success" role="status">{message}</div> : null}
      <div className="inbox-actions">
        <label><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? new Set() : new Set(entries.map((entry) => entry.item.id)))} />本頁全選</label>
        <span>已選 {selectedIds.size}</span>
        <button disabled={!selectedIds.size || busy} onClick={() => void updateState(Array.from(selectedIds), "ready")}><CheckCircle2 size={14}/>Ready</button>
        <button disabled={!selectedIds.size || busy} onClick={() => void updateState(Array.from(selectedIds), "skipped")}><SkipForward size={14}/>Skip</button>
        <button disabled={!selectedIds.size || busy} onClick={() => void updateState(Array.from(selectedIds), "active")}><RotateCcw size={14}/>Undo</button>
        <button disabled={!active || activeIndex <= 0} onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}>上一筆</button>
        <button disabled={!active || activeIndex >= entries.length - 1} onClick={() => setActiveIndex((index) => Math.min(entries.length - 1, index + 1))}>下一筆</button>
      </div>
      <div className="inbox-list" role="listbox" aria-label="待整理作品">
        {entries.map((entry, index) => <article key={entry.item.id} role="option" aria-selected={index === activeIndex} className={index === activeIndex ? "is-active" : ""} onMouseEnter={() => setActiveIndex(index)} onClick={() => setActiveIndex(index)}>
          <input aria-label={`選取 ${entry.item.code || entry.item.raw_title}`} type="checkbox" checked={selectedIds.has(entry.item.id)} onChange={() => toggleSelected(entry.item.id)} onClick={(event) => event.stopPropagation()}/>
          <button className="quality-code" onClick={(event) => { event.stopPropagation(); onOpenItem(entry.item.id, undefined, entries.map((item) => item.item.id)); }}>{entry.item.code || "—"}</button>
          <strong>{entry.item.official_title || entry.item.raw_title || "—"}</strong>
          <span>{entry.item.rating === null ? "未評分" : `${entry.item.rating}/10`} · {entry.item.favorite ? "★" : "☆"}</span>
          <div>{entry.reasons.map((reason) => <em key={reason.code}>{reason.label}</em>)}</div>
          <button onClick={(event) => { event.stopPropagation(); void previewItemSuggestion(entry); }}><Eye size={14}/>建議</button>
        </article>)}
      </div>
      {busy && !entries.length ? <p className="quality-state">載入中...</p> : null}
      {!busy && !entries.length ? <p className="quality-state">這個 queue 目前是空的</p> : null}
      <div className="quality-list-head"><span>第 {page} 頁，共 {total} 筆</span><div><button disabled={page <= 1 || busy} onClick={() => setPage((value) => value - 1)}>上一頁</button><button disabled={page * 50 >= total || busy} onClick={() => setPage((value) => value + 1)}>下一頁</button></div></div>
      {suggestionPreview ? <section className="inbox-suggestion-preview" aria-label="Inbox Metadata 建議預覽">
        <header><div><strong>Suggestion Preview</strong><small>Before → After；需再次確認才會套用</small></div><button onClick={() => setSuggestionPreview(null)}>關閉</button></header>
        {suggestionPreview.changes.map((change) => <p key={change.suggestionId}><b>{change.field}</b><span>{change.before || "空白"}</span><span>→</span><strong>{change.after}</strong><small>{change.source} · {change.reason}</small></p>)}
        <button className="primary" disabled={busy} onClick={() => void confirmSuggestions()}>確認套用</button>
      </section> : null}
    </section>
  );
}
