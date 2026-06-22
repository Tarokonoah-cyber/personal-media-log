import { CornerDownLeft, Plus } from "lucide-react";
import { KeyboardEvent } from "react";

export function QuickCapture({
  value,
  loading,
  onChange,
  onSubmit
}: {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="quick-note-card">
      <div className="quick-note-head">
        <div>
          <p className="eyebrow">Quick note</p>
          <h2>先記下來就好</h2>
        </div>
        <span className="shortcut"><CornerDownLeft size={14} /> Enter</span>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="快速記一筆：黑暗榮耀 EP3 4.5 後半段精彩 #韓劇 #收藏"
        rows={4}
      />
      <div className="quick-note-foot">
        <span>Shift + Enter 換行，Enter 或 Ctrl + Enter 新增</span>
        <button className="primary capture-button" disabled={loading || !value.trim()} onClick={onSubmit}>
          <Plus size={18} />
          新增到 Inbox
        </button>
      </div>
    </section>
  );
}
