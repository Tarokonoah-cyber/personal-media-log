import { AlertTriangle, CheckCircle2, Eye, RefreshCcw, Search, Sparkles, Wand2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listItems, updateItem } from "../lib/api";
import { toItemInput } from "../lib/itemTransforms";
import { buildOrganizerIssues, type OrganizerIssue, type OrganizerIssueKind, type OrganizerSuggestion } from "../lib/organizationInsights";
import type { ListFilters, MediaItem } from "../types";

const ignoredStorageKey = "smartOrganizerIgnoredIssues";

const baseFilters: ListFilters = {
  query: "",
  status: "all",
  favorite: false,
  highRated: false,
  ratingMin: "",
  ratingMax: "",
  usedFilter: "all",
  collectionLevel: "",
  favoriteLevel: "all",
  mediaStatus: "all",
  watchStatus: "all",
  type: "",
  category: "",
  tag: "",
  year: "",
  platform: "",
  maker: "",
  series: "",
  codeQuery: "",
  titleQuery: "",
  person: "",
  studio: "",
  watchedFrom: "",
  watchedTo: "",
  updatedFrom: "",
  updatedTo: "",
  page: 1,
  pageSize: 100
};

const kindLabels: Record<OrganizerIssueKind, string> = {
  missing: "缺資料",
  progress: "追看問題",
  duplicate: "疑似重複",
  naming: "命名整理",
  rating: "評分異常"
};

export function SmartOrganizer({
  privateMode,
  onSelect,
  onMetadata,
  onChanged
}: {
  privateMode: boolean;
  onSelect: (item: MediaItem) => void;
  onMetadata: (item: MediaItem) => void;
  onChanged: () => Promise<void>;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [ignored, setIgnored] = useState<Set<string>>(() => loadIgnored());
  const [activeKind, setActiveKind] = useState<OrganizerIssueKind | "all">("all");
  const [loading, setLoading] = useState(false);
  const [savingIssueId, setSavingIssueId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadOrganizerItems();
  }, [privateMode]);

  const issues = useMemo(() => buildOrganizerIssues(items, ignored, privateMode), [ignored, items, privateMode]);
  const filteredIssues = useMemo(() => activeKind === "all" ? issues : issues.filter((issue) => issue.kind === activeKind), [activeKind, issues]);
  const counts = useMemo(() => {
    const next: Record<OrganizerIssueKind | "all", number> = { all: issues.length, missing: 0, progress: 0, duplicate: 0, naming: 0, rating: 0 };
    for (const issue of issues) next[issue.kind] += 1;
    return next;
  }, [issues]);

  async function loadOrganizerItems() {
    setLoading(true);
    setError("");
    try {
      const allItems: MediaItem[] = [];
      let page = 1;
      let total = 0;
      do {
        const result = await listItems({
          ...baseFilters,
          page,
          includePrivate: privateMode,
          privateOnly: privateMode
        });
        allItems.push(...result.items);
        total = result.total;
        page += 1;
      } while (allItems.length < total && page <= 5);
      setItems(allItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "整理資料載入失敗");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function ignoreIssue(issue: OrganizerIssue) {
    const next = new Set(ignored);
    next.add(issue.id);
    setIgnored(next);
    saveIgnored(next);
  }

  function resetIgnored() {
    setIgnored(new Set());
    localStorage.removeItem(ignoredStorageKey);
  }

  async function applySuggestion(issue: OrganizerIssue, suggestion: OrganizerSuggestion) {
    setSavingIssueId(issue.id);
    setError("");
    try {
      await Promise.all(issue.items.map((item) => {
        const input = toItemInput(item);
        const patch = suggestionPatchForItem(item, suggestion);
        return updateItem(item.id, { ...input, ...patch });
      }));
      ignoreIssue(issue);
      await Promise.all([loadOrganizerItems(), onChanged()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "套用整理建議失敗");
    } finally {
      setSavingIssueId("");
    }
  }

  return (
    <section className="organizer-panel">
      <header className="organizer-hero">
        <div>
          <p className="eyebrow">Smart Organizer</p>
          <h1>智慧整理中心</h1>
          <span>{privateMode ? "正在整理私密庫" : "正在整理公開資料庫"} · {items.length} 筆已掃描</span>
        </div>
        <div className="organizer-actions">
          <button onClick={() => void loadOrganizerItems()} disabled={loading}><RefreshCcw size={15} />重新掃描</button>
          <button onClick={resetIgnored} disabled={ignored.size === 0}><X size={15} />重設忽略</button>
        </div>
      </header>

      {error && <div className="notice danger">{error}</div>}

      <div className="organizer-summary-grid">
        <SummaryTile label="全部問題" value={counts.all} active={activeKind === "all"} onClick={() => setActiveKind("all")} />
        {(Object.keys(kindLabels) as OrganizerIssueKind[]).map((kind) => (
          <SummaryTile key={kind} label={kindLabels[kind]} value={counts[kind]} active={activeKind === kind} onClick={() => setActiveKind(kind)} />
        ))}
      </div>

      {loading ? (
        <div className="empty">整理掃描中...</div>
      ) : filteredIssues.length === 0 ? (
        <div className="organizer-empty">
          <CheckCircle2 size={26} />
          <strong>這一區看起來很乾淨</strong>
          <span>{activeKind === "all" ? "目前沒有可整理項目。" : `${kindLabels[activeKind]} 沒有待處理項目。`}</span>
        </div>
      ) : (
        <div className="organizer-issue-list">
          {filteredIssues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              saving={savingIssueId === issue.id}
              onSelect={onSelect}
              onMetadata={onMetadata}
              onApply={applySuggestion}
              onIgnore={ignoreIssue}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryTile({ label, value, active, onClick }: { label: string; value: number; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? "organizer-summary active" : "organizer-summary"} onClick={onClick}>
      <span>{label}</span>
      <b>{value}</b>
    </button>
  );
}

function IssueCard({
  issue,
  saving,
  onSelect,
  onMetadata,
  onApply,
  onIgnore
}: {
  issue: OrganizerIssue;
  saving: boolean;
  onSelect: (item: MediaItem) => void;
  onMetadata: (item: MediaItem) => void;
  onApply: (issue: OrganizerIssue, suggestion: OrganizerSuggestion) => Promise<void>;
  onIgnore: (issue: OrganizerIssue) => void;
}) {
  return (
    <article className={`organizer-issue severity-${issue.severity}`}>
      <div className="organizer-issue-main">
        <span className="organizer-issue-icon"><AlertTriangle size={16} /></span>
        <div>
          <div className="organizer-issue-title">
            <strong>{issue.title}</strong>
            <span>{kindLabels[issue.kind]}</span>
          </div>
          <p>{issue.detail}</p>
          <div className="organizer-item-strip">
            {issue.items.slice(0, 4).map((item) => (
              <button key={item.id} onClick={() => onSelect(item)} title={item.official_title || item.raw_title}>
                {item.cover_url ? <img src={item.cover_url} alt="" /> : <span>{coverInitial(item)}</span>}
                <em>{item.official_title || item.raw_title}</em>
              </button>
            ))}
            {issue.items.length > 4 && <span className="organizer-more">+{issue.items.length - 4}</span>}
          </div>
        </div>
      </div>
      <footer className="organizer-issue-actions">
        <button onClick={() => onSelect(issue.items[0])}><Eye size={15} />查看</button>
        {issue.metadataAction && <button onClick={() => onMetadata(issue.items[0])}><Search size={15} />補 TMDb</button>}
        {issue.suggestions?.map((suggestion) => (
          <button className="primary" key={suggestion.label} onClick={() => void onApply(issue, suggestion)} disabled={saving}>
            <Wand2 size={15} />
            {saving ? "套用中..." : suggestion.label}
          </button>
        ))}
        <button onClick={() => onIgnore(issue)}><Sparkles size={15} />忽略</button>
      </footer>
    </article>
  );
}

function suggestionPatchForItem(item: MediaItem, suggestion: OrganizerSuggestion) {
  if (suggestion.canonicalTag && suggestion.tagKey) {
    return {
      tags: Array.from(new Set(item.tags.map((tag) => tag.trim().toLowerCase() === suggestion.tagKey ? suggestion.canonicalTag || tag : tag)))
    };
  }
  return suggestion.patch || {};
}

function loadIgnored() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ignoredStorageKey) || "[]") as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function saveIgnored(value: Set<string>) {
  localStorage.setItem(ignoredStorageKey, JSON.stringify(Array.from(value)));
}

function coverInitial(item: MediaItem) {
  return (item.official_title || item.raw_title || "?").trim().slice(0, 1).toUpperCase();
}
