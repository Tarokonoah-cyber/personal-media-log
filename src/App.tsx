import { BarChart3, DatabaseBackup, Download, ListFilter, Moon, Plus, Search, Sun, Table2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createItem, deleteItem, listItems, updateItem } from "./lib/api";
import { parseQuickEntry } from "./lib/quickParse";
import type { ItemInput, ListFilters, MediaItem } from "./types";
import { ImportExport } from "./components/ImportExport";
import { ItemEditor } from "./components/ItemEditor";
import { ItemList } from "./components/ItemList";
import { StatsPanel } from "./components/StatsPanel";

const defaultFilters: ListFilters = {
  query: "",
  status: "inbox",
  favorite: false,
  highRated: false,
  type: "",
  tag: "",
  year: "",
  platform: "",
  watchedFrom: "",
  watchedTo: "",
  page: 1,
  pageSize: 25
};

type Tab = "log" | "organize" | "stats" | "data";

export default function App() {
  const [tab, setTab] = useState<Tab>("log");
  const [quickText, setQuickText] = useState("");
  const [filters, setFilters] = useState<ListFilters>(defaultFilters);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [dark, setDark] = useState(() => localStorage.getItem("theme") !== "light");

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    void loadItems();
  }, [filters]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / filters.pageSize)), [total, filters.pageSize]);

  async function loadItems() {
    setLoading(true);
    setMessage("");
    try {
      const result = await listItems(filters);
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
  }

  async function submitQuick() {
    const parsed = parseQuickEntry(quickText);
    if (!parsed.raw_title.trim()) return;
    setLoading(true);
    try {
      const created = await createItem(parsed);
      setQuickText("");
      setMessage(`已新增：${created.raw_title}`);
      setFilters((current) => ({ ...current, status: "inbox", page: 1 }));
      await loadItems();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "新增失敗");
    } finally {
      setLoading(false);
    }
  }

  async function saveItem(input: ItemInput) {
    if (!selected) return;
    const saved = await updateItem(selected.id, input);
    setSelected(saved);
    await loadItems();
  }

  async function removeItem(id: string) {
    await deleteItem(id);
    setSelected(null);
    await loadItems();
  }

  function patchFilters(patch: Partial<ListFilters>) {
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Personal Media Log</p>
          <h1>私人觀看紀錄</h1>
        </div>
        <button className="icon-button" onClick={() => setDark((value) => !value)} title={dark ? "淺色模式" : "深色模式"}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <nav className="tabs" aria-label="主要導覽">
        <button className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}><Plus size={16} />紀錄</button>
        <button className={tab === "organize" ? "active" : ""} onClick={() => setTab("organize")}><Table2 size={16} />整理</button>
        <button className={tab === "stats" ? "active" : ""} onClick={() => setTab("stats")}><BarChart3 size={16} />統計</button>
        <button className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}><DatabaseBackup size={16} />資料</button>
      </nav>

      {message && <div className="notice">{message}</div>}

      {(tab === "log" || tab === "organize") && (
        <>
          <section className="quick-panel">
            <label htmlFor="quickInput">快速新增</label>
            <div className="quick-row">
              <textarea
                id="quickInput"
                value={quickText}
                onChange={(event) => setQuickText(event.target.value)}
                placeholder="黑暗榮耀 EP3 4.5 後半段開始精彩 #韓劇 #復仇 #收藏"
                rows={3}
              />
              <button className="primary" disabled={loading || !quickText.trim()} onClick={submitQuick}>
                <Plus size={18} />新增
              </button>
            </div>
          </section>

          <section className="filter-panel">
            <div className="search-field">
              <Search size={17} />
              <input value={filters.query} onChange={(event) => patchFilters({ query: event.target.value })} placeholder="搜尋標題、代碼、筆記、標籤、人物、平台" />
            </div>
            <div className="filter-grid">
              <select value={filters.status} onChange={(event) => patchFilters({ status: event.target.value as ListFilters["status"] })}>
                <option value="all">全部</option>
                <option value="inbox">Inbox</option>
                <option value="raw">待整理</option>
                <option value="partial">部分整理</option>
                <option value="organized">已整理</option>
                <option value="archived">封存</option>
              </select>
              <input value={filters.type} onChange={(event) => patchFilters({ type: event.target.value })} placeholder="類型" />
              <input value={filters.tag} onChange={(event) => patchFilters({ tag: event.target.value })} placeholder="標籤" />
              <input value={filters.platform} onChange={(event) => patchFilters({ platform: event.target.value })} placeholder="平台" />
              <input value={filters.year} onChange={(event) => patchFilters({ year: event.target.value })} placeholder="年份" inputMode="numeric" />
              <input value={filters.watchedFrom} onChange={(event) => patchFilters({ watchedFrom: event.target.value })} type="date" />
              <input value={filters.watchedTo} onChange={(event) => patchFilters({ watchedTo: event.target.value })} type="date" />
              <label className="check"><input type="checkbox" checked={filters.favorite} onChange={(event) => patchFilters({ favorite: event.target.checked })} />收藏</label>
              <label className="check"><input type="checkbox" checked={filters.highRated} onChange={(event) => patchFilters({ highRated: event.target.checked })} />高分</label>
            </div>
          </section>

          <div className="list-meta">
            <span><ListFilter size={16} />{total} 筆</span>
            <div>
              <button disabled={filters.page <= 1} onClick={() => patchFilters({ page: filters.page - 1 })}>上一頁</button>
              <span>{filters.page} / {pageCount}</span>
              <button disabled={filters.page >= pageCount} onClick={() => patchFilters({ page: filters.page + 1 })}>下一頁</button>
            </div>
          </div>

          <ItemList items={items} loading={loading} mode={tab} onSelect={setSelected} />
        </>
      )}

      {tab === "stats" && <StatsPanel />}
      {tab === "data" && <ImportExport onImported={loadItems} />}

      {selected && <ItemEditor item={selected} onClose={() => setSelected(null)} onSave={saveItem} onDelete={removeItem} />}
    </div>
  );
}
