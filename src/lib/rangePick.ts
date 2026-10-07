import { addDays, ageBetween, daysBetween } from "./date";
import { AgeSpan, ageSpan } from "./ageSpan";
import { ageWindows } from "./reels";

/*
 * Choosing a stretch of a child's life with two sliders. A slider position is a DAY NUMBER since birth (0 = the day they were born,
 * `total` = today), so dragging shows a date and the child's age at that moment.
 */

export const dayDate = (birth: string, index: number) => addDays(birth, Math.round(index));
export const dayIndex = (birth: string, date: string, total: number) => Math.max(0, Math.min(total, daysBetween(birth, date)));
export const totalDays = (birth: string, today: string) => Math.max(0, daysBetween(birth, today));

/** Moving one end can push against the other but never cross it. */
export function clampRange(from: number, to: number, moved: "from" | "to", total: number): { from: number; to: number } {
  const f = Math.max(0, Math.min(total, Math.round(from)));
  const t = Math.max(0, Math.min(total, Math.round(to)));
  return moved === "from" ? { from: Math.min(f, t), to: t } : { from: f, to: Math.max(t, f) };
}

/** The stretch of life between two slider positions, worded as an age range: "1–2 years", "14–20 months"… */
export function rangeSpan(birth: string, from: number, to: number): AgeSpan {
  return ageSpan(wholeMonths(birth, dayDate(birth, from)), wholeMonths(birth, dayDate(birth, to)));
}

/** Completed calendar months at a date — a birthday is a birthday (a first birthday is exactly 12 months, not 11.99). */
export function wholeMonths(birth: string, date: string): number {
  const a = ageBetween(birth, date);
  return a.years * 12 + a.months;
}

export interface RangePreset { id: string; label: string; from: number; to: number }

/** One-tap starting points: the last 30 days, all time, and each age step the child has reached (0–6 months, 1–2 years…). */
export function presetRanges(birth: string, today: string): RangePreset[] {
  const total = totalDays(birth, today);
  const out: RangePreset[] = [{ id: "recent", label: "Last 30 days", from: Math.max(0, total - 30), to: total }];
  for (const w of ageWindows(birth, today)) {
    const from = dayIndex(birth, w.from, total), to = dayIndex(birth, w.to, total);
    if (to > from) out.push({ id: w.id, label: ageSpan(w.startM, w.endM).display, from, to });
  }
  out.push({ id: "all", label: "All time", from: 0, to: total });
  return out;
}

/** The title card of a made video: "Here is Maya" / "at 1–2 years old" (or the name you typed, over the same age line). */
export function videoTitles(childName: string, span: AgeSpan, typed: string): { title: string; subtitle: string } {
  return { title: typed.trim() || `Here is ${childName}`, subtitle: `at ${span.display} old` };
}
