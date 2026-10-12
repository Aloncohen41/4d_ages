import { Child, Memory, NotifPrefs } from "./types";
import { addMonthsClamped, daysBetween, parseISO } from "./date";
import { ClassicEntry } from "./classics";

/*
 * Looking back and keeping up: "On this day" (what happened on today's date in earlier years) and the monthly photo (in the first year, a
 * reminder on each month's birthday to take the photo for the Monthly photos page in Classics). Pure, so they can be tested.
 */

export interface OnThisDay {
  memory: Memory;
  yearsAgo: number;
}

/** Memories from today's day and month in earlier years, the most recent year first (measurements and health notes aren't memories to relive). */
export function onThisDay(memories: Memory[], childId: string, today: string): OnThisDay[] {
  const t = parseISO(today);
  return memories
    .filter((m) => m.childId === childId && m.type !== "measure" && m.type !== "health")
    .map((m) => ({ m, d: parseISO(m.date) }))
    .filter(({ d }) => d.getMonth() === t.getMonth() && d.getDate() === t.getDate() && d.getFullYear() < t.getFullYear())
    .map(({ m, d }) => ({ memory: m, yearsAgo: t.getFullYear() - d.getFullYear() }))
    .sort((a, b) => a.yearsAgo - b.yearsAgo || (b.memory.media.length - a.memory.media.length));
}

/** How many days after a monthly photo's day it is still offered on Home. */
export const MONTHLY_PHOTO_DAYS = 7;

/**
 * The monthly photo that's due: in the first year, from each month's birthday for a week, while that month's photo is missing from the
 * Monthly photos page. Null when there's nothing to take (or they're past their first birthday, or not born yet).
 */
export function monthlyPhotoDue(child: Child, classics: ClassicEntry[], today: string): { month: number; date: string } | null {
  if (child.expecting || child.kind === "pet") return null; // a pet has no monthly-photo grid
  const grid = classics.find((c) => c.childId === child.id && c.id === "grid");
  for (let month = 12; month >= 1; month--) {
    const date = addMonthsClamped(child.birth, month);
    const since = daysBetween(date, today);
    if (since < 0) continue;
    if (since >= MONTHLY_PHOTO_DAYS) return null; // the latest one is past its week
    return grid?.photos[`m${month}`]?.length ? null : { month, date };
  }
  return null;
}

export interface PlannedReminder {
  date: Date;
  title: string;
  body: string;
  data: { kind: "monthly-photo"; childId: string; month: number };
}

/** "Time for Maya's 4-month photo": a notification on each month's birthday in the first year, a little after the monthly cheer. */
export function planMonthlyPhotoNotifications(kids: Pick<Child, "id" | "name" | "birth" | "expecting">[], prefs: NotifPrefs, now: Date): PlannedReminder[] {
  if (!prefs.enabled || prefs.monthlyPhoto === false) return [];
  const out: PlannedReminder[] = [];
  for (const k of kids) {
    if (k.expecting) continue;
    for (let month = 1; month <= 12; month++) {
      const d = parseISO(addMonthsClamped(k.birth, month));
      d.setHours(Math.min(20, prefs.hour + 2), 0, 0, 0);
      if (d <= now) continue;
      out.push({
        date: d,
        title: `Time for ${k.name}'s ${month === 12 ? "first birthday" : `${month}-month`} photo`,
        body: "Take this month's photo for the Monthly photos page in Classics. The same spot each month makes a lovely grid.",
        data: { kind: "monthly-photo", childId: k.id, month },
      });
    }
  }
  return out;
}
