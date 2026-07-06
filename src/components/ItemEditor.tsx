import { Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { isPrivateItem, PRIVATE_LIBRARY_LABEL, privateItemDetails } from "../lib/privacy";
import { collectionLevelOptions, getReflectionFromMetadata, mergeReflectionMetadata, moodOptions, rewatchIntentOptions } from "../lib/reflection";
import { classifyItem, libraryTree } from "../lib/taxonomy";
import { getWatchProgress, getWatchStatus, isSeriesLike, updateWatchProgress, watchStatuses } from "../lib/watch";
import type { ItemInput, MediaItem, WatchStatus } from "../types";

const platformOptions = ["Netflix", "Disney+", "Prime Video", "Apple TV+", "HBO Max", "YouTube", "Crunchyroll", "電影院", "DVD / BD", "其他"];

export function ItemEditor({
  item,
  privateMode = false,
  onClose,
  onSave,
  onDelete
}: {
  item: MediaItem;
  privateMode?: boolean;
  onClose: () => void;
  onSave: (input: ItemInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState(() => toForm(item));
  const [savedForm, setSavedForm] = useState(() => toForm(item));
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const privateEditor = privateMode || form.is_private;
  const seriesLike = useMemo(() => !privateEditor && isSeriesLike({ ...item, type: form.type, category: form.category } as MediaItem), [item, form.type, form.category, privateEditor]);
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
      <aside className={privateEditor ? "drawer private-editor" : "drawer"} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <p className="eyebrow">{privateEditor ? "私密內容編輯" : "編輯紀錄"}</p>
            <h2>{privateEditor ? privateHeader(form) : item.official_title || item.raw_title}</h2>
          </div>
          {hasUnsavedChanges && <span className="unsaved-badge">未儲存</span>}
          <button className="icon-button" onClick={requestCloseWithConfirmation} aria-label="關閉"><X size={18} /></button>
        </header>
        {error && <div className="notice danger">{error}</div>}

        {privateEditor ? (
          <PrivateForm form={form} setForm={setForm} />
        ) : (
          <GeneralForm form={form} setForm={setForm} seriesLike={seriesLike} metadataOpen={metadataOpen} setMetadataOpen={setMetadataOpen} />
        )}

        <footer className="drawer-actions">
          <button className="danger-button" onClick={remove} disabled={saving}><Trash2 size={16} />刪除</button>
          <button className="primary" onClick={submit} disabled={saving || !canSave(form)}><Save size={16} />儲存</button>
        </footer>
      </aside>
    </div>
  );
}

function GeneralForm({
  form,
  setForm,
  seriesLike,
  metadataOpen,
  setMetadataOpen
}: {
  form: FormState;
  setForm: (form: FormState) => void;
  seriesLike: boolean;
  metadataOpen: boolean;
  setMetadataOpen: (open: boolean | ((open: boolean) => boolean)) => void;
}) {
  return (
    <div className="form-stack">
      <section className="editor-section wide">
        <h3>核心資料</h3>
        <div className="form-grid nested">
          <Field label="原始標題" value={form.raw_title} onChange={(value) => setForm({ ...form, raw_title: value })} required />
          <Field label="正式標題" value={form.official_title} onChange={(value) => setForm({ ...form, official_title: value })} />
          <Field label="原文標題" value={form.original_title} onChange={(value) => setForm({ ...form, original_title: value })} />
          <label>
            類型
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              {typeOptions(form.type).map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <Field label="分類 / 地區" value={form.category} onChange={(value) => setForm({ ...form, category: value })} />
          <PlatformField value={form.platform} onChange={(value) => setForm({ ...form, platform: value })} />
          <Field label="年份" value={form.release_year} onChange={(value) => setForm({ ...form, release_year: value })} inputMode="numeric" />
          <Field label="人物" value={form.people} onChange={(value) => setForm({ ...form, people: value })} />
          <Field label="清單" value={form.collections} onChange={(value) => setForm({ ...form, collections: value })} />
        </div>
      </section>

      <section className="editor-section wide">
        <h3>觀看狀態與日期</h3>
        <div className="form-grid nested">
          <label className="wide">
            觀看狀態
            <select value={form.watch_status} onChange={(event) => setForm({ ...form, watch_status: event.target.value as WatchStatus })}>
              {watchStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </label>
          <Field label="想看日期" value={form.planned_at} onChange={(value) => setForm({ ...form, planned_at: value })} type="date" />
          <Field label="觀看日期" value={form.watched_at} onChange={(value) => setForm({ ...form, watched_at: value })} type="date" />
          {!seriesLike && (
            <label className="check wide completion-check">
              <input
                type="checkbox"
                checked={form.watch_status === "completed"}
                onChange={(event) => setForm({
                  ...form,
                  watch_status: event.target.checked ? "completed" : "watching",
                  watched_at: event.target.checked && !form.watched_at ? todayDate() : form.watched_at
                })}
              />
              看完（1/1）
            </label>
          )}
        </div>
      </section>

      {seriesLike && (
        <section className="editor-section wide">
          <h3>追劇進度</h3>
          <div className="form-grid nested">
            <Field label="目前季數" value={form.current_season} onChange={(value) => setForm({ ...form, current_season: value })} inputMode="numeric" />
            <Field label="總季數" value={form.total_seasons} onChange={(value) => setForm({ ...form, total_seasons: value })} inputMode="numeric" />
            <Field label="目前集數" value={form.current_episode} onChange={(value) => setForm({ ...form, current_episode: value })} inputMode="numeric" />
            <Field label="總集數" value={form.total_episodes} onChange={(value) => setForm({ ...form, total_episodes: value })} inputMode="numeric" />
          </div>
        </section>
      )}

      <section className="editor-section wide">
        <h3>觀看心得</h3>
        <div className="form-grid nested">
          <Field label="評分（0-10）" value={form.rating} onChange={(value) => setForm({ ...form, rating: value })} inputMode="decimal" />
          <Field label="重看分數（0-10）" value={form.rewatch_score} onChange={(value) => setForm({ ...form, rewatch_score: value })} inputMode="decimal" />
          <SelectField label="心情" value={form.mood} options={moodOptions} onChange={(value) => setForm({ ...form, mood: value })} />
          <SelectField label="重看" value={form.rewatch_intent} options={rewatchIntentOptions} onChange={(value) => setForm({ ...form, rewatch_intent: value })} />
          <SelectField label="收藏等級" value={form.collection_level} options={collectionLevelOptions} onChange={(value) => setForm({ ...form, collection_level: value })} />
          <label className="check"><input type="checkbox" checked={form.favorite} onChange={(event) => setForm({ ...form, favorite: event.target.checked })} />星標收藏</label>
          <Field label="標籤" value={form.tags} onChange={(value) => setForm({ ...form, tags: value })} />
          <label className="wide">快速筆記<textarea value={form.quick_note} onChange={(event) => setForm({ ...form, quick_note: event.target.value })} rows={3} /></label>
          <label className="wide">長筆記<textarea value={form.long_note} onChange={(event) => setForm({ ...form, long_note: event.target.value })} rows={6} /></label>
        </div>
      </section>

      <section className="editor-section wide">
        <h3>進階</h3>
        <div className="form-grid nested">
          <Field label="來源網址" value={form.source_url} onChange={(value) => setForm({ ...form, source_url: value })} />
          <Field label="封面網址" value={form.cover_url} onChange={(value) => setForm({ ...form, cover_url: value })} />
          <label className="check"><input type="checkbox" checked={form.is_private} onChange={(event) => setForm({ ...form, is_private: event.target.checked })} />私密紀錄</label>
        </div>
        <button type="button" onClick={() => setMetadataOpen((open) => !open)}>{metadataOpen ? "收合" : "展開"} 原始補充資料</button>
        {metadataOpen && <textarea value={form.metadata_json} onChange={(event) => setForm({ ...form, metadata_json: event.target.value })} rows={8} />}
      </section>
    </div>
  );
}

function PrivateForm({
  form,
  setForm
}: {
  form: FormState;
  setForm: (form: FormState) => void;
}) {
  return (
    <div className="form-stack private-form-grid">
      <section className="editor-section wide">
        <h3>核心資料</h3>
        <div className="form-grid nested">
          <Field label="番號" value={form.private_code} onChange={(value) => setForm({ ...form, private_code: value, code: value })} />
          <Field label="片名" value={form.private_title} onChange={(value) => setForm({ ...form, private_title: value })} />
          <Field label="女優 / 演員" value={form.private_performers} onChange={(value) => setForm({ ...form, private_performers: value, people: value })} />
          <Field label="片商" value={form.private_studio} onChange={(value) => setForm({ ...form, private_studio: value, platform: value })} />
          <Field label="發售年份" value={form.release_year} onChange={(value) => setForm({ ...form, release_year: value })} inputMode="numeric" />
          <Field label="類型" value={form.private_type} onChange={(value) => setForm({ ...form, private_type: value, category: value })} />
        </div>
      </section>

      <section className="editor-section wide">
        <h3>私密紀錄</h3>
        <div className="form-grid nested">
          <Field label="評分（0-10）" value={form.rating} onChange={(value) => setForm({ ...form, rating: value })} inputMode="decimal" />
          <label className="check"><input type="checkbox" checked={form.used} onChange={(event) => setForm({ ...form, used: event.target.checked })} />已使用</label>
          <SelectField label="收藏等級" value={form.collection_level} options={collectionLevelOptions} onChange={(value) => setForm({ ...form, collection_level: value })} />
          <Field label="標籤" value={form.tags} onChange={(value) => setForm({ ...form, tags: value })} />
          <label className="wide">快速筆記<textarea value={form.quick_note} onChange={(event) => setForm({ ...form, quick_note: event.target.value })} rows={3} /></label>
        </div>
      </section>
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

function PlatformField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const options = value && !platformOptions.includes(value) ? [...platformOptions, value] : platformOptions;
  return (
    <label>
      平台
      <input list="platform-options" value={value} onChange={(event) => onChange(event.target.value)} />
      <datalist id="platform-options">
        {options.map((platform) => <option key={platform} value={platform} />)}
      </datalist>
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">未設定</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function toForm(item: MediaItem) {
  const progress = getWatchProgress(item);
  const classification = classifyItem(item);
  const details = privateItemDetails(item);
  const metadata = parseMetadata(item.metadata_json);
  const reflection = getReflectionFromMetadata(metadata);
  const privateTitle = details.title === "-" ? "" : details.title;
  const privateType = details.type === PRIVATE_LIBRARY_LABEL ? "" : details.type;
  const isPrivate = item.is_private || isPrivateItem(item);
  return {
    raw_title: item.raw_title,
    official_title: item.official_title || "",
    original_title: item.original_title || "",
    code: item.code || "",
    type: item.type || classification.type,
    category: item.category || classification.category || "",
    platform: item.platform || "",
    release_year: item.release_year?.toString() || (details.releaseYear !== "-" ? details.releaseYear : ""),
    watched_at: item.watched_at || item.completed_at || item.started_at || "",
    started_at: item.started_at || "",
    completed_at: item.completed_at || "",
    planned_at: item.planned_at || "",
    rating: item.rating?.toString() || "",
    rewatch_score: item.rewatch_score?.toString() || "",
    favorite: item.favorite,
    is_private: isPrivate,
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
    collections: item.collections.join(", "),
    mood: reflection.mood,
    rewatch_intent: reflection.rewatch_intent,
    collection_level: reflection.collection_level,
    used: privateUsedValue(metadata),
    private_code: details.code !== "-" ? details.code : "",
    private_title: privateTitle,
    private_performers: details.performers !== "-" ? details.performers : metadataList(metadata, ["actresses", "performers", "cast", "actors"]),
    private_studio: details.studio !== "-" ? details.studio : "",
    private_type: privateType
  };
}

type FormState = ReturnType<typeof toForm>;

function toInput(form: FormState): ItemInput {
  if (form.is_private) return toPrivateInput(form);

  const progressPatch = progressInput(form, isSeriesType(form.type, form.category));
  const metadata = mergeReflectionMetadata(form.metadata_json, reflectionInput(form));
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
    started_at: null,
    completed_at: null,
    planned_at: emptyToNull(form.planned_at),
    rating: numberOrNull(form.rating),
    rewatch_score: numberOrNull(form.rewatch_score),
    favorite: form.favorite,
    is_private: form.is_private,
    quick_note: emptyToNull(form.quick_note),
    long_note: emptyToNull(form.long_note),
    source_url: emptyToNull(form.source_url),
    cover_url: emptyToNull(form.cover_url),
    metadata_json: metadataToString(metadata),
    tags: splitList(form.tags),
    people: splitList(form.people),
    collections: splitList(form.collections),
    ...progressPatch
  };
}

function toPrivateInput(form: FormState): ItemInput {
  const code = form.private_code.trim();
  const title = form.private_title.trim();
  const performers = splitList(form.private_performers);
  const studio = form.private_studio.trim();
  const privateType = form.private_type.trim();
  const metadata = mergePrivateMetadata(form.metadata_json, {
    code,
    title,
    performers,
    studio,
    releaseYear: form.release_year.trim(),
    type: privateType
  });
  const metadataWithReflection = mergeReflectionMetadata(JSON.stringify(metadata), privateReflectionInput(form));
  const metadataWithUsed = mergePrivateUsedMetadata(JSON.stringify(metadataWithReflection), form.used);

  return {
    raw_title: title || code || form.raw_title,
    official_title: title || null,
    original_title: emptyToNull(form.original_title),
    code: code || null,
    type: PRIVATE_LIBRARY_LABEL,
    category: privateType || null,
    platform: studio || null,
    release_year: numberOrNull(form.release_year),
    watched_at: null,
    started_at: null,
    completed_at: null,
    planned_at: null,
    rating: numberOrNull(form.rating),
    rewatch_score: null,
    favorite: false,
    is_private: true,
    quick_note: emptyToNull(form.quick_note),
    long_note: null,
    source_url: emptyToNull(form.source_url),
    cover_url: emptyToNull(form.cover_url),
    metadata_json: metadataToString(metadataWithUsed),
    tags: splitList(form.tags),
    people: performers,
    collections: splitList(form.collections),
    ...privateProgressInput()
  };
}

function progressInput(form: FormState, includeSeriesProgress: boolean) {
  if (!includeSeriesProgress) {
    return updateWatchProgress({ ...({} as MediaItem), status: "raw", progress_json: null } as MediaItem, {
      watch_status: form.watch_status,
      current_episode: form.watch_status === "completed" ? 1 : null,
      total_episodes: 1
    });
  }
  return updateWatchProgress({ ...({} as MediaItem), status: "raw", progress_json: null } as MediaItem, {
    watch_status: form.watch_status,
    current_season: numberOrNull(form.current_season),
    current_episode: numberOrNull(form.current_episode),
    total_seasons: numberOrNull(form.total_seasons),
    total_episodes: numberOrNull(form.total_episodes)
  });
}

function privateProgressInput() {
  return {
    status: "raw" as const,
    progress_json: null
  };
}

function reflectionInput(form: FormState) {
  return {
    mood: form.mood,
    rewatch_intent: form.rewatch_intent,
    collection_level: form.collection_level
  };
}

function privateReflectionInput(form: FormState) {
  return {
    mood: "",
    rewatch_intent: "",
    collection_level: form.collection_level
  };
}

function canSave(form: FormState) {
  if (form.is_private) return Boolean(form.private_code.trim() || form.private_title.trim() || form.raw_title.trim());
  return Boolean(form.raw_title.trim());
}

function privateHeader(form: FormState) {
  return form.private_code || form.private_title || form.raw_title || "私密紀錄";
}

function typeOptions(current: string) {
  const options: string[] = libraryTree.map((entry) => entry.label);
  return current && !options.includes(current) ? [...options, current] : options;
}

function isSeriesType(type: string, category = "") {
  const text = `${type} ${category}`.trim().toLowerCase();
  return ["影集", "沙雕动画", "series", "tv", "tv show", "drama"].some((term) => text.includes(term.toLowerCase()));
}

function mergePrivateMetadata(value: string, update: { code: string; title: string; performers: string[]; studio: string; releaseYear: string; type: string }) {
  const metadata = parseMetadata(value);
  setOrDelete(metadata, "code", update.code);
  setOrDelete(metadata, "title", update.title);
  setOrDelete(metadata, "actresses", update.performers);
  setOrDelete(metadata, "performers", update.performers);
  setOrDelete(metadata, "studio", update.studio);
  setOrDelete(metadata, "maker", update.studio);
  setOrDelete(metadata, "year", update.releaseYear);
  setOrDelete(metadata, "type", update.type);
  return metadata;
}

function privateUsedValue(metadata: Record<string, unknown>) {
  const raw = metadata.used ?? metadata.is_used ?? metadata.viewed;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw === 1;
  if (typeof raw === "string") return ["true", "1", "yes", "y", "已使用", "使用過", "used"].includes(raw.trim().toLowerCase());
  return false;
}

function mergePrivateUsedMetadata(value: string | null, used: boolean) {
  const metadata = parseMetadata(value);
  if (used) metadata.used = true;
  else delete metadata.used;
  return metadata;
}

function setOrDelete(metadata: Record<string, unknown>, key: string, value: string | string[]) {
  if (Array.isArray(value)) {
    if (value.length > 0) metadata[key] = value;
    else delete metadata[key];
    return;
  }
  if (value.trim()) metadata[key] = value.trim();
  else delete metadata[key];
}

function parseMetadata(value: string | null) {
  if (!value) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function metadataList(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (Array.isArray(value)) return value.map(String).join(", ");
    if (typeof value === "string") return value;
  }
  return "";
}

function emptyToNull(value: string) {
  return value.trim() || null;
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function todayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function metadataToString(metadata: Record<string, unknown>) {
  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
}

function splitList(value: string) {
  return value.split(/[,，]/).map((entry) => entry.trim()).filter(Boolean);
}
