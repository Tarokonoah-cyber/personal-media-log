import { X } from "lucide-react";
import { KeyboardEvent, ClipboardEvent, useMemo, useState } from "react";
import { addTags, normalizeTags, parseTagInput } from "../lib/tags";

export function TagEditor({
  label = "標籤",
  tags,
  knownTags = [],
  onChange,
  placeholder = "輸入後按 Enter",
  maxSuggestions = 16,
  className = ""
}: {
  label?: string;
  tags: string[];
  knownTags?: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxSuggestions?: number;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const normalizedTags = useMemo(() => normalizeTags(tags), [tags]);
  const suggestions = useMemo(() => {
    const query = draft.trim().toLocaleLowerCase();
    const existing = new Set(normalizedTags.map((tag) => tag.toLocaleLowerCase()));
    return normalizeTags(knownTags)
      .filter((tag) => !existing.has(tag.toLocaleLowerCase()))
      .filter((tag) => !query || tag.toLocaleLowerCase().includes(query))
      .slice(0, maxSuggestions);
  }, [draft, knownTags, maxSuggestions, normalizedTags]);

  function commit(value = draft) {
    const next = addTags(normalizedTags, value);
    onChange(next);
    setDraft("");
  }

  function remove(tag: string) {
    onChange(normalizedTags.filter((entry) => entry !== tag));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "Tab" || event.key === "," || event.key === "，" || event.key === "、") {
      if (!draft.trim()) return;
      event.preventDefault();
      commit();
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
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => { if (draft.trim()) commit(); }}
          placeholder={normalizedTags.length ? "" : placeholder}
        />
      </div>
      {suggestions.length > 0 && (
        <span className="tag-suggestions" aria-label="標籤建議">
          {suggestions.map((tag) => (
            <button key={tag} type="button" onClick={() => onChange(addTags(normalizedTags, tag))}>#{tag}</button>
          ))}
        </span>
      )}
    </label>
  );
}
