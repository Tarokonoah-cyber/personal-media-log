import { BarChart3, DatabaseBackup, PencilLine, Table2 } from "lucide-react";

type Tab = "log" | "organize" | "stats" | "data";

const tabs = [
  { id: "log", label: "記錄", icon: PencilLine },
  { id: "organize", label: "整理", icon: Table2 },
  { id: "stats", label: "統計", icon: BarChart3 },
  { id: "data", label: "資料", icon: DatabaseBackup }
] as const;

export function BottomTabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="bottom-tabs" aria-label="手機導覽">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button key={tab.id} className={active === tab.id ? "active" : ""} onClick={() => onChange(tab.id)}>
            <Icon size={19} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
