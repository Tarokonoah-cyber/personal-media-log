import { Command, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type CommandPaletteAction = {
  id: string;
  label: string;
  description?: string;
  group: "搜尋與檢視" | "批次整理" | "操作" | "設定";
  keywords?: string[];
  shortcut?: string;
  disabled?: boolean;
  run: () => void | Promise<void>;
};

export function CommandPalette({
  open,
  actions,
  onOpenChange,
  onSearch
}: {
  open: boolean;
  actions: CommandPaletteAction[];
  onOpenChange: (open: boolean) => void;
  onSearch: (query: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = normalize(query);
  const matches = useMemo(() => actions.filter((action) => {
    if (!normalizedQuery) return true;
    return normalize([action.label, action.description, ...(action.keywords || [])].filter(Boolean).join(" ")).includes(normalizedQuery);
  }).slice(0, 18), [actions, normalizedQuery]);
  const searchAction: CommandPaletteAction | null = query.trim() ? {
    id: "search-current-query",
    label: `搜尋「${query.trim()}」`,
    description: "直接套用到資料表搜尋",
    group: "搜尋與檢視" as const,
    run: () => onSearch(query.trim())
  } : null;
  const visibleActions = matches.length > 0 ? matches : searchAction ? [searchAction] : [];

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (activeIndex < visibleActions.length) return;
    setActiveIndex(Math.max(0, visibleActions.length - 1));
  }, [activeIndex, visibleActions.length]);

  if (!open) return null;

  async function run(action: CommandPaletteAction) {
    if (action.disabled) return;
    onOpenChange(false);
    await action.run();
  }

  return (
    <div className="command-palette-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onOpenChange(false); }}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="指令選單">
        <div className="command-palette-search">
          <Search size={17} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
            onKeyDown={(event) => {
              if (event.key === "Escape") { event.preventDefault(); onOpenChange(false); return; }
              if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, visibleActions.length - 1)); return; }
              if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); return; }
              if (event.key === "Enter" && visibleActions[activeIndex]) { event.preventDefault(); void run(visibleActions[activeIndex]); }
            }}
            placeholder="搜尋、切換 Smart View 或執行批次操作"
            aria-label="搜尋指令"
            aria-controls="command-palette-results"
            aria-activedescendant={visibleActions[activeIndex] ? `command-${visibleActions[activeIndex].id}` : undefined}
          />
          <kbd>Esc</kbd>
        </div>
        <div id="command-palette-results" className="command-palette-results" role="listbox">
          {visibleActions.length === 0 ? <p>找不到指令；按 Enter 可直接搜尋資料。</p> : visibleActions.map((action, index) => (
            <button
              key={action.id}
              id={`command-${action.id}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "is-active" : ""}
              disabled={action.disabled}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => void run(action)}
            >
              <Command size={15} aria-hidden="true" />
              <span><strong>{action.label}</strong>{action.description && <small>{action.description}</small>}</span>
              <em>{action.group}</em>
              {action.shortcut && <kbd>{action.shortcut}</kbd>}
            </button>
          ))}
        </div>
        <footer><span>↑↓ 選擇</span><span>Enter 執行</span><span>Ctrl/Cmd + K 開關</span></footer>
      </section>
    </div>
  );
}

function normalize(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}
