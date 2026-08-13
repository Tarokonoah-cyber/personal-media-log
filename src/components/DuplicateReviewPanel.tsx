import { Eye, RefreshCw, RotateCcw, Shuffle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { applyDuplicateMerge, decideDuplicatePair, listDuplicateCandidates, previewDuplicateMerge, refreshDuplicateSignatures, rollbackDuplicateMerge } from "../lib/api";
import type { DuplicateCandidate, DuplicateConfidence, DuplicateDecision, DuplicateMergePreview, MediaItem } from "../types";

const confidenceLabels: Record<DuplicateConfidence, string> = { high: "High", medium: "Medium", low: "Low" };
const comparisonFields: Array<{ key: keyof MediaItem; label: string }> = [
  { key: "code", label: "Code" }, { key: "official_title", label: "Title" }, { key: "people", label: "People" },
  { key: "tags", label: "Tags" }, { key: "maker", label: "Maker" }, { key: "platform", label: "Platform" },
  { key: "rating", label: "Rating" }, { key: "favorite", label: "Favorite" }, { key: "quick_note", label: "Note" },
  { key: "collections", label: "Collections" }, { key: "created_at", label: "Created" }, { key: "updated_at", label: "Updated" }
];

export function DuplicateReviewPanel({ onOpenItem }: { onOpenItem: (id: string) => void }) {
  const [page, setPage] = useState(1);
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [total, setTotal] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [targetSide, setTargetSide] = useState<"a" | "b">("a");
  const [preview, setPreview] = useState<DuplicateMergePreview | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, "target" | "source">>({});
  const [recoveryId, setRecoveryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (nextPage: number) => {
    setBusy(true); setError("");
    try {
      const response = await listDuplicateCandidates(nextPage, 20);
      setCandidates(response.candidates);
      setTotal(response.total);
      setActiveIndex(0);
      setPreview(null);
      setResolutions({});
    } catch (err) { setError(err instanceof Error ? err.message : "重複候選載入失敗"); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(page); }, [load, page]);

  async function refresh() {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await refreshDuplicateSignatures();
      setMessage(`已更新 ${result.indexed} 筆 comparison signatures`);
      await load(page);
    } catch (err) { setError(err instanceof Error ? err.message : "重複 signature 更新失敗"); setBusy(false); }
  }

  async function decide(decision: DuplicateDecision) {
    const candidate = candidates[activeIndex];
    if (!candidate) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await decideDuplicatePair(candidate.itemA.id, candidate.itemB.id, decision, { score: candidate.score, evidence: candidate.evidence });
      setMessage(decision === "not_duplicate" ? "已標記 Not duplicate" : decision === "ignored" ? "已忽略此 pair" : "已保留兩筆");
      await load(page);
    } catch (err) { setError(err instanceof Error ? err.message : "重複決策儲存失敗"); setBusy(false); }
  }

  async function openMergePreview() {
    const candidate = candidates[activeIndex];
    if (!candidate) return;
    const target = targetSide === "a" ? candidate.itemA : candidate.itemB;
    const source = targetSide === "a" ? candidate.itemB : candidate.itemA;
    setBusy(true); setError(""); setMessage("");
    try {
      const next = await previewDuplicateMerge(target.id, source.id);
      setPreview(next);
      setResolutions({});
    } catch (err) { setError(err instanceof Error ? err.message : "Merge preview 載入失敗"); }
    finally { setBusy(false); }
  }

  async function confirmMerge() {
    if (!preview || preview.conflicts.some((conflict) => !resolutions[conflict.field])) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await applyDuplicateMerge(preview, resolutions);
      setRecoveryId(result.mergeId);
      setPreview(null);
      setMessage(`Merge 已套用；Recovery ID：${result.mergeId}`);
      await load(page);
    } catch (err) { setError(err instanceof Error ? err.message : "Duplicate merge 套用失敗"); setBusy(false); }
  }

  async function rollback() {
    if (!recoveryId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await rollbackDuplicateMerge(recoveryId);
      setMessage("Merge 已回復，兩筆 item 與 relations 均已還原");
      setRecoveryId("");
      await refreshDuplicateSignatures();
      await load(page);
    } catch (err) { setError(err instanceof Error ? err.message : "Duplicate merge 回復失敗"); setBusy(false); }
  }

  const active = candidates[activeIndex];

  return (
    <details className="duplicate-review-panel" open>
      <summary><span>Duplicate Detection 2.0</span><b>{total} candidates</b></summary>
      <div className="duplicate-toolbar"><span>先以 signature blocking 產生候選，再計算 metadata similarity；不做 O(n²) 全表比對。</span><button disabled={busy} onClick={() => void refresh()}><RefreshCw size={14}/>更新 signatures</button></div>
      {error ? <div className="notice danger" role="alert">{error}</div> : null}
      {message ? <div className="notice success" role="status">{message}</div> : null}
      <div className="duplicate-layout">
        <nav aria-label="Duplicate candidates">{candidates.map((candidate, index) => <button key={candidate.pairKey} className={index === activeIndex ? "active" : ""} onClick={() => { setActiveIndex(index); setPreview(null); setTargetSide("a"); }}><span>{candidate.itemA.code || candidate.itemA.raw_title} ↔ {candidate.itemB.code || candidate.itemB.raw_title}</span><b className={`confidence-${candidate.confidence}`}>{confidenceLabels[candidate.confidence]} {candidate.score}</b></button>)}</nav>
        <section className="duplicate-comparison" aria-label="Duplicate pair comparison">
          {!active ? <p className="quality-state">目前沒有待 review 的 duplicate pair</p> : <>
            <header><div><strong>{active.itemA.code || active.itemA.raw_title}</strong><button onClick={() => onOpenItem(active.itemA.id)}>開啟 A</button></div><b>↔</b><div><strong>{active.itemB.code || active.itemB.raw_title}</strong><button onClick={() => onOpenItem(active.itemB.id)}>開啟 B</button></div></header>
            <div className="duplicate-evidence">{active.evidence.map((evidence) => <span key={evidence.code}>{evidence.label}</span>)}</div>
            <div className="duplicate-field-grid">{comparisonFields.map((field) => <p key={field.key}><b>{field.label}</b><span>{displayValue(active.itemA[field.key])}</span><span>{displayValue(active.itemB[field.key])}</span></p>)}</div>
            <div className="duplicate-actions"><button disabled={busy} onClick={() => void decide("not_duplicate")}>Not duplicate</button><button disabled={busy} onClick={() => void decide("ignored")}>Ignore pair</button><button disabled={busy} onClick={() => void decide("keep_both")}>Keep both</button><button disabled={busy} onClick={() => { setTargetSide((side) => side === "a" ? "b" : "a"); setPreview(null); }}><Shuffle size={14}/>保留 {targetSide === "a" ? "A" : "B"} 為主</button><button className="primary" disabled={busy} onClick={() => void openMergePreview()}><Eye size={14}/>Merge Preview</button></div>
          </>}
        </section>
      </div>
      <div className="quality-list-head"><span>第 {page} 頁</span><div><button disabled={page <= 1 || busy} onClick={() => setPage((value) => value - 1)}>上一頁</button><button disabled={candidates.length < 20 || busy} onClick={() => setPage((value) => value + 1)}>下一頁</button></div></div>
      {preview ? <section className="duplicate-merge-preview" aria-label="Duplicate Merge Preview">
        <header><div><strong>Merge Preview</strong><small>Target：{preview.target.code || preview.target.raw_title} · Source：{preview.source.code || preview.source.raw_title}</small></div><button onClick={() => setPreview(null)}>關閉</button></header>
        <div className="merge-unions"><span>Tags：{preview.union.tags.join("、") || "—"}</span><span>People：{preview.union.people.join("、") || "—"}</span><span>Collections：{preview.union.collections.join("、") || "—"}</span></div>
        {preview.conflicts.length ? <div className="merge-conflicts">{preview.conflicts.map((conflict) => <fieldset key={conflict.field}><legend>{conflict.label}</legend><label><input type="radio" name={`conflict-${conflict.field}`} checked={resolutions[conflict.field] === "target"} onChange={() => setResolutions((current) => ({ ...current, [conflict.field]: "target" }))}/><span>Target</span><strong>{displayValue(conflict.targetValue)}</strong></label><label><input type="radio" name={`conflict-${conflict.field}`} checked={resolutions[conflict.field] === "source"} onChange={() => setResolutions((current) => ({ ...current, [conflict.field]: "source" }))}/><span>Source</span><strong>{displayValue(conflict.sourceValue)}</strong></label></fieldset>)}</div> : <p>沒有需要人工選擇的 scalar conflicts。</p>}
        <p className="quality-review-note">Tags、People、Collections、Favorite、Used 與 Notes 會保留雙方資訊；Source 僅 soft-delete，可由 recovery snapshot 還原。</p>
        <button className="primary" disabled={busy || preview.conflicts.some((conflict) => !resolutions[conflict.field])} onClick={() => void confirmMerge()}>確認 Merge</button>
      </section> : null}
      {recoveryId ? <div className="normalization-recovery"><span>Recovery ID：{recoveryId}</span><button disabled={busy} onClick={() => void rollback()}><RotateCcw size={14}/>Undo Merge</button></div> : null}
    </details>
  );
}

function displayValue(value: unknown) {
  if (Array.isArray(value)) return value.join("、") || "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
