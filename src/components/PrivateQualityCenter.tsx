import { AlertTriangle, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getPrivateQuality, ignorePrivateQualityIssue, unignorePrivateQualityIssue } from "../lib/api";
import type { PrivateIssueType, PrivateQualityIssue, PrivateQualitySummaryItem } from "../types";

export function PrivateQualityCenter({ onOpenItem }: { onOpenItem: (id: string) => void }) {
  const [summary, setSummary] = useState<PrivateQualitySummaryItem[]>([]);
  const [selected, setSelected] = useState<PrivateIssueType | null>(null);
  const [issues, setIssues] = useState<PrivateQualityIssue[]>([]);
  const [showIgnored, setShowIgnored] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSummary() {
    setLoading(true); setError("");
    try { setSummary((await getPrivateQuality()).summary || []); }
    catch (err) { setError(err instanceof Error ? err.message : "資料品質載入失敗"); }
    finally { setLoading(false); }
  }

  const loadIssues = useCallback(async (type: PrivateIssueType, ignored: boolean, targetPage: number) => {
    setLoading(true); setError("");
    try { const response = await getPrivateQuality(type, targetPage, 50, ignored); setIssues(response.issues || []); setTotal(response.total || 0); }
    catch (err) { setError(err instanceof Error ? err.message : "問題列表載入失敗"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadSummary(); }, []);
  useEffect(() => { if (selected) void loadIssues(selected, showIgnored, page); }, [loadIssues, page, selected, showIgnored]);

  async function toggleIgnore(issue: PrivateQualityIssue) {
    if (!selected) return;
    try {
      if (showIgnored) await unignorePrivateQualityIssue(issue.item_id, selected, issue.issue_key);
      else await ignorePrivateQualityIssue(issue.item_id, selected, issue.issue_key);
      await Promise.all([loadSummary(), loadIssues(selected, showIgnored, page)]);
    } catch (err) { setError(err instanceof Error ? err.message : "更新忽略狀態失敗"); }
  }

  return (
    <section className="private-quality-center">
      <header><div><p>私密工作台</p><h2>資料整理</h2></div><button onClick={() => void loadSummary()}><RefreshCw size={15}/>重新檢查</button></header>
      {error && <div className="notice danger" role="alert">{error}</div>}
      <div className="quality-summary-grid">
        {summary.map((item) => <button key={item.type} className={selected === item.type ? "active" : ""} onClick={() => { setSelected(item.type); setPage(1); }}><AlertTriangle size={16}/><span>{item.label}</span><b>{item.count}</b></button>)}
      </div>
      <div className="quality-list-head"><strong>{selected ? `${summary.find((item) => item.type === selected)?.label} ${total}` : "選擇問題類型"}</strong><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>上一頁</button><span>{page}</span><button disabled={page * 50 >= total} onClick={() => setPage((value) => value + 1)}>下一頁</button><button onClick={() => { setPage(1); setShowIgnored((value) => !value); }}>{showIgnored ? <Eye size={15}/> : <EyeOff size={15}/>} {showIgnored ? "查看未忽略" : "已忽略問題"}</button></div></div>
      {loading ? <p className="quality-state">檢查中...</p> : selected && issues.length === 0 ? <p className="quality-state">目前沒有這類問題</p> : (
        <div className="quality-issue-list">{issues.map((issue) => <article key={`${issue.item_id}:${issue.issue_key}`}><div><button className="quality-code" onClick={() => onOpenItem(issue.item_id)}>{issue.code || issue.item_id}</button><strong>{issue.title || "—"}</strong></div><span>{issue.original_value || "—"}</span><em>{issue.suggestion}</em><button onClick={() => void toggleIgnore(issue)}>{showIgnored ? "取消忽略" : "忽略"}</button></article>)}</div>
      )}
    </section>
  );
}
