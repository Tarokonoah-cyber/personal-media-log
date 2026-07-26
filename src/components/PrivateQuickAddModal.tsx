import { Check, ChevronDown, CircleAlert, Plus, Trash2, X } from "lucide-react";
import {
  type ClipboardEvent,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import {
  PRIVATE_DEFAULT_ACTRESS,
  privateCollectionLevelLabels,
  privateCollectionLevels,
  privateRatingFromStars,
  privateStarsFromRating,
  type PrivateCollectionLevel
} from "../../shared/privateModel";
import { usePrivateCodeConflict } from "../hooks/usePrivateCodeConflict";
import { searchPrivateFacet } from "../lib/api";
import { readPrivateAddRecents, updatePrivateAddRecents } from "../lib/privateAddRecents";
import {
  applyPrivateAddCodeDefaults,
  privateAddDefaultsForCode,
  privateQuickAddToInput,
  type PrivateAddTouchedFields
} from "../lib/privateQuickAdd";
import {
  clearPrivateSimpleAddDraft,
  emptyPrivateSimpleAddDraft,
  hasMeaningfulPrivateDraft,
  readPrivateSimpleAddDraft,
  savePrivateSimpleAddDraft,
  type PrivateSimpleAddDraft
} from "../lib/privateSimpleAddDraft";
import {
  popPrivateSimpleAddHistoryEntry,
  pushPrivateSimpleAddHistoryEntry
} from "../lib/privateSimpleAddHistory";
import type { PrivateTableMode } from "../lib/privateTablePreferences";
import { addTags, normalizeTags, parseTagInput } from "../lib/tags";
import type { ItemInput, PrivateFacetItem, PrivateFacets } from "../types";
import { PrivateStarRating } from "./PrivateStarRating";

type DraftStatus = "idle" | "restored" | "saving" | "saved" | "error" | "cleared";

export function PrivateQuickAddModal({
  knownTags = [],
  facets,
  tableMode = "all",
  loading,
  onClose,
  onSubmit,
  onOpenExisting
}: {
  knownTags?: string[];
  facets?: PrivateFacets | null;
  tableMode?: PrivateTableMode;
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: ItemInput) => Promise<unknown>;
  onOpenExisting?: (id: string) => void;
}) {
  const [restoredDraft] = useState(() => readPrivateSimpleAddDraft());
  const [draft, setDraft] = useState<PrivateSimpleAddDraft>(
    () => restoredDraft?.draft ?? privateDraftForMode(emptyPrivateSimpleAddDraft(todayDate()), tableMode)
  );
  const [draftStatus, setDraftStatus] = useState<DraftStatus>(restoredDraft ? "restored" : "idle");
  const [draftSavedAt, setDraftSavedAt] = useState(restoredDraft?.savedAt || "");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [moreOpen, setMoreOpen] = useState(() => hasAdvancedValues(restoredDraft?.draft));
  const [recents, setRecents] = useState(() => readPrivateAddRecents());
  const [touched, setTouched] = useState<PrivateAddTouchedFields>(
    () => restoredDraft ? restoredTouchedFields(restoredDraft.draft) : touchedFieldsForMode(tableMode)
  );
  const draftRef = useRef(draft);
  const saveTimerRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const historyEntryActiveRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const codeInputRef = useRef<HTMLInputElement>(null);
  onCloseRef.current = onClose;

  const codeDefaults = useMemo(() => privateAddDefaultsForCode(draft.code), [draft.code]);
  const duplicate = usePrivateCodeConflict(draft.code);
  const effectiveMode = privateDraftMode(draft, codeDefaults.platform, tableMode);
  const isFc2 = effectiveMode === "fc2";
  const isJav = effectiveMode === "jav";
  const isBusy = loading || submitting;
  const canSubmit = Boolean(codeDefaults.code) && duplicate.status !== "conflict";
  const draftMessage = privateDraftStatusMessage(draftStatus, draftSavedAt);
  const frequentTags = useMemo(
    () => normalizeTags([...(facets?.tags || []).map((tag) => tag.value), ...knownTags]).slice(0, 12),
    [facets?.tags, knownTags]
  );
  const actressSuggestions = useMemo(
    () => normalizeTags([...recents.actresses, ...(facets?.actress || []).map((item) => item.value)]).slice(0, 20),
    [facets?.actress, recents.actresses]
  );
  const makerSuggestions = useMemo(
    () => normalizeTags([
      ...recents.makers,
      ...(facets?.javMaker || []).map((item) => item.value),
      ...(facets?.maker || []).map((item) => item.value)
    ]).slice(0, 20),
    [facets?.javMaker, facets?.maker, recents.makers]
  );

  useEffect(() => {
    if (historyEntryActiveRef.current) return;
    historyEntryActiveRef.current = pushPrivateSimpleAddHistoryEntry();
    const handlePopState = () => {
      if (!historyEntryActiveRef.current) return;
      historyEntryActiveRef.current = false;
      onCloseRef.current();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const flushDraft = () => {
      if (!submittedRef.current) savePrivateSimpleAddDraft(draftRef.current);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      window.removeEventListener("pagehide", flushDraft);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      flushDraft();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") return;
      event.preventDefault();
      void submit(event.shiftKey);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function replaceDraft(nextDraft: PrivateSimpleAddDraft) {
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    scheduleDraftSave(nextDraft);
  }

  function patch(next: Partial<PrivateSimpleAddDraft>) {
    if (submitError) setSubmitError("");
    replaceDraft({ ...draftRef.current, ...next });
  }

  function scheduleDraftSave(nextDraft: PrivateSimpleAddDraft) {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    setDraftStatus("saving");
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      const saved = savePrivateSimpleAddDraft(nextDraft);
      if (!saved) {
        setDraftStatus("error");
        return;
      }
      setDraftSavedAt(saved.savedAt);
      setDraftStatus(hasMeaningfulPrivateDraft(nextDraft) ? "saved" : "idle");
    }, 250);
  }

  function changeCode(value: string, normalize = false) {
    const nextDefaults = privateAddDefaultsForCode(value);
    const nextCode = normalize ? nextDefaults.code : value;
    const contextMode = privateDraftMode(draftRef.current, nextDefaults.platform, tableMode);
    replaceDraft(privateDraftForMode(
      applyPrivateAddCodeDefaults(draftRef.current, nextCode, touched),
      contextMode
    ));
  }

  function touchField(field: keyof PrivateAddTouchedFields, value: string) {
    setTouched((current) => ({ ...current, [field]: true }));
    patch({ [field]: value } as Partial<PrivateSimpleAddDraft>);
  }

  async function submit(continueAdding: boolean) {
    if (!canSubmit || isBusy) return;
    setSubmitError("");
    setSubmitting(true);
    const contextMode = privateDraftMode(draftRef.current, codeDefaults.platform, tableMode);
    const finalDraft = privateDraftForMode(
      applyPrivateAddCodeDefaults(draftRef.current, draftRef.current.code, touched),
      contextMode
    );
    replaceDraft(finalDraft);
    try {
      await onSubmit(privateQuickAddToInput(finalDraft));
      const nextRecents = updatePrivateAddRecents(finalDraft);
      if (nextRecents) setRecents(nextRecents);
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      clearPrivateSimpleAddDraft();
      if (continueAdding) {
        resetForm();
        window.requestAnimationFrame(() => codeInputRef.current?.focus());
        return;
      }
      submittedRef.current = true;
      closePreservingDraft();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "無法新增這筆資料，請檢查內容後再試一次。");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    const nextDraft = privateDraftForMode(emptyPrivateSimpleAddDraft(todayDate()), tableMode);
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setTouched(touchedFieldsForMode(tableMode));
    setMoreOpen(false);
    setSubmitError("");
    setDraftSavedAt("");
    setDraftStatus("idle");
  }

  function closePreservingDraft() {
    if (historyEntryActiveRef.current) {
      historyEntryActiveRef.current = false;
      popPrivateSimpleAddHistoryEntry();
    }
    onClose();
  }

  function clearDraft() {
    if (!window.confirm("確定要清除這份尚未新增的草稿嗎？")) return;
    if (!clearPrivateSimpleAddDraft()) {
      setDraftStatus("error");
      return;
    }
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    resetForm();
    setDraftStatus("cleared");
    window.requestAnimationFrame(() => codeInputRef.current?.focus());
  }

  function openExisting() {
    if (!duplicate.conflict || !onOpenExisting) return;
    savePrivateSimpleAddDraft(draftRef.current);
    closePreservingDraft();
    onOpenExisting(duplicate.conflict.id);
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) closePreservingDraft();
  }

  return (
    <div className="simple-add-backdrop private-quick-add-backdrop" onClick={handleBackdropClick}>
      <section className="simple-add-modal private-quick-add-modal" role="dialog" aria-modal="true" aria-label="快速新增私密資料">
        <header className="simple-add-head private-quick-add-head">
          <div>
            <p className="eyebrow">快速新增</p>
            <h2>新增私密資料</h2>
          </div>
          <button className="icon-button" onClick={closePreservingDraft} aria-label="關閉並保留草稿"><X size={18} /></button>
        </header>

        <div className="private-quick-add-scroll">
          <label className="private-quick-code-field">
            <span>番號</span>
            <span className="private-quick-code-input">
              <input
                ref={codeInputRef}
                autoFocus
                value={draft.code}
                onChange={(event) => changeCode(event.target.value)}
                onBlur={(event) => changeCode(event.target.value, true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void submit(false);
                  }
                }}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
                aria-label="番號"
              />
              {effectiveMode !== "all" && (
                <span className={`private-platform-hint is-${effectiveMode}`}>{effectiveMode === "fc2" ? "FC2" : "JAV"}</span>
              )}
            </span>
          </label>

          {duplicate.status === "checking" && <p className="private-code-check" role="status">正在檢查番號...</p>}
          {duplicate.status === "conflict" && duplicate.conflict && (
            <div className="private-code-conflict" role="alert">
              <CircleAlert size={17} aria-hidden="true" />
              <span>
                <strong>這個番號已存在</strong>
                <small>{duplicate.conflict.code}{duplicate.conflict.title && duplicate.conflict.title !== duplicate.conflict.code ? ` — ${duplicate.conflict.title}` : ""}</small>
              </span>
              {onOpenExisting && <button type="button" onClick={openExisting}>開啟</button>}
            </div>
          )}

          <div className="private-quick-properties">
            <label className="private-star-field">
              <span>評分</span>
              <PrivateStarRating
                value={privateRatingFromStars(draft.rating)}
                label="私密評分"
                onChange={(rating) => patch({ rating: rating === null ? "" : String(privateStarsFromRating(rating)) })}
              />
            </label>
            <div className="private-quick-collection-field">
              <span>收藏</span>
              <div className="private-quick-collection-options">
                {privateCollectionLevels.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={draft.collection === level ? "is-selected" : ""}
                    aria-pressed={draft.collection === level}
                    onClick={() => patch({ collection: level })}
                  >
                    {privateCollectionLevelLabels[level]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isJav && (
            <div className="private-quick-jav-fields">
              <SuggestionField
                label="女優"
                value={draft.actress}
                suggestions={actressSuggestions}
                onChange={(value) => touchField("actress", value)}
              />
              <SuggestionField
                label="片商"
                value={draft.maker}
                suggestions={makerSuggestions}
                onChange={(value) => touchField("maker", value)}
              />
            </div>
          )}

          <label className="private-quick-note">
            <span>快速筆記</span>
            <textarea
              rows={2}
              value={draft.summary}
              onChange={(event) => patch({ summary: event.target.value })}
              placeholder="記下最重要的感受"
            />
          </label>

          <PrivateQuickTagPicker
            tags={draft.tags}
            recentTags={recents.tags}
            frequentTags={frequentTags}
            onChange={(tags) => patch({ tags })}
          />

          <button
            type="button"
            className="private-quick-more-toggle"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((current) => !current)}
          >
            <ChevronDown size={16} className={moreOpen ? "is-open" : ""} />
            更多資料
          </button>

          {moreOpen && (
            <div className="private-quick-more-grid">
              {!isFc2 && (
                <label>
                  片名
                  <input value={draft.title} onChange={(event) => patch({ title: event.target.value })} />
                </label>
              )}
              {!isJav && !isFc2 && (
                <SuggestionField
                  label="女優"
                  value={draft.actress}
                  suggestions={actressSuggestions}
                  onChange={(value) => touchField("actress", value)}
                />
              )}
              {effectiveMode === "all" && (
                <label>
                  平台
                  <select value={draft.platform} onChange={(event) => touchField("platform", event.target.value)}>
                    <option value="">自動判斷</option>
                    <option value="FC2">FC2</option>
                    <option value="JAV">JAV</option>
                  </select>
                </label>
              )}
              {!isJav && !isFc2 && (
                <SuggestionField
                  label="片商"
                  value={draft.maker}
                  suggestions={makerSuggestions}
                  onChange={(value) => touchField("maker", value)}
                />
              )}
              <label>
                發行日期
                <input type="date" value={draft.release_date} onChange={(event) => patch({ release_date: event.target.value })} />
              </label>
            </div>
          )}
        </div>

        <div className="simple-add-feedback private-quick-feedback">
          <div className={`simple-add-draft-status ${draftStatus === "error" ? "error" : ""}`} role={draftStatus === "error" ? "alert" : "status"} aria-live="polite">
            <span>{draftMessage}</span>
            {hasMeaningfulPrivateDraft(draft) && (
              <button type="button" className="simple-add-clear-draft" onClick={clearDraft}>
                <Trash2 size={14} aria-hidden="true" />
                清除草稿
              </button>
            )}
          </div>
          {submitError && <div className="simple-add-error" role="alert" aria-live="assertive"><CircleAlert size={17} aria-hidden="true" /><span>{submitError}</span></div>}
        </div>

        <footer className="simple-add-actions private-quick-add-actions">
          <button onClick={closePreservingDraft}>稍後繼續</button>
          <span>
            <button
              type="button"
              className="private-add-next"
              onClick={() => void submit(true)}
              disabled={isBusy || !canSubmit}
              title="新增並繼續"
              aria-label="新增並繼續"
            >
              <Plus size={17} />
            </button>
            <button className="primary" onClick={() => void submit(false)} disabled={isBusy || !canSubmit}>
              <Check size={17} />
              {submitting ? "新增中" : "新增"}
            </button>
          </span>
        </footer>
      </section>
    </div>
  );
}

function PrivateQuickTagPicker({
  tags,
  recentTags,
  frequentTags,
  onChange
}: {
  tags: string[];
  recentTags: string[];
  frequentTags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PrivateFacetItem[]>([]);
  const normalizedTags = useMemo(() => normalizeTags(tags), [tags]);
  const selectedKeys = useMemo(() => new Set(normalizedTags.map(tagKey)), [normalizedTags]);
  const recent = useMemo(
    () => normalizeTags(recentTags).filter((tag) => !selectedKeys.has(tagKey(tag))).slice(0, 6),
    [recentTags, selectedKeys]
  );
  const recentKeys = useMemo(() => new Set(recent.map(tagKey)), [recent]);
  const frequent = useMemo(
    () => normalizeTags(frequentTags).filter((tag) => !selectedKeys.has(tagKey(tag)) && !recentKeys.has(tagKey(tag))).slice(0, 6),
    [frequentTags, recentKeys, selectedKeys]
  );

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void searchPrivateFacet("tag", query, 20, controller.signal)
        .then((result) => setSearchResults(result.items))
        .catch(() => {
          if (!controller.signal.aborted) setSearchResults([]);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const querySuggestions = useMemo(
    () => normalizeTags(searchResults.map((item) => item.value)).filter((tag) => !selectedKeys.has(tagKey(tag))).slice(0, 12),
    [searchResults, selectedKeys]
  );

  function commit(value = query) {
    if (!value.trim()) return;
    onChange(addTags(normalizedTags, value));
    setQuery("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "Tab" || event.key === "," || event.key === "，" || event.key === "、") {
      if (!query.trim()) return;
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === "Backspace" && !query && normalizedTags.length > 0) {
      onChange(normalizedTags.slice(0, -1));
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    if (parseTagInput(text).length <= 1) return;
    event.preventDefault();
    commit(text);
  }

  return (
    <div className="private-quick-tags">
      <span className="private-quick-label">標籤</span>
      <div className="private-quick-tag-input">
        {normalizedTags.map((tag) => (
          <button key={tag} type="button" onClick={() => onChange(normalizedTags.filter((entry) => entry !== tag))} title={`移除 ${tag}`}>
            #{tag}
            <X size={12} />
          </button>
        ))}
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => commit()}
          placeholder={normalizedTags.length ? "" : "輸入或點選標籤"}
        />
      </div>
      {query.trim() ? (
        querySuggestions.length > 0 && (
          <TagSuggestionRow label="搜尋結果" tags={querySuggestions} onSelect={(tag) => onChange(addTags(normalizedTags, tag))} />
        )
      ) : (
        <>
          {recent.length > 0 && <TagSuggestionRow label="最近" tags={recent} onSelect={(tag) => onChange(addTags(normalizedTags, tag))} />}
          {frequent.length > 0 && <TagSuggestionRow label="常用" tags={frequent} onSelect={(tag) => onChange(addTags(normalizedTags, tag))} />}
        </>
      )}
    </div>
  );
}

function TagSuggestionRow({ label, tags, onSelect }: { label: string; tags: string[]; onSelect: (tag: string) => void }) {
  return (
    <div className="private-quick-tag-row">
      <small>{label}</small>
      <span>
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(tag)}
          >
            #{tag}
          </button>
        ))}
      </span>
    </div>
  );
}

function SuggestionField({
  label,
  value,
  suggestions,
  onChange
}: {
  label: string;
  value: string;
  suggestions: string[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <label>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} list={id} />
      <datalist id={id}>{suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
    </label>
  );
}

function privateDraftForMode(draft: PrivateSimpleAddDraft, mode: PrivateTableMode): PrivateSimpleAddDraft {
  if (mode === "fc2") {
    return {
      ...draft,
      title: "",
      actress: PRIVATE_DEFAULT_ACTRESS,
      platform: "FC2",
      maker: "FC2"
    };
  }
  if (mode === "jav") {
    return {
      ...draft,
      actress: draft.actress || PRIVATE_DEFAULT_ACTRESS,
      platform: "JAV",
      maker: draft.maker === "FC2" ? "" : draft.maker
    };
  }
  return draft;
}

function touchedFieldsForMode(mode: PrivateTableMode): PrivateAddTouchedFields {
  return {
    actress: false,
    platform: mode !== "all",
    maker: false
  };
}

function privateDraftMode(
  draft: PrivateSimpleAddDraft,
  inferredPlatform: "FC2" | "JAV" | "unknown",
  fallback: PrivateTableMode
): PrivateTableMode {
  if (draft.platform === "FC2") return "fc2";
  if (draft.platform === "JAV") return "jav";
  if (inferredPlatform === "FC2") return "fc2";
  if (inferredPlatform === "JAV") return "jav";
  return fallback;
}

function restoredTouchedFields(draft?: PrivateSimpleAddDraft): PrivateAddTouchedFields {
  if (!draft) return { actress: false, platform: false, maker: false };
  const defaults = privateAddDefaultsForCode(draft.code);
  return {
    actress: Boolean(draft.actress && draft.actress !== PRIVATE_DEFAULT_ACTRESS),
    platform: Boolean(draft.platform && draft.platform !== defaults.platform),
    maker: Boolean(draft.maker && draft.maker !== defaults.maker)
  };
}

function hasAdvancedValues(draft?: PrivateSimpleAddDraft) {
  if (!draft) return false;
  const defaults = privateAddDefaultsForCode(draft.code);
  return Boolean(
    draft.title.trim()
    || draft.release_date.trim()
    || (draft.platform.trim() && draft.platform !== defaults.platform)
    || (draft.maker.trim() && draft.maker !== defaults.maker)
    || (draft.actress.trim() && draft.actress !== PRIVATE_DEFAULT_ACTRESS)
  );
}

function privateDraftStatusMessage(status: DraftStatus, savedAt: string) {
  if (status === "restored") return `已恢復 ${formatDraftSavedAt(savedAt)} 的未完成草稿`;
  if (status === "saving") return "正在保存草稿...";
  if (status === "saved") return "草稿已自動儲存";
  if (status === "error") return "無法自動保存草稿，請勿離開此頁";
  if (status === "cleared") return "草稿已清除";
  return "輸入內容會自動保存在這台裝置";
}

function formatDraftSavedAt(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "上次";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function todayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function tagKey(value: string) {
  return value.toLocaleLowerCase();
}
