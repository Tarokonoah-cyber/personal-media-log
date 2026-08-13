import { Link2, RefreshCw, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { applyEntityMerge, getNormalizationOverview, previewEntityMerge, registerEntityAlias, rollbackEntityMerge } from "../lib/api";
import type { EntityMergePreview, NormalizationCluster, NormalizationEntityType } from "../types";

const entityLabels: Record<NormalizationEntityType, string> = { tag: "標籤", person: "人物", maker: "片商", platform: "平台" };

export function NormalizationPanel() {
  const [entityType, setEntityType] = useState<NormalizationEntityType>("tag");
  const [query, setQuery] = useState("");
  const [clusters, setClusters] = useState<NormalizationCluster[]>([]);
  const [scanned, setScanned] = useState(0);
  const [canonical, setCanonical] = useState("");
  const [alias, setAlias] = useState("");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [mergePreview, setMergePreview] = useState<EntityMergePreview | null>(null);
  const [recoveryId, setRecoveryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (type: NormalizationEntityType, q: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await getNormalizationOverview(type, q);
      setClusters(response.clusters);
      setScanned(response.scanned);
    } catch (err) {
      setError(err instanceof Error ? err.message : "正規化資料載入失敗");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(entityType, query), 200);
    return () => window.clearTimeout(timer);
  }, [entityType, load, query]);

  async function saveAlias() {
    if (!canonical.trim() || !alias.trim()) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await registerEntityAlias(entityType, canonical, alias);
      setMessage("已登記 alias；尚未改寫任何 item 資料");
      setAlias("");
      await load(entityType, query);
    } catch (err) { setError(err instanceof Error ? err.message : "Alias 登記失敗"); setBusy(false); }
  }

  async function openMergePreview() {
    if ((entityType !== "tag" && entityType !== "person") || !source.trim() || !target.trim()) return;
    setBusy(true); setError(""); setMessage("");
    try { setMergePreview(await previewEntityMerge(entityType, source, target)); }
    catch (err) { setError(err instanceof Error ? err.message : "合併預覽失敗"); }
    finally { setBusy(false); }
  }

  async function confirmMerge() {
    if (!mergePreview) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await applyEntityMerge(mergePreview.entityType, mergePreview.before.source, mergePreview.before.target);
      setRecoveryId(result.mergeId);
      setMergePreview(null);
      setSource(""); setTarget("");
      setMessage(`合併已套用；Recovery ID：${result.mergeId}`);
      await load(entityType, query);
    } catch (err) { setError(err instanceof Error ? err.message : "合併套用失敗"); setBusy(false); }
  }

  async function rollback() {
    if (!recoveryId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await rollbackEntityMerge(recoveryId);
      setMessage("合併已回復，relations 與 merge 建立的 alias 均已還原");
      setRecoveryId("");
      await load(entityType, query);
    } catch (err) { setError(err instanceof Error ? err.message : "合併回復失敗"); setBusy(false); }
  }

  const mergeable = entityType === "tag" || entityType === "person";

  return (
    <details className="normalization-panel">
      <summary><span>Entity / Metadata 正規化</span><b>{scanned} 個值已掃描</b></summary>
      <div className="normalization-toolbar">
        <div role="tablist" aria-label="Entity 類型">{(Object.keys(entityLabels) as NormalizationEntityType[]).map((type) => <button key={type} role="tab" aria-selected={entityType === type} className={entityType === type ? "active" : ""} onClick={() => { setEntityType(type); setMergePreview(null); }}>{entityLabels[type]}</button>)}</div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋 canonical / alias" aria-label="搜尋正規化值"/>
        <button disabled={busy} onClick={() => void load(entityType, query)}><RefreshCw size={14}/>重新掃描</button>
      </div>
      {error ? <div className="notice danger" role="alert">{error}</div> : null}
      {message ? <div className="notice success" role="status">{message}</div> : null}
      <section className="normalization-form" aria-label="登記 alias">
        <header><strong>Canonical 與 Alias</strong><small>只建立比較 identity，不覆寫 display value</small></header>
        <input value={canonical} onChange={(event) => setCanonical(event.target.value)} placeholder="Canonical display value"/>
        <input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="Alias / historical value"/>
        <button disabled={busy || !canonical.trim() || !alias.trim()} onClick={() => void saveAlias()}><Link2 size={14}/>登記 Alias</button>
      </section>
      {mergeable ? <section className="normalization-form" aria-label="Entity 合併">
        <header><strong>{entityLabels[entityType]}合併</strong><small>先預覽受影響 relations，再明確確認</small></header>
        <input value={source} onChange={(event) => { setSource(event.target.value); setMergePreview(null); }} placeholder="來源值（將成為 alias）"/>
        <input value={target} onChange={(event) => { setTarget(event.target.value); setMergePreview(null); }} placeholder="目標 canonical"/>
        <button disabled={busy || !source.trim() || !target.trim()} onClick={() => void openMergePreview()}>預覽合併</button>
      </section> : null}
      {mergePreview ? <section className="normalization-preview" aria-label="Entity 合併預覽">
        <header><strong>Before → After</strong><button onClick={() => setMergePreview(null)}>關閉</button></header>
        <p><span>{mergePreview.before.source} + {mergePreview.before.target}</span><b>→</b><strong>{mergePreview.after.canonical}</strong></p>
        <dl><div><dt>受影響 items</dt><dd>{mergePreview.affectedItems}</dd></div><div><dt>來源 relations</dt><dd>{mergePreview.sourceRelations}</dd></div><div><dt>避免重複 relations</dt><dd>{mergePreview.duplicateRelationsAvoided}</dd></div></dl>
        <small>將登記 alias「{mergePreview.after.aliasAdded}」；不會丟失既有 target relations。</small>
        <button className="primary" disabled={busy} onClick={() => void confirmMerge()}>確認合併</button>
      </section> : null}
      {recoveryId ? <div className="normalization-recovery"><span>Recovery ID：{recoveryId}</span><button disabled={busy} onClick={() => void rollback()}><RotateCcw size={14}/>Undo 合併</button></div> : null}
      <div className="normalization-clusters" role="list" aria-label="正規化群組">
        {clusters.map((cluster) => <article key={cluster.normalizedKey} role="listitem"><div><strong>{cluster.canonical}</strong><small>{cluster.normalizedKey}</small></div><span>{cluster.affectedItems} items</span><div>{cluster.aliases.map((value) => <code key={value}>{value}</code>)}</div></article>)}
      </div>
      {!busy && !clusters.length ? <p className="quality-state">沒有需要 review 的群組；可搜尋查看現有值。</p> : null}
    </details>
  );
}
