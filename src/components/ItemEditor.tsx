import { Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { classifyItem, libraryTree } from "../lib/taxonomy";
import { getWatchProgress, getWatchStatus, isSeriesLike, updateWatchProgress, watchStatuses } from "../lib/watch";
import type { ItemInput, MediaItem, WatchStatus } from "../types";

export function ItemEditor({ item, onClose, onSave, onDelete }: { item: MediaItem; onClose: () => void; onSave: (input: ItemInput) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [form, setForm] = useState(() => toForm(item));
  const [savedForm, setSavedForm] = useState(() => toForm(item));
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const seriesLike = useMemo(() => isSeriesLike({ ...item, type: form.type, category: form.category } as MediaItem), [item, form.type, form.category]);
  const hasUnsavedChanges = useMemo(() => JSON.stringify(form) !== JSON.stringify(savedForm), [form, savedForm]);

  useEffect(() => {
    const nextForm = toForm(item);
    setForm(nextForm);
    setSavedForm(nextForm);
    setMetadataOpen(false);
    setError("");
  }, [item.id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      requestCloseWithConfirmation();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasUnsavedChanges, onClose]);

  function requestCloseWithConfirmation() {
    if (hasUnsavedChanges && !window.confirm("有未儲存的變更，確定要關閉編輯面板嗎？")) return;
    onClose();
  }

  function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    requestCloseWithConfirmation();
  }

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await onSave(toInput(form));
      setSavedForm(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("確定要刪除這筆紀錄嗎？")) return;
    setSaving(true);
    await onDelete(item.id);
  }

  return (
    <div className="drawer-backdrop" onClick={handleBackdropClick}>
      <aside className="drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <p className="eyebrow">編輯紀錄</p>
            <h2>{item.official_title || item.raw_title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="關閉"><X size={18} /></button>
        </header>
        {error && <div className="notice danger">{error}</div>}

        <div className="form-grid">
          <label className="wide">
            觀看狀態
            <select value={form.watch_status} onChange={(event) => setForm({ ...form, watch_status: event.target.value as WatchStatus })}>
              {watchStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </label>

          <Field label="原始標題" value={form.raw_title} onChange={(value) => setForm({ ...form, raw_title: value })} required />
          <Field label="正式標題" value={form.official_title} onChange={(value) => setForm({ ...form, official_title: value })} />
          <Field label="原文標題" value={form.original_title} onChange={(value) => setForm({ ...form, original_title: value })} />
          <Field label="代碼" value={form.code} onChange={(value) => setForm({ ...form, code: value })} />

          <label>
            類型
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              {libraryTree.map((entry) => <option key={entry.label} value={entry.label}>{entry.label}</option>)}
            </select>
          </label>
          <Field label="分類 / 地區" value={form.category} onChange={(value) => setForm({ ...form, category: value })} />
          <Field label="平台" value={form.platform} onChange={(value) => setForm({ ...form, platform: value })} />
          <Field label="年份" value={form.release_year} onChange={(value) => setForm({ ...form, release_year: value })} inputMode="numeric" />

          <Field label="預計看" value={form.planned_at} onChange={(value) => setForm({ ...form, planned_at: value })} type="date" />
          <Field label="開始看" value={form.started_at} onChange={(value) => setForm({ ...form, started_at: value })} type="date" />
          <Field label="看完" value={form.completed_at} onChange={(value) => setForm({ ...form, completed_at: value })} type="date" />
          <Field label="紀錄日期" value={form.watched_at} onChange={(value) => setForm({ ...form, watched_at: value })} type="date" />

          {seriesLike && (
            <section className="editor-section wide">
              <h3>追劇進度</h3>
              <div className="form-grid nested">
                <Field label="目前季數" value={form.current_season} onChange={(value) => setForm({ ...form, current_season: value })} inputMode="numeric" />
                <Field label="目前集數" value={form.current_episode} onChange={(value) => setForm({ ...form, current_episode: value })} inputMode="numeric" />
                <Field label="總季數" value={form.total_seasons} onChange={(value) => setForm({ ...form, total_seasons: value })} inputMode="numeric" />
                <Field label="總集數" value={form.total_episodes} onChange={(value) => setForm({ ...form, total_episodes: value })} inputMode="numeric" />
                <Field label="單集分鐘" value={form.episode_runtime} onChange={(value) => setForm({ ...form, episode_runtime: value })} inputMode="numeric" />
                <Field label="進度備註" value={form.progress_note} onChange={(value) => setForm({ ...form, progress_note: value })} />
              </div>
            </section>
          )}

          <section className="editor-section wide">
            <h3>觀看心得</h3>
            <div className="form-grid nested">
              <Field label="評分" value={form.rating} onChange={(value) => setForm({ ...form, rating: value })} inputMode="decimal" />
              <Field label="重看分數" value={form.rewatch_score} onChange={(value) => setForm({ ...form, rewatch_score: value })} inputMode="decimal" />
              <label className="check"><input type="checkbox" checked={form.favorite} onChange={(event) => setForm({ ...form, favorite: event.target.checked })} />收藏</label>
              <Field label="標籤" value={form.tags} onChange={(value) => setForm({ ...form, tags: value })} />
              <label className="wide">快速筆記<textarea value={form.quick_note} onChange={(event) => setForm({ ...form, quick_note: event.target.value })} rows={3} /></label>
              <label className="wide">長筆記<textarea value={form.long_note} onChange={(event) => setForm({ ...form, long_note: event.target.value })} rows={6} /></label>
            </div>
          </section>

          <Field label="來源網址" value={form.source_url} onChange={(value) => setForm({ ...form, source_url: value })} />
          <Field label="封面網址" value={form.cover_url} onChange={(value) => setForm({ ...form, cover_url: value })} />
          <Field label="人物" value={form.people} onChange={(value) => setForm({ ...form, people: value })} />
          <Field label="清單" value={form.collections} onChange={(value) => setForm({ ...form, collections: value })} />

          <section className="editor-section wide">
            <h3>進階</h3>
            <label className="check"><input type="checkbox" checked={form.is_private} onChange={(event) => setForm({ ...form, is_private: event.target.checked })} />私密紀錄</label>
            <button type="button" onClick={() => setMetadataOpen((open) => !open)}>{metadataOpen ? "收合" : "展開"} TMDb 原始資料</button>
            {metadataOpen && <textarea value={form.metadata_json} onChange={(event) => setForm({ ...form, metadata_json: event.target.value })} rows={8} />}
          </section>
        </div>

        <footer className="drawer-actions">
          <button className="danger-button" onClick={remove} disabled={saving}><Trash2 size={16} />刪除</button>
          <button className="primary" onClick={submit} disabled={saving || !form.raw_title.trim()}><Save size={16} />儲存</button>
        </footer>
      </aside>
    </div>
  );
}

function Field({ label, value, onChange, required, type = "text", inputMode }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; inputMode?: "numeric" | "decimal" }) {
  return (
    <label>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} required={required} type={type} inputMode={inputMode} />
    </label>
  );
}

function toForm(item: MediaItem) {
  const progress = getWatchProgress(item);
  const classification = classifyItem(item);
  return {
    raw_title: item.raw_title,
    official_title: item.official_title || "",
    original_title: item.original_title || "",
    code: item.code || "",
    type: classification.type,
    category: classification.category || item.category || "",
    platform: item.platform || "",
    release_year: item.release_year?.toString() || "",
    watched_at: item.watched_at || "",
    started_at: item.started_at || "",
    completed_at: item.completed_at || "",
    planned_at: item.planned_at || "",
    rating: item.rating?.toString() || "",
    rewatch_score: item.rewatch_score?.toString() || "",
    favorite: item.favorite,
    is_private: item.is_private,
    watch_status: getWatchStatus(item),
    current_season: progress.current_season?.toString() || "",
    current_episode: progress.current_episode?.toString() || "",
    total_seasons: progress.total_seasons?.toString() || "",
    total_episodes: progress.total_episodes?.toString() || "",
    episode_runtime: progress.episode_runtime?.toString() || "",
    progress_note: progress.progress_note || "",
    quick_note: item.quick_note || "",
    long_note: item.long_note || "",
    source_url: item.source_url || "",
    cover_url: item.cover_url || "",
    metadata_json: item.metadata_json || "",
    tags: item.tags.join(", "),
    people: item.people.join(", "),
    collections: item.collections.join(", ")
  };
}

function toInput(form: ReturnType<typeof toForm>): ItemInput {
  const progressPatch = updateWatchProgress({ ...({} as MediaItem), status: "raw", progress_json: null } as MediaItem, {
    watch_status: form.watch_status,
    current_season: numberOrNull(form.current_season),
    current_episode: numberOrNull(form.current_episode),
    total_seasons: numberOrNull(form.total_seasons),
    total_episodes: numberOrNull(form.total_episodes),
    episode_runtime: numberOrNull(form.episode_runtime),
    progress_note: form.progress_note.trim()
  });
  return {
    raw_title: form.raw_title,
    official_title: emptyToNull(form.official_title),
    original_title: emptyToNull(form.original_title),
    code: emptyToNull(form.code),
    type: emptyToNull(form.type),
    category: emptyToNull(form.category),
    platform: emptyToNull(form.platform),
    release_year: numberOrNull(form.release_year),
    watched_at: emptyToNull(form.watched_at),
    started_at: emptyToNull(form.started_at),
    completed_at: emptyToNull(form.completed_at),
    planned_at: emptyToNull(form.planned_at),
    rating: numberOrNull(form.rating),
    rewatch_score: numberOrNull(form.rewatch_score),
    favorite: form.favorite,
    is_private: form.is_private,
    quick_note: emptyToNull(form.quick_note),
    long_note: emptyToNull(form.long_note),
    source_url: emptyToNull(form.source_url),
    cover_url: emptyToNull(form.cover_url),
    metadata_json: emptyToNull(form.metadata_json),
    tags: splitList(form.tags),
    people: splitList(form.people),
    collections: splitList(form.collections),
    ...progressPatch
  };
}

function emptyToNull(value: string) {
  return value.trim() || null;
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function splitList(value: string) {
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}
