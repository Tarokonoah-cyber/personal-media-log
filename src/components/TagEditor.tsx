import { X } from "lucide-react";
import { KeyboardEvent, ClipboardEvent, useId, useMemo, useState } from "react";
import { addTags, normalizeTags, parseTagInput } from "../lib/tags";
import { canonicalizeTagInput, rankTagSuggestions, readRecentTags, rememberRecentTags } from "../lib/tagWorkflow";

export function TagEditor({
  label = "標籤",
  tags,
  knownTags = [],
  onChange,
  placeholder = "輸入後按 Enter",
  maxSuggestions = 16,
  className = "",
  autoFocus = false
}: {
  label?: string;
  tags: string[];
  knownTags?: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxSuggestions?: number;
  className?: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [recentTags, setRecentTags] = useState(() => readRecentTags());
  const suggestionListId = useId();
  const normalizedTags = useMemo(() => normalizeTags(tags), [tags]);
  const suggestions = useMemo(() => {
    const existing = new Set(normalizedTags.map((tag) => tag.toLocaleLowerCase()));
    return rankTagSuggestions(knownTags, draft, recentTags)
      .filter((tag) => !existing.has(tag.toLocaleLowerCase()))
      .slice(0, maxSuggestions);
  }, [draft, knownTags, maxSuggestions, normalizedTags, recentTags]);

  function commit(value = draft) {
    const incoming = canonicalizeTagInput(value, knownTags);
    if (incoming.length === 0) return;
    const next = addTags(normalizedTags, incoming.join(","));
    onChange(next);
    setRecentTags(rememberRecentTags(incoming));
    setDraft("");
    setActiveSuggestion(-1);
  }

  function remove(tag: string) {
    onChange(normalizedTags.filter((entry) => entry !== tag));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestion((index) => Math.min(index + 1, suggestions.length - 1));
      return;
    }
    if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestion((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter" || event.key === "Tab" || event.key === "," || event.key === "，" || event.key === "、") {
      if (!draft.trim()) return;
      event.preventDefault();
      commit(activeSuggestion >= 0 ? suggestions[activeSuggestion] : draft);
      return;
    }
    if (event.key === "Backspace" && !draft && normalizedTags.length > 0) {
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
    <label className={`tag-editor ${className}`.trim()}>
      <span>{label}</span>
      <div className="tag-editor-box">
        {normalizedTags.map((tag) => (
          <button key={tag} type="button" className="tag-chip" onClick={() => remove(tag)} title={`移除 ${tag}`}>
            <span>#{tag}</span>
            <X size={12} />
          </button>
        ))}
        <input
          autoFocus={autoFocus}
          value={draft}
          onChange={(event) => { setDraft(event.target.value); setActiveSuggestion(-1); }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => { if (draft.trim()) commit(); }}
          placeholder={normalizedTags.length ? "" : placeholder}
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={suggestionListId}
          aria-activedescendant={activeSuggestion >= 0 ? `${suggestionListId}-${activeSuggestion}` : undefined}
        />
      </div>
      {suggestions.length > 0 && (
        <span id={suggestionListId} className="tag-suggestions" aria-label="最近與常用標籤" role="listbox">
          {suggestions.map((tag, index) => (
            <button key={tag} id={`${suggestionListId}-${index}`} role="option" aria-selected={index === activeSuggestion} className={index === activeSuggestion ? "active" : ""} type="button" onClick={() => commit(tag)}>#{tag}</button>
          ))}
        </span>
      )}
    </label>
  );
}
