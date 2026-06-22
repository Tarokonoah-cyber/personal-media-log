import { Archive, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ItemInput, MediaItem } from "../types";

type EditableStatus = "raw" | "partial" | "complete" | "archived";

export function ItemEditor({ item, onClose, onSave, onDelete }: { item: MediaItem; onClose: () => void; onSave: (input: ItemInput) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [form, setForm] = useState(() => toForm(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await onSave(toInput(form));
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    await onDelete(item.id);
  }

  return (
    <div className="drawer-backdrop">
      <aside className="drawer">
        <header className="drawer-head">
          <div>
            <p className="eyebrow">Edit</p>
            <h2>{item.raw_title}</h2>
          </div>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </header>
        {error && <div className="notice danger">{error}</div>}
        <div className="form-grid">
          <Field label="原始標題" value={form.raw_title} onChange={(value) => setForm({ ...form, raw_title: value })} required />
          <Field label="正式標題" value={form.official_title} onChange={(value) => setForm({ ...form, official_title: value })} />
          <Field label="原文標題" value={form.original_title} onChange={(value) => setForm({ ...form, original_title: value })} />
          <Field label="代碼" value={form.code} onChange={(value) => setForm({ ...form, code: value })} />
          <Field label="類型" value={form.type} onChange={(value) => setForm({ ...form, type: value })} />
          <Field label="分類" value={form.category} onChange={(value) => setForm({ ...form, category: value })} />
          <Field label="平台" value={form.platform} onChange={(value) => setForm({ ...form, platform: value })} />
          <Field label="年份" value={form.release_year} onChange={(value) => setForm({ ...form, release_year: value })} inputMode="numeric" />
          <Field label="觀看日期" value={form.watched_at} onChange={(value) => setForm({ ...form, watched_at: value })} type="date" />
          <Field label="評分" value={form.rating} onChange={(value) => setForm({ ...form, rating: value })} inputMode="decimal" />
          <Field label="重看分" value={form.rewatch_score} onChange={(value) => setForm({ ...form, rewatch_score: value })} inputMode="decimal" />
          <label>
            狀態
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as EditableStatus })}>
              <option value="raw">raw</option>
              <option value="partial">partial</option>
              <option value="complete">complete</option>
              <option value="archived">archived</option>
            </select>
          </label>
          <Field label="來源 URL" value={form.source_url} onChange={(value) => setForm({ ...form, source_url: value })} />
          <Field label="封面 URL" value={form.cover_url} onChange={(value) => setForm({ ...form, cover_url: value })} />
          <Field label="標籤" value={form.tags} onChange={(value) => setForm({ ...form, tags: value })} />
          <Field label="人物" value={form.people} onChange={(value) => setForm({ ...form, people: value })} />
          <Field label="清單" value={form.collections} onChange={(value) => setForm({ ...form, collections: value })} />
          <label className="check wide"><input type="checkbox" checked={form.favorite} onChange={(event) => setForm({ ...form, favorite: event.target.checked })} />收藏</label>
          <label className="wide">
            快速筆記
            <textarea value={form.quick_note} onChange={(event) => setForm({ ...form, quick_note: event.target.value })} rows={3} />
          </label>
          <label className="wide">
            長筆記
            <textarea value={form.long_note} onChange={(event) => setForm({ ...form, long_note: event.target.value })} rows={6} />
          </label>
        </div>
        <footer className="drawer-actions">
          <button onClick={() => setForm({ ...form, status: "archived" })}><Archive size={16} />封存</button>
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
  return {
    raw_title: item.raw_title,
    official_title: item.official_title || "",
    original_title: item.original_title || "",
    code: item.code || "",
    type: item.type || "",
    category: item.category || "",
    platform: item.platform || "",
    release_year: item.release_year?.toString() || "",
    watched_at: item.watched_at || "",
    rating: item.rating?.toString() || "",
    rewatch_score: item.rewatch_score?.toString() || "",
    favorite: item.favorite,
    status: (item.status === "deleted" ? "raw" : item.status) as EditableStatus,
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
    rating: numberOrNull(form.rating),
    rewatch_score: numberOrNull(form.rewatch_score),
    favorite: form.favorite,
    status: form.status,
    quick_note: emptyToNull(form.quick_note),
    long_note: emptyToNull(form.long_note),
    source_url: emptyToNull(form.source_url),
    cover_url: emptyToNull(form.cover_url),
    metadata_json: emptyToNull(form.metadata_json),
    tags: splitList(form.tags),
    people: splitList(form.people),
    collections: splitList(form.collections)
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
