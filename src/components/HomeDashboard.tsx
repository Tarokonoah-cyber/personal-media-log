import { ArrowRight, Bookmark, CheckCircle2, Clock3, Database, Film, PlayCircle, Sparkles, Star } from "lucide-react";
import { isThisWeek, isToday } from "../lib/date";
import { getStats, listItems } from "../lib/api";
import { buildOrganizerIssues, type OrganizerIssueKind } from "../lib/organizationInsights";
import { getWatchStatus, progressLabel, watchStatusLabel } from "../lib/watch";
import { classifyItem } from "../lib/taxonomy";
import { useEffect, useMemo, useState } from "react";
import type { ListFilters, MediaItem, StatsResponse } from "../types";

const hiddenHomeTypes = new Set(["沙雕动画"]);

const organizerFilters: ListFilters = {
  query: "",
  status: "all",
  favorite: false,
  highRated: false,
  watchStatus: "all",
  type: "",
  category: "",
  tag: "",
  year: "",
  platform: "",
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

type ToolTab = "organizer" | "stats" | "data" | "settings";

interface HomeBuckets {
  watching: MediaItem[];
  plan: MediaItem[];
  recent: MediaItem[];
  completed: MediaItem[];
}

interface MediaRailConfig {
  id: string;
  title: string;
  view: string;
  items: MediaItem[];
}

export function HomeDashboard({
  items = [],
  variant = "sidebar",
  includePrivate = false,
  onView,
  onTool,
  onSelect
}: {
  items?: MediaItem[];
  inboxTotal?: number;
  favoriteTotal?: number;
  variant?: "sidebar" | "main";
  includePrivate?: boolean;
  onView?: (view: string) => void;
  onTool?: (tab: ToolTab) => void;
  onSelect?: (item: MediaItem) => void;
}) {
  if (variant === "main") return <MainDashboard includePrivate={includePrivate} onView={onView} onTool={onTool} onSelect={onSelect} />;

  const todayCount = items.filter((item) => isToday(item.created_at)).length;
  const weekCount = items.filter((item) => isThisWeek(item.created_at)).length;

  return (
    <section className="summary-line" aria-label="Home summary">
      <span>Today <b>{todayCount}</b></span>
      <span>Week <b>{weekCount}</b></span>
    </section>
  );
}

function MainDashboard({
  includePrivate,
  onView,
  onTool,
  onSelect
}: {
  includePrivate: boolean;
  onView?: (view: string) => void;
  onTool?: (tab: ToolTab) => void;
  onSelect?: (item: MediaItem) => void;
}) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [organizerItems, setOrganizerItems] = useState<MediaItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadHome() {
      setError("");
      try {
        const [nextStats, nextOrganizerItems] = await Promise.all([
          getStats(includePrivate),
          loadOrganizerItems(includePrivate)
        ]);
        if (cancelled) return;
        setStats(nextStats);
        setOrganizerItems(nextOrganizerItems);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Home failed to load");
      }
    }
    void loadHome();
    return () => {
      cancelled = true;
    };
  }, [includePrivate]);

  const homeItems: HomeBuckets = useMemo(() => ({
    watching: filterHomeItems(stats?.watching || []),
    plan: filterHomeItems(stats?.plan || []),
    recent: filterHomeItems(stats?.recent || []),
    completed: filterHomeItems(stats?.recent || []).filter((item) => getWatchStatus(item) === "completed")
  }), [stats]);

  const organizerIssues = useMemo(() => buildOrganizerIssues(organizerItems, new Set(), includePrivate), [includePrivate, organizerItems]);
  const focusItem = useMemo(() => pickFocusItem(homeItems, stats), [homeItems, stats]);
  const rails = useMemo(() => buildMediaRails(homeItems), [homeItems]);
  const nextItems = useMemo(() => buildNextItems(homeItems, focusItem), [focusItem, homeItems]);

  if (error) return <div className="notice danger">{error}</div>;
  if (!stats) return <div className="empty">Loading home...</div>;

  if (!focusItem) {
    return (
      <section className="home-dashboard-main home-clean" aria-label="Home">
        <HomeTop stats={stats} buckets={homeItems} includePrivate={includePrivate} />
        <EmptyHome onView={onView} />
      </section>
    );
  }

  return (
    <section className="home-dashboard-main home-clean" aria-label="Home">
      <HomeTop stats={stats} buckets={homeItems} includePrivate={includePrivate} />

      <div className="home-clean-hero">
        <button className="home-clean-focus" onClick={() => onSelect?.(focusItem)}>
          <Thumb item={focusItem} size="feature" />
          <span className="home-clean-focus-copy">
            <em>{focusLabel(focusItem)}</em>
            <strong>{titleFor(focusItem)}</strong>
            <small>{focusLine(focusItem)}</small>
            {noteExcerpt(focusItem) ? <b>{noteExcerpt(focusItem)}</b> : null}
          </span>
          <ArrowRight size={18} />
        </button>

        <aside className="home-clean-side" aria-label="Shortcuts">
          <NextPanel items={nextItems} onSelect={onSelect} />
          <button className="home-clean-status" onClick={() => onTool?.("organizer")}>
            <Sparkles size={15} />
            <span>{organizerCompactText(organizerIssues)}</span>
            <ArrowRight size={14} />
          </button>
          <QuickActions onView={onView} onTool={onTool} />
        </aside>
      </div>

      <div className="home-clean-rails">
        {rails.map((rail) => (
          <MediaRail key={rail.id} rail={rail} onView={onView} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

function HomeTop({ stats, buckets, includePrivate }: { stats: StatsResponse; buckets: HomeBuckets; includePrivate: boolean }) {
  return (
    <header className="home-clean-top">
      <div>
        <p>{includePrivate ? "PRIVATE" : "LIBRARY"}</p>
        <h1>Home</h1>
      </div>
      <div className="home-clean-metrics" aria-label="Library summary">
        {summaryFacts(stats, buckets).map((fact) => <span key={fact}>{fact}</span>)}
      </div>
    </header>
  );
}

function EmptyHome({ onView }: { onView?: (view: string) => void }) {
  return (
    <div className="home-clean-empty">
      <Film size={24} />
      <strong>No titles yet</strong>
      <span>Add one item and this page will become your watching home.</span>
      <div>
        <button className="primary" onClick={() => onView?.("database")}>Open library</button>
        <button onClick={() => onView?.("plan_to_watch")}>Queue</button>
      </div>
    </div>
  );
}

function NextPanel({ items, onSelect }: { items: MediaItem[]; onSelect?: (item: MediaItem) => void }) {
  return (
    <div className="home-clean-next">
      <header>
        <span>Next</span>
      </header>
      {items.length ? (
        <div className="home-clean-next-list">
          {items.slice(0, 3).map((item) => (
            <button key={item.id} onClick={() => onSelect?.(item)}>
              <Thumb item={item} size="mini" />
              <span>
                <strong>{titleFor(item)}</strong>
                <small>{compactMeta(item)}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p>Clear</p>
      )}
    </div>
  );
}

function QuickActions({ onView, onTool }: { onView?: (view: string) => void; onTool?: (tab: ToolTab) => void }) {
  return (
    <nav className="home-clean-actions" aria-label="Quick actions">
      <button onClick={() => onView?.("database")} title="Library"><Database size={14} />Library</button>
      <button onClick={() => onView?.("favorites")} title="Favorites"><Star size={14} />Stars</button>
      <button onClick={() => onView?.("watching")} title="Watching"><PlayCircle size={14} />Now</button>
      <button onClick={() => onTool?.("organizer")} title="Organizer"><Sparkles size={14} />Clean</button>
    </nav>
  );
}

function MediaRail({ rail, onView, onSelect }: { rail: MediaRailConfig; onView?: (view: string) => void; onSelect?: (item: MediaItem) => void }) {
  return (
    <section className="home-clean-rail" aria-label={rail.title}>
      <header>
        <span>{rail.title}</span>
        <button onClick={() => onView?.(rail.view)} aria-label={`Open ${rail.title}`}>
          <ArrowRight size={15} />
        </button>
      </header>
      <div className="home-clean-tiles">
        {rail.items.slice(0, 6).map((item) => (
          <button key={item.id} className="home-clean-tile" onClick={() => onSelect?.(item)}>
            <Thumb item={item} size="tile" />
            <strong>{titleFor(item)}</strong>
            <small>{compactMeta(item)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function Thumb({ item, size = "tile" }: { item: MediaItem; size?: "mini" | "tile" | "feature" }) {
  return (
    <span className={`home-clean-thumb ${size}`} aria-hidden="true">
      {item.cover_url ? <img src={item.cover_url} alt="" /> : coverInitial(item)}
    </span>
  );
}

async function loadOrganizerItems(includePrivate: boolean) {
  const allItems: MediaItem[] = [];
  let page = 1;
  let total = 0;
  do {
    const result = await listItems({
      ...organizerFilters,
      page,
      includePrivate,
      privateOnly: includePrivate
    });
    allItems.push(...result.items);
    total = result.total;
    page += 1;
  } while (allItems.length < total);
  return allItems;
}

function pickFocusItem(buckets: HomeBuckets, stats: StatsResponse | null) {
  return buckets.watching[0] || buckets.plan[0] || buckets.completed[0] || buckets.recent[0] || stats?.top[0] || null;
}

function buildNextItems(buckets: HomeBuckets, focusItem: MediaItem | null) {
  const seen = new Set(focusItem ? [focusItem.id] : []);
  const items: MediaItem[] = [];
  for (const item of [...buckets.watching, ...buckets.plan, ...buckets.recent]) {
    if (seen.has(item.id)) continue;
    items.push(item);
    seen.add(item.id);
    if (items.length >= 3) break;
  }
  return items;
}

function buildMediaRails(buckets: HomeBuckets): MediaRailConfig[] {
  return [
    { id: "watching", title: "Watching", view: "watching", items: buckets.watching },
    { id: "queue", title: "Queue", view: "plan_to_watch", items: buckets.plan },
    { id: "done", title: "Done", view: "completed", items: buckets.completed },
    { id: "recent", title: "Recent", view: "database", items: buckets.recent }
  ].filter((rail) => rail.items.length > 0);
}

function summaryFacts(stats: StatsResponse, buckets: HomeBuckets) {
  if (stats.total === 0) return ["Empty"];
  const facts = [`${stats.total} titles`];
  if (buckets.watching.length) facts.push(`${buckets.watching.length} watching`);
  if (buckets.plan.length) facts.push(`${buckets.plan.length} queued`);
  if (stats.averageRating) facts.push(`Avg ${stats.averageRating}`);
  if (stats.currentYear) facts.push(`This year ${stats.currentYear}`);
  return facts;
}

function organizerCompactText(issues: ReturnType<typeof buildOrganizerIssues>) {
  if (!issues.length) return "Clean";
  const counts = issueCounts(issues);
  if (counts.duplicate) return `Duplicates ${counts.duplicate}`;
  if (counts.missing) return `Missing info ${counts.missing}`;
  if (counts.progress) return `Progress ${counts.progress}`;
  if (counts.naming) return `Naming ${counts.naming}`;
  if (counts.rating) return `Ratings ${counts.rating}`;
  return `Clean up ${issues.length}`;
}

function issueCounts(issues: ReturnType<typeof buildOrganizerIssues>) {
  const counts: Record<OrganizerIssueKind, number> = { missing: 0, progress: 0, duplicate: 0, naming: 0, rating: 0 };
  for (const issue of issues) counts[issue.kind] += 1;
  return counts;
}

function filterHomeItems(items: MediaItem[]) {
  return items.filter((item) => !hiddenHomeTypes.has(classifyItem(item).type));
}

function focusLabel(item: MediaItem) {
  const status = getWatchStatus(item);
  if (status === "watching" || status === "rewatching") return "NOW";
  if (status === "plan_to_watch") return "QUEUE";
  if (status === "completed") return "DONE";
  return "RECENT";
}

function focusLine(item: MediaItem) {
  return compactMeta(item) || displayDate(item) || watchStatusLabel(getWatchStatus(item));
}

function compactMeta(item: MediaItem) {
  const parts = [
    progressLabel(item) || watchStatusLabel(getWatchStatus(item)),
    item.platform || "",
    item.release_year ? String(item.release_year) : "",
    typeof item.rating === "number" ? `★ ${item.rating}` : ""
  ].filter(Boolean);
  return parts.join(" · ");
}

function noteExcerpt(item: MediaItem) {
  const note = (item.quick_note || item.long_note || "").replace(/\s+/g, " ").trim();
  if (!note) return "";
  return note.length > 64 ? `${note.slice(0, 64)}...` : note;
}

function displayDate(item: MediaItem) {
  const date = item.watched_at || item.completed_at || item.planned_at || item.updated_at || item.created_at;
  return date ? date.slice(0, 10) : "";
}

function titleFor(item: MediaItem) {
  return item.official_title || item.raw_title;
}

function coverInitial(item: MediaItem) {
  return titleFor(item).trim().slice(0, 1).toUpperCase();
}
