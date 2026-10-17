import { Child, MediaKind, Memory } from "./types";
import { addMonths } from "./date";

import { tr } from "./i18n";
export type PostShape = "one" | "separate";

export interface NewPostFile {
  uri: string;
  kind: MediaKind;
  thumb?: string;
  date?: string; // from the file (or changed by hand); missing = unknown
  time?: string;
}

const PALETTES = ["peach", "sage", "butter", "rose", "sky", "lav"];

/**
 * The posts made from picked or shared files. "one": a single photo post holding all of them, on `oneDate`. "separate": a post each, on its own
 * file's date. A date before the child was born moves to the birth date; an unknown one is today. Pure, for tests.
 */
export function buildNewPosts(i: {
  child: Child; shape: PostShape; note: string; items: NewPostFile[]; oneDate: string; today: string; newId: (prefix: string) => string; now: number;
  /** Posts of a kind: bump photos or ultrasound pictures (their source, emoji, and a title from the date). */
  as?: { source: string; emoji: string; title: (date: string) => string };
}): Memory[] {
  const { child, note, today, now } = i;
  // pregnancy photos can be up to ten months before the birth; anything older is put on that day
  const earliest = addMonths(child.birth, -10);
  const onOrAfterBirth = (d: string) => (d < earliest ? earliest : d);
  const media = (f: NewPostFile) => ({ id: i.newId("mi"), uri: f.uri, kind: f.kind, ...(f.thumb ? { thumb: f.thumb } : {}) });
  const base = (date: string, time: string | undefined, files: NewPostFile[], k: number): Memory => ({
    id: i.newId("post"),
    childId: child.id,
    type: "photo",
    date: onOrAfterBirth(date),
    ...(time ? { time } : {}),
    description: note.trim(),
    media: files.map(media),
    tagIds: [],
    emoji: i.as?.emoji ?? (files.every((f) => f.kind === "video") ? "🎬" : "📷"),
    palette: PALETTES[k % PALETTES.length],
    source: i.as?.source ?? tr("Added"),
    ...(i.as ? { title: i.as.title(onOrAfterBirth(date)) } : {}),
    createdAt: now,
    updatedAt: now,
  });
  if (i.shape === "one") {
    const time = i.items.length === 1 ? i.items[0].time : undefined;
    return [base(i.oneDate, time, i.items, 0)];
  }
  return i.items.map((f, k) => base(f.date ?? today, f.time, [f], k));
}
