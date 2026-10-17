/*
 * "My family": every profile together. The posts of all the children and pets (and pregnancies) in one timeline, and their heights side by
 * side on one door frame: on a date (how tall each was then), or at the same age (how tall each was at 1, at 2…). Pure, for tests.
 */
import type { Child, HeightEntry, Memory } from "./types";
import { byMoment } from "./display";
import { daysBetween } from "./date";

const months = (birth: string, date: string) => daysBetween(birth, date) / 30.4375;

/** Everyone's posts, newest first; only the profiles given (the family's own children and pets). */
export function familyTimeline(memories: Memory[], kids: Pick<Child, "id">[]): Memory[] {
  const ids = new Set(kids.map((k) => k.id));
  return memories.filter((m) => ids.has(m.childId)).sort((a, b) => byMoment(b, a));
}

/** How tall someone was on a date: their last measurement on or before it (null before their first). Entries oldest first. */
export function heightOnDate(entries: HeightEntry[], date: string): number | null {
  let cm: number | null = null;
  for (const e of entries) if (e.date <= date) cm = e.cm;
  return cm;
}

/**
 * How tall someone was at an age (in months), estimated between the two measurements either side of it. Null outside what was measured
 * (more than a month before the first or after the last), so nothing is made up.
 */
export function heightAtAge(entries: HeightEntry[], birth: string, age: number): number | null {
  const pts = entries.map((e) => ({ m: months(birth, e.date), cm: e.cm })).sort((a, b) => a.m - b.m);
  if (!pts.length) return null;
  if (age < pts[0].m - 1 || age > pts[pts.length - 1].m + 1) return null;
  if (age <= pts[0].m) return pts[0].cm;
  if (age >= pts[pts.length - 1].m) return pts[pts.length - 1].cm;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (age <= b.m) return b.m === a.m ? b.cm : Math.round((a.cm + ((age - a.m) / (b.m - a.m)) * (b.cm - a.cm)) * 10) / 10;
  }
  return null;
}

/** The span the "by date" slider covers: the first measurement of anyone to the last (null with none). */
export function dateSpan(all: HeightEntry[][]): { from: string; to: string } | null {
  const dates = all.flat().map((e) => e.date).sort();
  return dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null;
}

/** The span the "same age" slider covers, in months: from the youngest age measured to the oldest. */
export function ageSpan(all: { birth: string; entries: HeightEntry[] }[]): { from: number; to: number } | null {
  const ages = all.flatMap((k) => k.entries.map((e) => months(k.birth, e.date)));
  return ages.length ? { from: Math.max(0, Math.floor(Math.min(...ages))), to: Math.ceil(Math.max(...ages)) } : null;
}
