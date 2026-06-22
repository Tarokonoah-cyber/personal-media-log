import { BarChart3, DatabaseBackup, Table2 } from "lucide-react";

type Tab = "log" | "organize" | "stats" | "data";

const tabs = [
  { id: "log", label: "Database", icon: Table2 },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "data", label: "Data", icon: DatabaseBackup }
] as const;

export function BottomTabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="bottom-tabs" aria-label="Mobile navigation">
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
