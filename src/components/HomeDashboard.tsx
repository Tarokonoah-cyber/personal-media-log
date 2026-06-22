import { isThisWeek, isToday } from "../lib/date";
import type { MediaItem } from "../types";

export function HomeDashboard({ items, inboxTotal, favoriteTotal }: { items: MediaItem[]; inboxTotal: number; favoriteTotal: number }) {
  const todayCount = items.filter((item) => isToday(item.created_at)).length;
  const weekCount = items.filter((item) => isThisWeek(item.created_at)).length;

  return (
    <section className="summary-line" aria-label="紀錄摘要">
      <span>今天 <b>{todayCount}</b></span>
      <span>本週 <b>{weekCount}</b></span>
      <span>待整理 <b>{inboxTotal}</b></span>
      <span>收藏 <b>{favoriteTotal}</b></span>
    </section>
  );
}
