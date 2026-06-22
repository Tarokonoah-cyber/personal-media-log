import { Plus, Sparkles } from "lucide-react";
import { KeyboardEvent } from "react";

export function QuickCapture({
  value,
  loading,
  smartLoading,
  onChange,
  onSubmit,
  onSmartAdd
}: {
  value: string;
  loading: boolean;
  smartLoading?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSmartAdd?: () => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="quick-add-bar" aria-label="快速新增">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="快速新增：3/29 藍鳥 運動家，或 標題 4.5 一句心得 #tag"
      />
      <button className="smart-add" disabled={loading || smartLoading || !value.trim()} onClick={onSmartAdd} title="AI 補分類與標籤">
        <Sparkles size={15} />
        智慧新增
      </button>
      <button className="primary compact-add" disabled={loading || !value.trim()} onClick={onSubmit} title="直接新增">
        <Plus size={16} />
        新增
      </button>
    </section>
  );
}
