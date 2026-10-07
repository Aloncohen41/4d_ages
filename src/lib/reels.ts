import { Memory } from "./types";
import { Slide, slidesOf } from "./slides";
import { addMonthsClamped } from "./date";
import { ageSpan } from "./ageSpan";

/**
 * An automatic summary video.
 *  - "age":  a stretch of the CHILD's life — since birth to 1 month, 3 months, 6 months and 1 year, then each year of age (1–2 years, 2–3 years…)
 *  - "year": a calendar year ("2026")
 *  - "all":  everything, from day one
 */
export interface Reel {
  id: string;
  kind: "age" | "year" | "all";
  label: string; // "0–6 months", "1–2 years", "2026", "From day one"
  title: string; // the title card of the video: "Here is Maya"
  subtitle: string; // "at 1–2 years old"
  fileLabel: string; // for the saved file's name: "1-2 years"
  from: string; // the dates it covers (inclusive)
  to: string;
  inProgress: boolean; // the period isn't over yet ("so far")
  slides: Slide[];
  cover: Slide | null;
  newest: string; // the date of the newest picture in it
}

/** Keep `max` slides spread evenly across the list (in order). */
export function evenly<T>(list: T[], max: number): T[] {
  if (list.length <= max) return list;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(list[Math.round((i * (list.length - 1)) / (max - 1))]);
  return out.filter((x, i) => out.indexOf(x) === i);
}

/** A long stretch's highlights: every milestone, first and last, plus the best two memories of each month. */
export function yearHighlights(memories: Memory[]): Memory[] {
  const keep: Memory[] = memories.filter((m) => m.type === "milestone" || m.type === "first" || m.type === "last");
  const byMonth = new Map<string, Memory[]>();
  for (const m of memories) {
    if (m.type === "milestone" || m.type === "first" || m.type === "last") continue;
    const k = m.date.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) || []), m]);
  }
  const score = (m: Memory) => (m.media.length ? 4 : 0) + Math.min(m.tagIds.length, 2) + (m.description.length > 30 ? 1 : 0);
  for (const list of byMonth.values()) keep.push(...[...list].sort((a, b) => score(b) - score(a) || a.date.localeCompare(b.date)).slice(0, 2));
  return keep;
}

/** The first steps of a life, each counted from birth. */
export const AGE_STEPS = [1, 3, 6, 12] as const; // months

export interface AgeWindow { id: string; startM: number; endM: number; from: string; to: string }

/**
 * The stretches of a child's life that get a video: from birth to 1, 3, 6 months and 1 year, then every year of age — 1–2, 2–3, … — as far as
 * the child has got. Ends are inclusive, so a birthday belongs to the year it finishes and the one it starts.
 */
export function ageWindows(birth: string, today: string): AgeWindow[] {
  const out: AgeWindow[] = AGE_STEPS.map((m) => ({ id: `age-0-${m}`, startM: 0, endM: m, from: birth, to: addMonthsClamped(birth, m) }));
  for (let n = 1; n < 40; n++) {
    const from = addMonthsClamped(birth, n * 12);
    if (from > today) break;
    out.push({ id: `age-${n * 12}-${(n + 1) * 12}`, startM: n * 12, endM: (n + 1) * 12, from, to: addMonthsClamped(birth, (n + 1) * 12) });
  }
  return out;
}

const newestFirst = (a: Reel, b: Reel) => b.newest.localeCompare(a.newest) || b.to.localeCompare(a.to);

interface ChildInfo { id: string; name: string; birth: string }

/**
 * Summaries by the child's age. A step with too little in it gets no video; a step that would show exactly the same pictures as the one before
 * (a 2-month-old's "0–3" and "0–6 months") is shown once, under the shortest name. Newest first.
 */
export function buildAgeReels(memories: Memory[], child: ChildInfo, today: string, opts: { minSlides?: number } = {}): Reel[] {
  const minSlides = opts.minSlides ?? 2;
  const mine = memories.filter((m) => m.childId === child.id);
  const out: Reel[] = [];
  let previous = "";
  for (const w of ageWindows(child.birth, today)) {
    const inside = mine.filter((m) => m.date >= w.from && m.date <= w.to);
    const cap = w.endM - w.startM > 3 ? 40 : 30;
    const all = slidesOf(inside);
    // everything fits → show everything; only a busy stretch is trimmed to its highlights
    const chosen = all.length <= cap ? all : evenly(slidesOf(yearHighlights(inside)), cap);
    if (chosen.length < minSlides) continue;
    const key = chosen.map((s) => s.id).join("|");
    if (w.startM === 0) {
      if (key === previous) continue;
      previous = key;
    }
    const span = ageSpan(w.startM, w.endM);
    out.push({
      id: w.id, kind: "age", label: span.display, title: `Here is ${child.name}`, subtitle: `at ${span.display} old`, fileLabel: span.file,
      from: w.from, to: w.to, inProgress: w.to > today, slides: chosen, cover: chosen.find((s) => s.uri) ?? null, newest: chosen[chosen.length - 1].date,
    });
  }
  return out.sort(newestFirst);
}

/** Summaries by calendar year, newest first. */
export function buildCalendarReels(memories: Memory[], child: ChildInfo, today: string, opts: { minSlides?: number; maxYear?: number } = {}): Reel[] {
  const minSlides = opts.minSlides ?? 2;
  const maxYear = opts.maxYear ?? 40;
  const groups = new Map<string, Memory[]>();
  for (const m of memories) if (m.childId === child.id) groups.set(m.date.slice(0, 4), [...(groups.get(m.date.slice(0, 4)) || []), m]);
  const out: Reel[] = [];
  for (const [y, list] of groups) {
    const chosen = evenly(slidesOf(yearHighlights(list)), maxYear);
    if (chosen.length < minSlides) continue;
    out.push({
      id: `year-${y}`, kind: "year", label: y, title: `${child.name} · ${y}`, subtitle: `${chosen.length} moments`, fileLabel: y,
      from: `${y}-01-01`, to: `${y}-12-31`, inProgress: y === today.slice(0, 4), slides: chosen, cover: chosen.find((s) => s.uri) ?? null, newest: chosen[chosen.length - 1].date,
    });
  }
  return out.sort(newestFirst);
}

export interface WatchSections {
  age: Reel[];
  years: Reel[];
  /** Which section is shown first: the one holding the newest video (a tie goes to the child's-age section). */
  first: "age" | "years";
}

export function buildWatchSections(memories: Memory[], child: ChildInfo, today: string): WatchSections {
  const age = buildAgeReels(memories, child, today);
  const years = buildCalendarReels(memories, child, today);
  const newestAge = age[0]?.newest ?? "";
  const newestYears = years[0]?.newest ?? "";
  return { age, years, first: newestYears > newestAge ? "years" : "age" };
}
