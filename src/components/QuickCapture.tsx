import { Plus } from "lucide-react";
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
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="quick-add-bar" aria-label="快速新增">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="快速新增：標題 4.5 一句心得 #標籤"
      />
      <button className="primary compact-add" disabled={loading || !value.trim()} onClick={onSubmit} title="新增到 Inbox">
        <Plus size={16} />
        新增
      </button>
    </section>
  );
}
