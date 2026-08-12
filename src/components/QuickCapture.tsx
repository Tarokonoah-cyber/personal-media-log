import { ClipboardList, Plus, Sparkles } from "lucide-react";
import { KeyboardEvent } from "react";

export function QuickCapture({
  value,
  loading,
  smartLoading,
  onChange,
  onSubmit,
  onSimpleAdd,
  onSmartAdd
}: {
  value: string;
  loading: boolean;
  smartLoading?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSimpleAdd?: () => void;
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
        placeholder="快速新增：3/29 藍鳥 運動家，或 標題 8/10 一句心得 #tag"
      />
      <button
        className="smart-add"
        disabled={loading || smartLoading || !value.trim()}
        onClick={onSmartAdd}
        title="先解析文字，帶出類型、標籤、狀態，再確認新增"
        aria-label="AI 解析文字後確認新增"
      >
        <Sparkles size={15} />
        AI 解析
      </button>
      <button className="simple-add" disabled={loading} onClick={onSimpleAdd} title="只填核心欄位">
        <ClipboardList size={15} />
        簡單
      </button>
      <button className="primary compact-add" disabled={loading || !value.trim()} onClick={onSubmit} title="直接新增">
        <Plus size={16} />
        新增
      </button>
    </section>
  );
}
