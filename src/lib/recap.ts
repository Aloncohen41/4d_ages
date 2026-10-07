import { addDays, ageBetween, daysBetween, parseISO, toISO } from "./date";
import { HeightEntry, Memory } from "./types";
import { heightAt } from "./growth";
import { coverOf } from "./display";

export function addYears(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setFullYear(d.getFullYear() + n);
  return toISO(d);
}

/** Year k of life: birthday k-1 → birthday k */
export function yearWindow(birth: string, k: number) {
  return { start: addYears(birth, k - 1), end: addYears(birth, k) };
}

/** The year currently in progress (1 = first year of life) */
export function currentYear(birth: string, today: string): number {
  return Math.max(1, ageBetween(birth, today).years + 1);
}

/**
 * When a birthday is close (up to 7 days ahead, or 3 days after), returns which year is wrapping up.
 * daysUntil is negative if the birthday just passed.
 */
export function birthdayBanner(birth: string, today: string): { turning: number; daysUntil: number } | null {
  const b = parseISO(birth);
  const t = parseISO(today);
  for (let y = t.getFullYear() - 1; y <= t.getFullYear() + 1; y++) {
    if (y <= b.getFullYear()) continue;
    const bday = toISO(new Date(y, b.getMonth(), b.getDate()));
    const diff = daysBetween(today, bday);
    if (diff >= -3 && diff <= 7) return { turning: y - b.getFullYear(), daysUntil: diff };
  }
  return null;
}

/** Memories from within ±window days of today's month/day in earlier years */
export function onThisDay(memories: Memory[], childId: string, today: string, windowDays = 2): { memory: Memory; yearsAgo: number }[] {
  const t = parseISO(today);
  const out: { memory: Memory; yearsAgo: number }[] = [];
  for (const m of memories) {
    if (m.childId !== childId) continue;
    const d = parseISO(m.date);
    const yearsAgo = t.getFullYear() - d.getFullYear();
    if (yearsAgo < 1) continue;
    const thisYear = new Date(t.getFullYear(), d.getMonth(), d.getDate());
    if (Math.abs(daysBetween(toISO(thisYear), today)) <= windowDays) out.push({ memory: m, yearsAgo });
  }
  return out.sort((a, b) => b.memory.date.localeCompare(a.memory.date));
}

export interface Recap {
  highlights: Memory[]; // the year's best, oldest first
  milestones: Memory[]; // milestones logged in the year
  firsts: Memory[]; // First and Last memories from the year
  photoCount: number;
  startCm?: number;
  endCm?: number;
}

/** Pick the highlights of a year: every milestone, first and last, plus the best memory of each month. */
export function buildRecap(memories: Memory[], heights: HeightEntry[], childId: string, start: string, end: string, cap = 24): Recap {
  const inWin = memories.filter((m) => m.childId === childId && m.date >= start && m.date <= end);
  const milestones = inWin.filter((m) => m.type === "milestone").sort((a, b) => a.date.localeCompare(b.date));
  const firsts = inWin.filter((m) => m.type === "first" || m.type === "last").sort((a, b) => a.date.localeCompare(b.date));
  const plain = inWin.filter((m) => m.type !== "milestone" && m.type !== "first" && m.type !== "last");

  const byMonth = new Map<number, Memory[]>();
  for (const m of plain) {
    const k = Math.floor(daysBetween(start, m.date) / 30.4375);
    byMonth.set(k, [...(byMonth.get(k) || []), m]);
  }
  const score = (m: Memory) => (coverOf(m.media) ? 4 : 0) + (coverOf(m.media)?.kind === "photo" ? 1 : 0) + Math.min(m.tagIds.length, 2) + (m.description.length > 30 ? 1 : 0);
  const picks: Memory[] = [];
  for (const list of byMonth.values()) picks.push([...list].sort((a, b) => score(b) - score(a) || a.date.localeCompare(b.date))[0]);

  const highlights = [...picks, ...milestones, ...firsts].sort((a, b) => a.date.localeCompare(b.date)).slice(0, cap);

  const s = heightAt(heights, start) || [...heights].filter((h) => h.date >= start && h.date <= end).sort((a, b) => a.date.localeCompare(b.date))[0];
  const e = heightAt(heights, end);
  return { highlights, milestones, firsts, photoCount: plain.length, startCm: s?.cm, endCm: e?.cm };
}

export { addDays };
