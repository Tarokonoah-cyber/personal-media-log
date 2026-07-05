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
type DeskTone = "watching" | "pocket" | "done" | "recent";

interface HomeBuckets {
  watching: MediaItem[];
  plan: MediaItem[];
  recent: MediaItem[];
  completed: MediaItem[];
}

interface DeskCard {
  item: MediaItem;
  tone: DeskTone;
  label: string;
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
    <section className="summary-line" aria-label="觀看摘要">
      <span>今天 <b>{todayCount}</b></span>
      <span>本週 <b>{weekCount}</b></span>
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
        if (!cancelled) setError(err instanceof Error ? err.message : "首頁資料載入失敗");
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
  const deskCards = useMemo(() => buildDeskCards(homeItems, focusItem), [homeItems, focusItem]);

  if (error) return <div className="notice danger">{error}</div>;
  if (!stats) return <div className="empty">首頁載入中...</div>;

  return (
    <section className="home-dashboard-main home-desk" aria-label="私人觀影書桌">
      <div className={focusItem ? "home-desk-surface has-focus" : "home-desk-surface is-empty"}>
        <header className="home-desk-intro">
          <p className="eyebrow">{includePrivate ? "Private desk" : "Viewing desk"}</p>
          <h1>{focusItem ? "今晚桌上先放這部" : "你的觀影桌還是空的"}</h1>
          <p>{focusItem ? deskLead(focusItem) : "不用先整理成漂亮資料庫。先留下一部最近看的、想看的，這張桌子就會開始有你的痕跡。"}</p>
          <DeskMeta stats={stats} buckets={homeItems} />
        </header>

        {focusItem ? (
          <button className="home-desk-feature" onClick={() => onSelect?.(focusItem)}>
            <Thumb item={focusItem} size="feature" />
            <span>
              <em>{itemHumanLine(focusItem)}</em>
              <strong>{titleFor(focusItem)}</strong>
              <small>{noteExcerpt(focusItem) || focusHint(focusItem)}</small>
            </span>
            <ArrowRight size={17} />
          </button>
        ) : (
          <EmptyDesk onView={onView} />
        )}

        {deskCards.length > 0 ? (
          <DeskBoard cards={deskCards} onSelect={onSelect} />
        ) : focusItem ? null : (
          <StarterScraps onView={onView} />
        )}

        <aside className="home-desk-corner">
          <OrganizerScrap issues={organizerIssues} onOpen={() => onTool?.("organizer")} />
          <QuickRoutes onView={onView} onTool={onTool} />
        </aside>
      </div>
    </section>
  );
}

function DeskMeta({ stats, buckets }: { stats: StatsResponse; buckets: HomeBuckets }) {
  const facts = deskFacts(stats, buckets);
  return (
    <div className="home-desk-meta" aria-label="觀看摘要">
      {facts.map((fact) => <span key={fact}>{fact}</span>)}
    </div>
  );
}

function EmptyDesk({ onView }: { onView?: (view: string) => void }) {
  return (
    <div className="home-empty-desk">
      <Film size={22} />
      <p>先不用分類，也不用想完美格式。新增一筆，之後再慢慢補封面、心得和評分。</p>
      <button onClick={() => onView?.("database")}>開啟資料庫<ArrowRight size={14} /></button>
    </div>
  );
}

function StarterScraps({ onView }: { onView?: (view: string) => void }) {
  return (
    <div className="home-starter-scraps" aria-label="開始使用提示">
      <button onClick={() => onView?.("plan_to_watch")}>
        <Bookmark size={15} />
        <span>先放一部想看的</span>
      </button>
      <button onClick={() => onView?.("completed")}>
        <CheckCircle2 size={15} />
        <span>補一部剛看完的</span>
      </button>
    </div>
  );
}

function DeskBoard({ cards, onSelect }: { cards: DeskCard[]; onSelect?: (item: MediaItem) => void }) {
  return (
    <div className="home-desk-board" aria-label="桌面片單">
      {cards.slice(0, 7).map((card, index) => (
        <button
          className={`home-scrap-card tone-${card.tone} ${index === 0 || index === 4 ? "wide" : ""}`}
          key={`${card.tone}-${card.item.id}`}
          onClick={() => onSelect?.(card.item)}
        >
          <Thumb item={card.item} />
          <span>
            <em>{card.label}</em>
            <strong>{titleFor(card.item)}</strong>
            <small>{noteExcerpt(card.item) || itemHumanLine(card.item)}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function OrganizerScrap({ issues, onOpen }: { issues: ReturnType<typeof buildOrganizerIssues>; onOpen: () => void }) {
  const nudge = organizerNudgeText(issues);
  return (
    <button className="home-organizer-scrap" onClick={onOpen}>
      <Sparkles size={15} />
      <span>
        <strong>{nudge.title}</strong>
        <em>{nudge.detail}</em>
      </span>
    </button>
  );
}

function QuickRoutes({ onView, onTool }: { onView?: (view: string) => void; onTool?: (tab: ToolTab) => void }) {
  return (
    <nav className="home-desk-routes" aria-label="快速入口">
      <button onClick={() => onView?.("database")}><Database size={14} />資料庫</button>
      <button onClick={() => onView?.("favorites")}><Star size={14} />收藏</button>
      <button onClick={() => onView?.("watching")}><PlayCircle size={14} />正在追</button>
      <button onClick={() => onTool?.("organizer")}><Sparkles size={14} />整理</button>
    </nav>
  );
}

function Thumb({ item, size = "normal" }: { item: MediaItem; size?: "normal" | "feature" }) {
  return (
    <span className={size === "feature" ? "home-desk-thumb feature" : "home-desk-thumb"} aria-hidden="true">
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

function buildDeskCards(buckets: HomeBuckets, focusItem: MediaItem | null) {
  const cards: DeskCard[] = [];
  const seen = new Set(focusItem ? [focusItem.id] : []);
  const add = (items: MediaItem[], tone: DeskTone, label: string, limit = 3) => {
    for (const item of items) {
      if (seen.has(item.id)) continue;
      cards.push({ item, tone, label });
      seen.add(item.id);
      if (cards.filter((card) => card.tone === tone).length >= limit) break;
    }
  };
  add(buckets.watching, "watching", "接著看", 3);
  add(buckets.plan, "pocket", "口袋裡", 3);
  add(buckets.completed, "done", "剛看完", 2);
  add(buckets.recent, "recent", "剛動過", 3);
  return cards;
}

function deskFacts(stats: StatsResponse, buckets: HomeBuckets) {
  if (stats.total === 0) return ["還沒有紀錄", "先從一筆開始"];
  const facts = [`${stats.total} 筆`];
  if (buckets.watching.length) facts.push(`${buckets.watching.length} 部正在追`);
  if (buckets.plan.length) facts.push(`${buckets.plan.length} 部放口袋`);
  if (stats.averageRating) facts.push(`平均 ${stats.averageRating}`);
  if (stats.currentYear) facts.push(`今年 ${stats.currentYear}`);
  return facts;
}

function organizerNudgeText(issues: ReturnType<typeof buildOrganizerIssues>) {
  const counts = issueCounts(issues);
  if (counts.duplicate) return { title: `${counts.duplicate} 組可能重複`, detail: "有空再合併，搜尋會清爽很多。" };
  if (counts.missing) return { title: `${counts.missing} 筆可以補資料`, detail: "封面、年份、平台，慢慢補就好。" };
  if (counts.progress) return { title: `${counts.progress} 部進度待確認`, detail: "下次接回來會比較順。" };
  if (counts.naming) return { title: `${counts.naming} 筆命名可統一`, detail: "整理標籤和平台的小尾巴。" };
  if (counts.rating) return { title: `${counts.rating} 筆評分要看一下`, detail: "修掉異常分數，平均才準。" };
  return { title: "今天不用整理也可以", detail: "桌面很安靜，可以直接看點東西。" };
}

function issueCounts(issues: ReturnType<typeof buildOrganizerIssues>) {
  const counts: Record<OrganizerIssueKind, number> = { missing: 0, progress: 0, duplicate: 0, naming: 0, rating: 0 };
  for (const issue of issues) counts[issue.kind] += 1;
  return counts;
}

function filterHomeItems(items: MediaItem[]) {
  return items.filter((item) => !hiddenHomeTypes.has(classifyItem(item).type));
}

function itemHumanLine(item: MediaItem) {
  const parts = [
    progressLabel(item) || watchStatusLabel(getWatchStatus(item)),
    classifyItem(item).type,
    item.platform || "",
    item.rating !== null ? `評分 ${item.rating}` : ""
  ].filter(Boolean);
  return parts.join(" · ");
}

function deskLead(item: MediaItem) {
  const status = getWatchStatus(item);
  if (status === "watching" || status === "rewatching") return "上次看到一半的，今天不用重新翻片單。";
  if (status === "plan_to_watch") return "它在口袋裡待著，今天可以把它拿到桌面上。";
  if (status === "completed") return "剛看完的作品，趁印象還在補一句心得。";
  return "最近動過的紀錄先放桌上，等等要整理也找得到。";
}

function focusHint(item: MediaItem) {
  const date = displayDate(item);
  if (date) return `最近記錄：${date}`;
  return "點開後可以補進度、心得或評分。";
}

function noteExcerpt(item: MediaItem) {
  const note = (item.quick_note || item.long_note || "").replace(/\s+/g, " ").trim();
  if (!note) return "";
  return note.length > 46 ? `${note.slice(0, 46)}...` : note;
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
