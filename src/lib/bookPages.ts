import { Child, Memory, Relative, Tag } from "./types";
import { byMoment } from "./display";
import { ageBetween, daysBetween, parseISO } from "./date";
import { CLASSICS, ClassicEntry, classicMedia, isFilled } from "./classics";

/*
 * The keepsake book, page by page. One plan drives both the preview on the phone and the exported PDF (both are drawn from the same HTML, see
 * bookHtml.ts), so what you see — the pages, their order, the pictures, the page count — is what you get. Pure, so it can be tested without a phone.
 *
 * Laid out the way the best-loved baby books are: a cover, the day they were born (with the details of that day), the people who love them, then
 * their life in date order from birth to today, in chapters by age (Newborn, 1 month … 11 months, then every 3 months, then every year), with a
 * chapter opener for every new year of life, and a look back at their firsts and a "today" page at the end. Memories are never regrouped by kind:
 * inside the chapters everything stays in the order it happened. Each page is themed by what it is (a first, a last, a story, a birthday) and by the
 * age it belongs to.
 */

export type BookSizeId = "square-15" | "square-20" | "square-30" | "a4-portrait" | "a4-landscape";
export interface BookSize {
  id: BookSizeId;
  label: string; // the full print size, as print shops write it
  wCm: number;
  hCm: number;
  /** memories without a picture that fit on one page */
  notesPerPage: number;
}

/** Standard photo-book sizes. The PDF page is exactly this size (to the nearest PDF point, 0.35 mm). */
export const BOOK_SIZES: BookSize[] = [
  { id: "square-15", label: "Small square — 15 × 15 cm (6 × 6 in)", wCm: 15, hCm: 15, notesPerPage: 2 },
  { id: "square-20", label: "Square — 20 × 20 cm (8 × 8 in)", wCm: 20, hCm: 20, notesPerPage: 3 },
  { id: "square-30", label: "Large square — 30 × 30 cm (12 × 12 in)", wCm: 30, hCm: 30, notesPerPage: 4 },
  { id: "a4-portrait", label: "A4 portrait — 21 × 29.7 cm (8.3 × 11.7 in)", wCm: 21, hCm: 29.7, notesPerPage: 4 },
  { id: "a4-landscape", label: "A4 landscape — 29.7 × 21 cm (11.7 × 8.3 in)", wCm: 29.7, hCm: 21, notesPerPage: 3 },
];
export const DEFAULT_BOOK_SIZE: BookSizeId = "square-20";
export const sizeById = (id: string): BookSize => BOOK_SIZES.find((s) => s.id === id) ?? BOOK_SIZES[1];

/** PDF points (1/72 inch) for a length in cm. */
export const cmToPt = (cm: number) => (cm / 2.54) * 72;
/** The page in whole PDF points, as the printer takes it. */
export const pagePoints = (s: BookSize) => ({ w: Math.round(cmToPt(s.wCm)), h: Math.round(cmToPt(s.hCm)) });

/**
 * How many pictures a book can carry. Each one is embedded in the PDF, scaled down to at most 1400 px on its longest side (about 150–300 KB),
 * so 100 keeps a book well within what the phone can print. With more than this, pictures are chosen evenly across the years.
 */
export const BOOK_PHOTO_LIMIT = 100;
/** A memory with several pictures shows up to this many of them, as a collage. */
export const PHOTOS_PER_PAGE = 4;

/**
 * Measurements shared by every page, in PDF points. `u` is 1% of the page's shorter side, so a page of any size is laid out the same way,
 * only larger or smaller.
 */
export function bookMetrics(s: BookSize) {
  const { w, h } = pagePoints(s);
  const u = Math.min(w, h) / 100;
  return { w, h, u, margin: 7 * u, title: 7.5 * u, label: 3.6 * u, meta: 2.5 * u, body: 2.9 * u, small: 2.2 * u, caption: 25 * u };
}

/**
 * The book's theme: its paper, type and the little drawings on its pages. Classic graphics (moon, clouds, sun, balloons), Nature (leaves,
 * flowers, trees, hills), Child's games (toys and games) and Modern (plain, no drawings). Each comes in several colours (BOOK_COLOURS).
 */
export type BookStyle = "classic" | "nature" | "playful" | "modern" | "stars" | "blossom" | "explorer" | "rainbow";
export const BOOK_STYLES: { id: BookStyle; label: string; desc: string }[] = [
  { id: "classic", label: "Classic", desc: "Cream pages, serif titles, a moon, clouds, sun and balloons as they grow" },
  { id: "nature", label: "Nature", desc: "Soft natural paper with leaves, flowers, trees and hills" },
  { id: "playful", label: "Playful", desc: "Child's games: a rattle, ball, blocks, kite and paper boat, rounded photos" },
  { id: "modern", label: "Modern", desc: "Plain white, clean type, no drawings" },
  { id: "stars", label: "Little Stars", desc: "Stars and moons on a pale night sky, for dreamers" },
  { id: "blossom", label: "Blossom", desc: "Little flowers on blush pink, a dotted frame on every page" },
  { id: "explorer", label: "Little Explorer", desc: "Clouds and paper planes on soft blue, a trail around every page" },
  { id: "rainbow", label: "Rainbow Play", desc: "Colourful confetti and rainbows on cream, for any little one" },
];
/** The four themes with a page background made for children (the others are plain paper with small drawings). */
export const KIDS_THEMES: BookStyle[] = ["stars", "blossom", "explorer", "rainbow"];
/** Themes from earlier versions, so a saved choice still opens. */
export const styleById = (id?: string): BookStyle =>
  id === "minimal" ? "modern" : id === "storybook" ? "playful" : BOOK_STYLES.some((x) => x.id === id) ? (id as BookStyle) : "classic";
/** Each theme's look: paper, ink, the CSS font stacks, how round the photos are, how thick their white frame, and whether drawings are shown. */
export const STYLE_LOOK: Record<BookStyle, { paper: string; ink: string; accent: string; sub: string; fontCss: string; bodyCss: string; radius: number; frame: number; motifs: boolean }> = {
  classic: { paper: "#fffaf0", ink: "#3d2a1f", accent: "#8a4b2d", sub: "#8f6a52", fontCss: "Georgia, 'Noto Serif', 'Times New Roman', serif", bodyCss: "Georgia, 'Noto Serif', serif", radius: 1.2, frame: 1.2, motifs: true },
  nature: { paper: "#fbfaf3", ink: "#2f3a2c", accent: "#4d6b3c", sub: "#6d7a62", fontCss: "'Palatino Linotype', Palatino, 'Book Antiqua', 'Noto Serif', serif", bodyCss: "'Palatino Linotype', Palatino, 'Noto Serif', serif", radius: 2, frame: 1.2, motifs: true },
  playful: { paper: "#fbf8ff", ink: "#3a3358", accent: "#6a5acd", sub: "#7b6c95", fontCss: "'Trebuchet MS', 'Comic Neue', Verdana, sans-serif", bodyCss: "Verdana, Roboto, sans-serif", radius: 4, frame: 1.6, motifs: true },
  modern: { paper: "#ffffff", ink: "#222222", accent: "#222222", sub: "#6b6b6b", fontCss: "'Helvetica Neue', Helvetica, Roboto, Arial, sans-serif", bodyCss: "'Helvetica Neue', Helvetica, Roboto, Arial, sans-serif", radius: 0, frame: 0, motifs: false },
  stars: { paper: "#f3f5fd", ink: "#28305a", accent: "#4a55a2", sub: "#6b7199", fontCss: "Georgia, 'Noto Serif', serif", bodyCss: "Verdana, Roboto, sans-serif", radius: 3, frame: 1.4, motifs: true },
  blossom: { paper: "#fff4f5", ink: "#4a2a33", accent: "#c4587a", sub: "#9a6b78", fontCss: "Georgia, 'Noto Serif', serif", bodyCss: "Georgia, 'Noto Serif', serif", radius: 4, frame: 1.6, motifs: true },
  explorer: { paper: "#f1f7fb", ink: "#1f3a4d", accent: "#2f7aa8", sub: "#5d7f93", fontCss: "'Trebuchet MS', Verdana, sans-serif", bodyCss: "Verdana, Roboto, sans-serif", radius: 2, frame: 1.4, motifs: true },
  rainbow: { paper: "#fffbf2", ink: "#3b2f2a", accent: "#e0663f", sub: "#8c7466", fontCss: "'Trebuchet MS', Verdana, sans-serif", bodyCss: "Verdana, Roboto, sans-serif", radius: 4, frame: 1.6, motifs: true },
};

/** The book's colour: one that changes with their age (newborn blush, then sky, sunshine, sage and lavender), or one colour all through. */
export type BookColour = "age" | "blush" | "sky" | "sunshine" | "sage" | "lavender";
export const BOOK_COLOURS: { id: BookColour; label: string; swatch: string }[] = [
  { id: "age", label: "By age", swatch: "linear" },
  { id: "blush", label: "Blush", swatch: "#e9a99a" },
  { id: "sky", label: "Sky", swatch: "#8db4cf" },
  { id: "sunshine", label: "Sunshine", swatch: "#e2bd5f" },
  { id: "sage", label: "Sage", swatch: "#9cbc84" },
  { id: "lavender", label: "Lavender", swatch: "#b3a2d8" },
];
export const colourById = (id?: string): BookColour => (BOOK_COLOURS.some((c) => c.id === id) ? (id as BookColour) : "age");

/** How you set the book up, kept for each child. */
export interface BookPrefs {
  style?: BookStyle;
  colour?: BookColour;
  size?: BookSizeId;
  from?: string; // the first day it covers (YYYY-MM-DD); unset = from birth
  to?: string; // the last day; unset = to today
  excluded?: string[]; // posts you took out of the book
  personId?: string; // only posts with this family member (a "Grandma book")
  siblings?: string[]; // brothers and sisters in the same book (their ids)
}

/**
 * The memories a book is made of, as you set it up: within the dates, without the posts you took out, and (for a book about someone) only the
 * posts they are tagged in.
 */
export function selectForBook(memories: Memory[], prefs: BookPrefs, tags: Tag[] = []): Memory[] {
  const excluded = new Set(prefs.excluded ?? []);
  const personTags = prefs.personId
    ? new Set([`tag-person-${prefs.personId}`, ...tags.filter((t) => t.relatedFamilyMemberId === prefs.personId).map((t) => t.id)])
    : null;
  return memories.filter(
    (m) =>
      !excluded.has(m.id) &&
      (!prefs.from || m.date >= prefs.from) &&
      (!prefs.to || m.date <= prefs.to) &&
      (!personTags || m.tagIds.some((x) => personTags.has(x))),
  );
}
/** Whether a book set up this way starts at birth (it then has the birth and family pages). */
export const startsAtBirth = (child: Child, prefs: BookPrefs) => !prefs.personId && (!prefs.from || prefs.from <= child.birth);

/* ---------------------------------------------------------------- chapters by age */

/** The stage of life a page belongs to: it picks the page's colours and little drawing. */
export type AgeBand = "newborn" | "early" | "late" | "toddler" | "kid";
export interface Chapter {
  key: string; // one per chapter
  label: string; // "Newborn", "3 months", "1 year, 6 months", "4 years"
  band: AgeBand;
  year: number; // 0 in the first year, 1 in the second…
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** The chapter a date falls in: monthly in the first year, every 3 months up to 3, then yearly. */
/** The pregnancy: everything before the birth (scans, bump photos). */
export const BEFORE_BIRTH: Chapter = { key: "pre", label: "Before you were born", band: "newborn", year: -1 };

/** For a book of several children (their ages differ), chapters are calendar years, each with its own colours. */
export function calendarChapter(date: string): Chapter {
  const y = parseISO(date).getFullYear();
  const bands: AgeBand[] = ["newborn", "early", "late", "toddler", "kid"];
  return { key: `c${y}`, label: String(y), band: bands[((y % 5) + 5) % 5], year: 0 };
}

/**
 * The chapter a date falls in. Fine (a book with plenty in it): Newborn, then every month in the first year, every 3 months up to 3, then yearly.
 * Coarse (a book with a little each month, so pages fill instead of each month standing alone): every 3 months in the first year, every 6 up to
 * 3, then yearly.
 */
export function chapterOf(birth: string, date: string, coarse = false): Chapter {
  if (date < birth) return BEFORE_BIRTH;
  const a = ageBetween(birth, date);
  const months = Math.max(0, a.years * 12 + a.months);
  if (coarse && months < 36) {
    if (months < 12) {
      const q = Math.floor(months / 3) * 3;
      return { key: `cq${q}`, label: q === 0 ? "The first 3 months" : `${q} to ${q + 3} months`, band: q < 3 ? "newborn" : q < 6 ? "early" : "late", year: 0 };
    }
    const h = Math.floor(months / 6) * 6, y = Math.floor(h / 12), m = h % 12;
    return { key: `ch${h}`, label: m ? `${plural(y, "year")}, ${plural(m, "month")}` : plural(y, "year"), band: months < 24 ? "toddler" : "kid", year: y };
  }
  if (a.totalDays <= 28 || months < 1) return { key: "m0", label: "Newborn", band: "newborn", year: 0 };
  if (months < 12) return { key: `m${months}`, label: plural(months, "month"), band: months < 6 ? "early" : "late", year: 0 };
  if (months < 36) {
    const q = Math.floor(months / 3) * 3, y = Math.floor(q / 12), m = q % 12;
    return { key: `q${q}`, label: m ? `${plural(y, "year")}, ${plural(m, "month")}` : plural(y, "year"), band: months < 24 ? "toddler" : "kid", year: y };
  }
  return { key: `y${a.years}`, label: plural(a.years, "year"), band: "kid", year: a.years };
}

/** The birthday a date is, if it is one: 1 for the first birthday, 2 for the second… 0 if it isn't a birthday. */
export function birthdayOn(birth: string, date: string): number {
  const b = parseISO(birth), d = parseISO(date);
  return d.getMonth() === b.getMonth() && d.getDate() === b.getDate() ? Math.max(0, d.getFullYear() - b.getFullYear()) : 0;
}

/* ---------------------------------------------------------------- the pages */

/** What every page carries besides its content: the chapter (for the colours and the running footer) and whether it opens a chapter. */
interface PageBase {
  key: string;
  chapter?: Chapter;
  opens?: boolean; // the first page of its chapter: it carries the chapter's heading
}
export interface BirthDetails {
  date: string;
  time?: string;
  place?: string;
  weightKg?: number;
  heightCm?: number;
  // from the Birth story classic, in the parent's own words (they win over the measurements)
  weightText?: string;
  lengthText?: string;
  type?: string; // the type of birth
  labour?: string;
  who?: string; // who was there
}
export type BookPage = PageBase &
  (
    | { kind: "cover"; photo?: string } // their profile picture, else the first picture of them
    | { kind: "birth"; childId: string; details: BirthDetails; story?: Memory; photo?: Memory; storyText?: string; photoUri?: string }
    | { kind: "classic"; entry: ClassicEntry } // a filled-in page from Classics (teeth, food, the first haircut…)
    | { kind: "family"; people: Relative[]; part: number }
    | { kind: "year"; year: number } // opens a new year of life ("Year two")
    | { kind: "picture"; memory: Memory; photos: string[]; birthday: number; notes?: Memory[] } // notes: a few short words sharing the page
    | { kind: "pictures"; items: { memory: Memory; photo: string; birthday: number }[] } // 2 to 4 small moments on one page
    | { kind: "story"; memory: Memory } // a story without a picture, long enough for a page of its own
    | { kind: "notes"; memories: Memory[] }
    | { kind: "firsts"; memories: Memory[]; part: number }
    | { kind: "end" }
  );
export type PageKind = BookPage["kind"];

/** Every picture a memory can show, in the order you set: photos, and videos by their chosen frame. */
export function picturesOf(m: Memory): string[] {
  return (m.media || []).map((x) => (x.kind === "photo" ? x.uri : x.thumb)).filter((u): u is string => !!u);
}
const hasPicture = (m: Memory) => picturesOf(m).length > 0;
/** What a book is made of: the main photos and milestones — every memory except measurements (they have the Growth page). */
export const inBook = (m: Memory) =>
  m.type !== "measure" && m.type !== "health" && !(m.media.some((x) => x.kind === "audio") && !picturesOf(m).length && !m.description?.trim());
/** A caption this short lets four moments share a page; up to LONG_CAPTION, two share; longer gets a page of its own. */
const SHORT_CAPTION = 70;
const LONG_CAPTION = 220;
/** A story long enough to be given a page of its own when it has no picture. */
const LONG_STORY = 280;

/** A list over as few pages as it needs, shared evenly between them (13 items at 12 a page: 7 and 6, not 12 and a lonely 1). */
export function chunks<T>(list: T[], max: number): T[][] {
  const pages = Math.ceil(list.length / Math.max(1, max));
  const out: T[][] = [];
  for (let p = 0, at = 0; p < pages; p++) {
    const n = Math.ceil((list.length - at) / (pages - p));
    out.push(list.slice(at, at + n));
    at += n;
  }
  return out;
}

/** `n` items chosen evenly across a list (keeping the first and the last), in their order. */
export function spread<T>(list: T[], n: number): T[] {
  if (list.length <= n) return list;
  if (n <= 1) return list.slice(0, Math.max(0, n));
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(list[Math.round((i * (list.length - 1)) / (n - 1))]);
  return out;
}

/** The details of the day they were born, from what was recorded that day (or a measurement in the first three days). */
export function birthDetails(child: Child, memories: Memory[]): BirthDetails {
  const mine = memories.filter((m) => m.childId === child.id).sort(byMoment);
  const that = mine.filter((m) => m.date === child.birth);
  const measure = mine.find((m) => m.type === "measure" && daysBetween(child.birth, m.date) >= 0 && daysBetween(child.birth, m.date) <= 3 && (m.weightKg || m.heightCm));
  const weighed = mine.find((m) => m.type === "measure" && m.weightKg && daysBetween(child.birth, m.date) >= 0 && daysBetween(child.birth, m.date) <= 3);
  const measured = mine.find((m) => m.type === "measure" && m.heightCm && daysBetween(child.birth, m.date) >= 0 && daysBetween(child.birth, m.date) <= 3);
  return {
    date: child.birth,
    time: that.find((m) => m.type === "story" && m.time)?.time ?? that.find((m) => m.time)?.time ?? (measure?.date === child.birth ? measure.time : undefined),
    place: that.find((m) => m.location?.trim())?.location?.trim(),
    weightKg: weighed?.weightKg,
    heightCm: measured?.heightCm,
  };
}

export interface BookPlan {
  pages: BookPage[];
  pictures: number; // pictures in the book
  available: number; // pictures there were to choose from
}
export interface PlanOptions {
  /** the child's family, in the order the parent arranged it: they get "The people who love you" pages */
  family?: Relative[];
  /** the birth and family pages (off for a year-in-review that doesn't start at birth; the cover is always there) */
  intro?: boolean;
  limit?: number;
  /** this child's Classics: the Birth story fills in the birth page, every other filled one gets a keepsake page */
  classics?: ClassicEntry[];
  /** a book of brothers and sisters: these children too, in one book in date order (chapters by calendar year) */
  siblings?: Child[];
}

/** How many people fit on a family page, and how many firsts on a look-back page. */
const peoplePerPage = (s: BookSize) => (s.notesPerPage <= 2 ? 4 : s.hCm / s.wCm > 1.2 ? 6 : s.notesPerPage >= 4 ? 9 : 6);
/** rows of firsts that fit under the heading: the page's height, in units of 1% of its shorter side, less the margins and heading, by the height of a row */
const firstsPerPage = (s: BookSize) => Math.floor(((100 * s.hCm) / Math.min(s.wCm, s.hCm) - 36) / 5.2);

export function planBook(child: Child, memories: Memory[], size: BookSize, opts: PlanOptions = {}): BookPlan {
  const limit = opts.limit ?? BOOK_PHOTO_LIMIT;
  const intro = opts.intro ?? true;
  // one child, or (a sibling book) several, oldest first
  const kids = [child, ...(opts.siblings ?? []).filter((k) => k.id !== child.id)].sort((x, y) => x.birth.localeCompare(y.birth));
  const multi = kids.length > 1;
  const kidOf = (m: Memory) => kids.find((k) => k.id === m.childId) ?? child;
  const ids = new Set(kids.map((k) => k.id));
  const mine = memories.filter((m) => ids.has(m.childId) && inBook(m)).sort(byMoment);

  // each birth page: the birth date and its details, with the birth story (a story on that day) and the first photo of that day.
  // A baby who isn't born yet has no birth page (yet).
  const births = intro
    ? kids.filter((k) => !k.expecting).map((k) => {
        const story = mine.find((m) => m.childId === k.id && m.date === k.birth && m.type === "story");
        const photo = mine.find((m) => m.childId === k.id && m.date === k.birth && hasPicture(m) && m.id !== story?.id);
        return { kid: k, story, photo };
      })
    : [];
  const atBirth = new Set(births.flatMap((x) => [x.story, x.photo]).filter((m): m is Memory => !!m));
  const rest = mine.filter((m) => !atBirth.has(m));

  // pictures, up to the limit, chosen evenly across time; a memory whose picture didn't make it is still in the book, as words.
  // Each chosen memory shows its first picture; the budget left over goes to the extra pictures of memories that have several (a collage).
  const birthPictures = births.reduce((n, x) => n + (x.story && hasPicture(x.story) ? 1 : 0) + (x.photo ? 1 : 0), 0);
  const withPictures = rest.filter(hasPicture);
  const kept = new Set(spread(withPictures, Math.max(0, limit - birthPictures)));
  let budget = Math.max(0, limit - birthPictures - kept.size);
  const shown = new Map<Memory, string[]>();
  for (const m of withPictures) {
    if (!kept.has(m)) continue;
    const all = picturesOf(m).slice(0, PHOTOS_PER_PAGE);
    const extra = Math.min(all.length - 1, budget);
    budget -= extra;
    shown.set(m, all.slice(0, 1 + extra));
  }

  const avatar = memories.find((m) => m.id === child.avatarPhotoId);
  const firstPhoto = births.find((x) => x.photo)?.photo;
  const coverPhoto = (avatar && picturesOf(avatar)[0]) || (firstPhoto && picturesOf(firstPhoto)[0]) || (withPictures[0] && picturesOf(withPictures[0])[0]);
  const pages: BookPage[] = [{ key: "cover", kind: "cover", ...(coverPhoto ? { photo: coverPhoto } : {}) }];

  // Filling the pages: a moment with a short caption shares its page with others (2, or 4 when every caption is short); a special one (a
  // birthday, a first, a milestone, a collage, a long caption) gets a page of its own. Words without a picture are gathered on pages of
  // their own at the end of each chapter, filled by how much text they hold; one or two short ones join a picture's page instead.
  let chapter: Chapter | undefined;
  let year = 0;
  let notes: Memory[] = [];
  let group: { memory: Memory; photo: string; birthday: number }[] = [];
  let chapterStart = pages.length;
  let opens = false; // the next page opens a chapter
  const push = (p: BookPage) => {
    pages.push({ ...p, chapter, ...(opens ? { opens: true } : {}) } as BookPage);
    opens = false;
  };
  const words = (m: Memory) => `${m.title ?? ""} ${m.description ?? ""}`.trim().length;
  const shortCaption = (m: Memory) => words(m) <= SHORT_CAPTION;
  const groupCap = (list: Memory[]) => (size.notesPerPage <= 2 ? 2 : list.every(shortCaption) ? 4 : 2);
  const flushGroup = () => {
    if (group.length === 1) push({ key: `pic-${group[0].memory.id}`, kind: "picture", memory: group[0].memory, photos: [group[0].photo], birthday: group[0].birthday });
    else if (group.length > 1) push({ key: `pics-${group[0].memory.id}`, kind: "pictures", items: group });
    group = [];
  };
  const noteCost = (m: Memory) => 90 + Math.min(m.description?.length ?? 0, 420) + (m.title?.length ?? 0);
  const noteBudget = size.notesPerPage * 230;
  const flushNotes = () => {
    if (!notes.length) return;
    // one or two short notes join the chapter's last single-picture page, when there's room under its caption
    const last = pages[pages.length - 1];
    if (notes.length <= 2 && notes.reduce((t, m) => t + noteCost(m), 0) <= 360 && pages.length > chapterStart && last.kind === "picture" && !last.notes && !last.birthday && words(last.memory) <= 140 && last.photos.length === 1) {
      pages[pages.length - 1] = { ...last, notes };
      notes = [];
      return;
    }
    let page: Memory[] = [];
    let used = 0;
    for (const m of notes) {
      if (page.length && used + noteCost(m) > noteBudget) {
        push({ key: `notes-${page[0].id}`, kind: "notes", memories: page });
        page = [];
        used = 0;
      }
      page.push(m);
      used += noteCost(m);
    }
    if (page.length) push({ key: `notes-${page[0].id}`, kind: "notes", memories: page });
    notes = [];
  };
  const endChapter = () => {
    flushGroup();
    flushNotes();
  };
  // a book with only a little each month gets longer chapters, so its pages fill (on average fewer than 3 memories a month)
  const fineCount = new Set(rest.filter((m) => m.date >= kidOf(m).birth).map((m) => chapterOf(kidOf(m).birth, m.date).key)).size;
  const coarse = !multi && fineCount > 0 && rest.length / fineCount < 3;
  const emit = (list: Memory[]) => {
    for (const m of list) {
      const kid = kidOf(m);
      const c = multi ? calendarChapter(m.date) : chapterOf(kid.birth, m.date, coarse);
      if (c.key !== chapter?.key) {
        endChapter();
        // a new year of life opens with a page of its own (one child's book only)
        if (!multi && c.year > year) {
          year = c.year;
          chapter = c;
          pages.push({ key: `year-${c.year}-${m.id}`, kind: "year", year: c.year, chapter: c });
        }
        chapter = c;
        opens = true;
        chapterStart = pages.length;
      }
      const birthday = kid.expecting ? 0 : birthdayOn(kid.birth, m.date);
      if (kept.has(m)) {
        const photos = shown.get(m) ?? picturesOf(m).slice(0, 1);
        // a birthday, a collage or a long caption gets a page of its own; a first or a milestone does too unless its caption is short
        const special = birthday > 0 || photos.length > 1 || words(m) > LONG_CAPTION || ((m.type === "first" || m.type === "milestone") && words(m) > SHORT_CAPTION * 2);
        if (special) {
          flushGroup();
          push({ key: `pic-${m.id}`, kind: "picture", memory: m, photos, birthday });
        } else {
          if (group.length && group.length + 1 > groupCap([...group.map((g) => g.memory), m])) flushGroup();
          group.push({ memory: m, photo: photos[0], birthday });
          if (group.length >= groupCap(group.map((g) => g.memory))) flushGroup();
        }
      } else if (m.type === "story" && (m.description?.length ?? 0) >= LONG_STORY) {
        flushGroup();
        push({ key: `story-${m.id}`, kind: "story", memory: m });
      } else {
        notes.push(m);
      }
    }
    endChapter();
  };

  // the pregnancy comes first (scans, bump photos), then the birth and the family, then their life in date order
  const beforeBirth = multi ? [] : rest.filter((m) => m.date < child.birth || child.expecting);
  const after = rest.filter((m) => !beforeBirth.includes(m));
  if (intro && beforeBirth.length) emit(beforeBirth);
  chapter = undefined;
  if (intro) {
    for (const { kid, story, photo } of births) {
      const bc = opts.classics?.find((c) => c.childId === kid.id && c.id === "birth");
      const v = bc?.values ?? {};
      const details: BirthDetails = {
        ...birthDetails(kid, memories),
        ...(v.time ? { time: v.time } : {}),
        ...(v.place?.trim() ? { place: v.place.trim() } : {}),
        ...(v.weight?.trim() ? { weightText: v.weight.trim() } : {}),
        ...(v.length?.trim() ? { lengthText: v.length.trim() } : {}),
        ...(v.type ? { type: v.type } : {}),
        ...(v.labour?.trim() ? { labour: v.labour.trim() } : {}),
        ...(v.who?.trim() ? { who: v.who.trim() } : {}),
      };
      const photoUri = (photo && picturesOf(photo)[0]) || (story && picturesOf(story)[0]) || bc?.photos.photo?.find((x) => x.uri)?.uri;
      const storyText = story?.description?.trim() || v.story?.trim() || undefined;
      pages.push({ key: `birth-${kid.id}`, kind: "birth", childId: kid.id, details, story, photo, ...(storyText ? { storyText } : {}), ...(photoUri ? { photoUri } : {}) });
    }
    const fam = opts.family ?? [];
    const per = peoplePerPage(size);
    chunks(fam, per).forEach((people, part) => pages.push({ key: `family-${part}`, kind: "family", people, part }));
  }
  emit(intro ? after : rest);

  // the filled-in Classics, in the order of the Classics page (the Birth story is on the birth page); one child's book only
  if (intro && !multi) {
    for (const tpl of CLASSICS) {
      const e = opts.classics?.find((c) => c.childId === child.id && c.id === tpl.id);
      if (tpl.id !== "birth" && e && isFilled(tpl, e)) pages.push({ key: `classic-${tpl.id}`, kind: "classic", entry: e });
    }
  }

  // a look back at every first and milestone, when there are a few
  const firsts = rest.filter((m) => m.type === "first" || m.type === "milestone");
  if (firsts.length >= 3) {
    const per = firstsPerPage(size);
    chunks(firsts, per).forEach((memories, part) => pages.push({ key: `firsts-${part}`, kind: "firsts", memories, part }));
  }
  pages.push({ key: "end", kind: "end" });
  const classicPictures = pages.reduce((n, p) => n + (p.kind === "classic" ? classicMedia(p.entry).filter((x) => x.uri).length : 0), 0);
  const pictures = birthPictures + [...shown.values()].reduce((n, l) => n + l.length, 0) + classicPictures;
  return { pages, pictures, available: withPictures.length + birthPictures };
}

/** "Year two", "Year three"… (and "Year 21" past twenty). */
export function yearTitle(year: number): string {
  const words = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
  return `Year ${words[year] ?? year + 1}`;
}
/** 1 → "1st", 2 → "2nd", 11 → "11th", 23 → "23rd". */
export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
