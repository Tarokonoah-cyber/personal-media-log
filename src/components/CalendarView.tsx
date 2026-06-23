import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listItems } from "../lib/api";
import { classifyItem } from "../lib/taxonomy";
import { getWatchStatus } from "../lib/watch";
import type { ListFilters, MediaItem } from "../types";

const statusViews = ["plan_to_watch", "watching", "completed", "paused", "dropped", "rewatching"];

export function CalendarView({
  filters,
  includePrivate,
  activeView,
  activeCategory,
  libraryTypes
}: {
  filters: ListFilters;
  includePrivate: boolean;
  activeView: string;
  activeCategory: string;
  libraryTypes: Set<string>;
}) {
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const monthKey = toMonthKey(monthDate);
  const monthStart = `${monthKey}-01`;
  const monthEnd = toDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));

  useEffect(() => {
    let cancelled = false;
    async function loadMonth() {
      setLoading(true);
      setError("");
      try {
        const nextItems: MediaItem[] = [];
        let page = 1;
        let total = 0;
        do {
          const result = await listItems({
            ...filters,
            page,
            pageSize: 100,
            viewedFrom: monthStart,
            viewedTo: monthEnd,
            includePrivate,
            privateOnly: includePrivate
          });
          nextItems.push(...result.items);
          total = result.total;
          page += 1;
        } while (nextItems.length < total);
        if (!cancelled) setItems(nextItems);
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          setError(err instanceof Error ? err.message : "月曆資料載入失敗");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadMonth();
    return () => {
      cancelled = true;
    };
  }, [filters, includePrivate, monthEnd, monthStart]);

  const visibleItems = useMemo(() => scopeItems(items, activeView, activeCategory, libraryTypes), [activeCategory, activeView, items, libraryTypes]);
  const grouped = useMemo(() => groupByViewedDate(visibleItems), [visibleItems]);
  const selectedItems = grouped.get(selectedDate) || [];
  const days = useMemo(() => calendarDays(monthDate), [monthDate]);

  useEffect(() => {
    if (!selectedDate.startsWith(monthKey)) setSelectedDate(monthStart);
  }, [monthKey, monthStart, selectedDate]);

  return (
    <section className="calendar-view">
      <header className="calendar-head">
        <div>
          <p className="eyebrow">Calendar / 月曆</p>
          <h1>{monthLabel(monthDate)}</h1>
          <span>本月共 {visibleItems.length} 部</span>
        </div>
        <div className="calendar-nav">
          <button onClick={() => setMonthDate(addMonths(monthDate, -1))} aria-label="上一月" title="上一月">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setMonthDate(startOfMonth(new Date()))}>本月</button>
          <button onClick={() => setMonthDate(addMonths(monthDate, 1))} aria-label="下一月" title="下一月">
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      {error && <div className="notice danger">{error}</div>}
      {loading && <div className="empty">月曆載入中...</div>}

      {!loading && (
        <>
          <div className="calendar-grid" aria-label={`${monthLabel(monthDate)}月曆`}>
            {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
              <div className="calendar-weekday" key={day}>{day}</div>
            ))}
            {days.map((day) => {
              const dateItems = grouped.get(day.key) || [];
              const inMonth = day.key.startsWith(monthKey);
              return (
                <button
                  key={day.key}
                  className={`${selectedDate === day.key ? "active" : ""} ${inMonth ? "" : "muted"}`}
                  onClick={() => setSelectedDate(day.key)}
                >
                  <span>{day.day}</span>
                  {dateItems.length > 0 && <strong>{dateItems.length} 筆</strong>}
                  {dateItems.slice(0, 2).map((item) => (
                    <em key={item.id}>{titleFor(item)}</em>
                  ))}
                </button>
              );
            })}
          </div>

          <section className="calendar-day-list">
            <div>
              <strong>{selectedDate}</strong>
              <span>{selectedItems.length} 筆</span>
            </div>
            {selectedItems.length === 0 ? (
              <p className="muted-cell">這一天沒有紀錄</p>
            ) : (
              <ul>
                {selectedItems.map((item) => (
                  <li key={item.id}>{titleFor(item)}</li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  );
}

function scopeItems(items: MediaItem[], activeView: string, activeCategory: string, libraryTypes: Set<string>) {
  if (activeCategory) return items.filter((item) => classifyItem(item).category === activeCategory);
  if (libraryTypes.has(activeView)) return items.filter((item) => classifyItem(item).type === activeView);
  if (statusViews.includes(activeView)) return items.filter((item) => getWatchStatus(item) === activeView);
  return items;
}

function groupByViewedDate(items: MediaItem[]) {
  const grouped = new Map<string, MediaItem[]>();
  for (const item of items) {
    const key = viewedDate(item);
    if (!key) continue;
    const list = grouped.get(key) || [];
    list.push(item);
    grouped.set(key, list);
  }
  return grouped;
}

function viewedDate(item: MediaItem) {
  return (item.watched_at || item.created_at || "").slice(0, 10);
}

function titleFor(item: MediaItem) {
  return item.official_title || item.raw_title;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return startOfMonth(new Date(date.getFullYear(), date.getMonth() + amount, 1));
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDateKey(date: Date) {
  return `${toMonthKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

function calendarDays(monthDate: Date) {
  const first = startOfMonth(monthDate);
  const cursor = new Date(first);
  cursor.setDate(cursor.getDate() - cursor.getDay());
  return Array.from({ length: 42 }, () => {
    const value = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
    return { key: toDateKey(value), day: value.getDate() };
  });
}
