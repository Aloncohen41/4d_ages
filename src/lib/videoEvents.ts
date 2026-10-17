/*
 * Videos suggested from what happened, the way a phone's photo app offers "A day to remember": a day with lots of photos, a few days away,
 * a birthday, or a month in review. Each comes with a title you can change and the photos it's made of. Pure, for tests.
 */
import { Memory, Tag } from "./types";
import { addDays } from "./date";
import { MONTH_NAMES } from "./dates";
import { ordinal } from "./bookPages";
import { Slide, slidesOf } from "./slides";
import { evenly } from "./reels";

import { tr, wordList } from "./i18n";
export type EventKind = "birthday" | "trip" | "day" | "month";

export interface VideoEvent {
  id: string; // stays the same for the same days, so a title you gave it is kept
  kind: EventKind;
  title: string; // "Maya's 2nd birthday", "3 days in Brighton", "A Saturday to remember", "May with Maya"
  subtitle: string; // "12–14 May 2026 · 18 photos"
  from: string;
  to: string;
  photos: number;
  memoryIds: string[];
}

/** A day full of photos (or a stretch of days, or a birthday, or a month) needs at least this many to be suggested. */
export const DAY_MIN = 8;
export const TRIP_MIN = 12;
export const BIRTHDAY_MIN = 4;
export const MONTH_MIN = 10;

const WEEKDAYS = wordList(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
const SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
const day = (iso: string) => new Date(`${iso}T12:00:00`);
/** How many pictures (photos and videos) a memory holds. */
const pictures = (m: Memory) => (m.media || []).filter((x) => (x.kind === "photo" || x.kind === "video") && (x.uri || x.thumb)).length;

/** "12 May 2026", "12–14 May 2026", "30 Apr – 2 May 2026". */
export function spanLabel(from: string, to: string): string {
  const a = day(from), b = day(to);
  if (from === to) return `${a.getDate()} ${MONTH_NAMES[a.getMonth()]} ${a.getFullYear()}`;
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${a.getDate()}–${b.getDate()} ${MONTH_NAMES[a.getMonth()]} ${a.getFullYear()}`;
  return `${a.getDate()} ${SHORT[a.getMonth()]} – ${b.getDate()} ${SHORT[b.getMonth()]} ${b.getFullYear()}`;
}

/** The place most of them were at, if most of them say. */
function placeOf(list: Memory[]): string | undefined {
  const count = new Map<string, number>();
  for (const m of list) {
    const p = m.location?.split(",")[0].trim();
    if (p) count.set(p, (count.get(p) ?? 0) + 1);
  }
  const best = [...count.entries()].sort((x, y) => y[1] - x[1])[0];
  return best && best[1] * 2 >= list.length ? best[0] : undefined;
}

/**
 * The videos worth suggesting, newest first: birthdays, trips (two or more days in a row full of photos), big days, and the months with lots
 * in them. A day that's part of a trip or a birthday isn't suggested again on its own.
 */
export function suggestEvents(memories: Memory[], child: { id: string; name: string; birth: string }, today: string, limit = 8): VideoEvent[] {
  const mine = memories.filter((m) => m.childId === child.id && m.date <= today && pictures(m) > 0);
  const byDay = new Map<string, Memory[]>();
  for (const m of mine) byDay.set(m.date, [...(byDay.get(m.date) ?? []), m]);
  const count = (d: string) => (byDay.get(d) ?? []).reduce((n, m) => n + pictures(m), 0);
  const used = new Set<string>();
  const out: VideoEvent[] = [];
  const make = (kind: EventKind, from: string, to: string, title: string) => {
    const list = mine.filter((m) => m.date >= from && m.date <= to);
    const photos = list.reduce((n, m) => n + pictures(m), 0);
    out.push({ id: `ev-${kind}-${from}-${to}`, kind, title, subtitle: `${spanLabel(from, to)} · ${photos} photos`, from, to, photos, memoryIds: list.map((m) => m.id) });
  };

  // birthdays (the day before to the day after)
  const born = day(child.birth);
  for (let n = 1; n < 100; n++) {
    const bday = `${born.getFullYear() + n}-${child.birth.slice(5)}`;
    if (bday > today) break;
    const from = addDays(bday, -1), to = addDays(bday, 1);
    let photos = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) photos += count(d);
    if (photos >= BIRTHDAY_MIN) {
      make("birthday", from, to, `${child.name}'s ${ordinal(n)} birthday`);
      for (let d = from; d <= to; d = addDays(d, 1)) used.add(d);
    }
  }

  // trips: days in a row (a quiet day in between is fine), each with a few photos
  const days = [...byDay.keys()].filter((d) => !used.has(d) && count(d) >= 2).sort();
  let run: string[] = [];
  const endRun = () => {
    const total = run.reduce((n, d) => n + count(d), 0);
    if (run.length >= 2 && total >= TRIP_MIN) {
      const list = mine.filter((m) => m.date >= run[0] && m.date <= run[run.length - 1]);
      const place = placeOf(list);
      const span = Math.round((day(run[run.length - 1]).getTime() - day(run[0]).getTime()) / 86_400_000) + 1;
      make("trip", run[0], run[run.length - 1], place ? `${span} days in ${place}` : `${span} days to remember`);
      run.forEach((d) => used.add(d));
    }
    run = [];
  };
  for (const d of days) {
    if (run.length && addDays(run[run.length - 1], 2) < d) endRun();
    run.push(d);
  }
  endRun();

  // big days
  for (const [d, list] of byDay) {
    if (used.has(d) || count(d) < DAY_MIN) continue;
    const place = placeOf(list);
    make("day", d, d, place ? `A day in ${place}` : `A ${WEEKDAYS[day(d).getDay()]} to remember`);
  }

  // months in review: the last few months with plenty in them
  for (let k = 0; k < 4; k++) {
    const t = day(today);
    const first = new Date(t.getFullYear(), t.getMonth() - k, 1);
    const ym = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}`;
    const list = mine.filter((m) => m.date.startsWith(ym));
    if (list.reduce((n, m) => n + pictures(m), 0) < MONTH_MIN) continue;
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    make("month", `${ym}-01`, `${ym}-${String(last).padStart(2, "0")}`, `${MONTH_NAMES[first.getMonth()]} with ${child.name}`);
  }

  return out.sort((a, b) => b.to.localeCompare(a.to) || (a.kind === "month" ? 1 : 0) - (b.kind === "month" ? 1 : 0)).slice(0, limit);
}

/** An event's video: every photo and video in it (each its own moment), at most `max`, spread across it. */
export function eventSlides(memories: Memory[], ev: VideoEvent, max = 40): Slide[] {
  const ids = new Set(ev.memoryIds);
  return evenly(slidesOf(memories.filter((m) => ids.has(m.id)), { perMedia: true }), max);
}

/** Who's in the video: everyone, only the child (posts no one else is tagged in), or the child with family (posts with someone tagged). */
export type WhoMode = "all" | "alone" | "family";

const isPersonTag = (id: string, tags: Tag[]) => id.startsWith("tag-person-") || tags.some((t) => t.id === id && t.category === "person");

export function filterByWho<T extends { memoryId: string }>(slides: T[], memories: Memory[], tags: Tag[], who: WhoMode): T[] {
  if (who === "all") return slides;
  const withPeople = new Set(memories.filter((m) => m.tagIds.some((id) => isPersonTag(id, tags))).map((m) => m.id));
  return slides.filter((s) => (who === "family" ? withPeople.has(s.memoryId) : !withPeople.has(s.memoryId)));
}

/** Words for the video: the stories already written (their text), newest first. */
export interface StoryWords { id: string; date: string; title: string; text: string }
export function storyWords(memories: Memory[], childId: string): StoryWords[] {
  return memories
    .filter((m) => m.childId === childId && m.type === "story" && (m.description ?? "").trim().length >= 3)
    .map((m) => ({ id: m.id, date: m.date, title: (m.title ?? "").trim(), text: m.description.trim() }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** How long a card of words stays: long enough to read, never too long. */
export const cardMs = (text: string, perMs: number) => Math.round(Math.min(8000, Math.max(perMs * 1.4, 1800 + text.length * 45)));
