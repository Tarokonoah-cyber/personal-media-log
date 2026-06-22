import { CheckCircle2, X } from "lucide-react";

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <CheckCircle2 size={18} />
      <span>{message}</span>
      <button className="ghost-icon" onClick={onClose} aria-label="關閉提示">
        <X size={16} />
      </button>
    </div>
  );
}
