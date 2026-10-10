import { Child, Memory } from "./types";
import { byMoment, coverOf } from "./display";

/*
 * The keepsake book, page by page. One plan drives both the preview on the phone and the exported PDF, so what you see — the pages, their order,
 * the pictures, the page count — is what you get. Pure, so it can be tested without a phone.
 *
 * The book runs in date order from the day they were born to today: the cover, the birth page (the birth date, and the birth story or first
 * photo if there is one), then every memory in the order it happened. A memory with a picture gets a page of its own; memories without one
 * share a page with their neighbours. Nothing is grouped into sections.
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

/**
 * Measurements shared by the PDF and the preview, in PDF points. `u` is 1% of the page's shorter side, so a page of any size is laid out the same
 * way, only larger or smaller.
 */
export function bookMetrics(s: BookSize) {
  const { w, h } = pagePoints(s);
  const u = Math.min(w, h) / 100;
  return { w, h, u, margin: 7 * u, title: 7.5 * u, label: 3.6 * u, meta: 2.5 * u, body: 2.9 * u, small: 2.2 * u, caption: 25 * u };
}

export type BookStyle = "classic" | "minimal" | "storybook";
export const BOOK_STYLES: { id: BookStyle; label: string; desc: string }[] = [
  { id: "classic", label: "Classic", desc: "Warm cream pages, serif titles" },
  { id: "minimal", label: "Minimal", desc: "Clean white, lots of space" },
  { id: "storybook", label: "Storybook", desc: "Soft pastel, rounded photos" },
];
/** Each style's look, for the PDF (CSS font stack) and the preview (the phone's matching family). */
export const STYLE_LOOK: Record<BookStyle, { paper: string; ink: string; accent: string; sub: string; fontCss: string; fontApp: string; radius: number; frame: number }> = {
  classic: { paper: "#fffaf0", ink: "#3d2a1f", accent: "#8a4b2d", sub: "#8f5a32", fontCss: "Georgia, 'Times New Roman', serif", fontApp: "serif", radius: 1.2, frame: 0 },
  minimal: { paper: "#ffffff", ink: "#222222", accent: "#222222", sub: "#6b6b6b", fontCss: "Helvetica, Arial, sans-serif", fontApp: "sans-serif", radius: 0, frame: 0 },
  storybook: { paper: "#f4f1ff", ink: "#3a3358", accent: "#6a5acd", sub: "#7b5c8f", fontCss: "'Trebuchet MS', Verdana, sans-serif", fontApp: "sans-serif-medium", radius: 4, frame: 1.4 },
};

export type BookPage =
  | { kind: "cover"; key: string }
  | { kind: "birth"; key: string; date: string; story?: Memory; photo?: Memory }
  | { kind: "picture"; key: string; memory: Memory }
  | { kind: "notes"; key: string; memories: Memory[] }
  | { kind: "end"; key: string };

const hasPicture = (m: Memory) => coverOf(m.media)?.kind === "photo";
/** What a book is made of: the main photos and milestones — every memory except measurements (they have the Growth page). */
export const inBook = (m: Memory) => m.type !== "measure";

/** `n` items chosen evenly across a list (keeping the first and the last), in their order. */
export function spread<T>(list: T[], n: number): T[] {
  if (list.length <= n) return list;
  if (n <= 1) return list.slice(0, Math.max(0, n));
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(list[Math.round((i * (list.length - 1)) / (n - 1))]);
  return out;
}

export interface BookPlan {
  pages: BookPage[];
  pictures: number; // pictures in the book
  available: number; // pictures there were to choose from
}

export function planBook(child: Child, memories: Memory[], size: BookSize, limit = BOOK_PHOTO_LIMIT): BookPlan {
  const mine = memories.filter((m) => m.childId === child.id && inBook(m)).sort(byMoment);

  // the birth page: the birth date, with the birth story (a story on that day) and the first photo of that day
  const story = mine.find((m) => m.date === child.birth && m.type === "story");
  const photo = mine.find((m) => m.date === child.birth && hasPicture(m) && m.id !== story?.id);
  const rest = mine.filter((m) => m !== story && m !== photo);

  // pictures, up to the limit (chosen evenly across time); a memory whose picture didn't make it is still in the book, as words
  const withPictures = rest.filter(hasPicture);
  const birthPictures = (story && hasPicture(story) ? 1 : 0) + (photo ? 1 : 0);
  const kept = new Set(spread(withPictures, Math.max(0, limit - birthPictures)));

  const pages: BookPage[] = [{ kind: "cover", key: "cover" }, { kind: "birth", key: "birth", date: child.birth, story, photo }];
  let notes: Memory[] = [];
  const flush = () => {
    if (notes.length) pages.push({ kind: "notes", key: `notes-${notes[0].id}`, memories: notes });
    notes = [];
  };
  for (const m of rest) {
    if (kept.has(m)) {
      flush();
      pages.push({ kind: "picture", key: `pic-${m.id}`, memory: m });
    } else {
      notes.push(m);
      if (notes.length >= size.notesPerPage) flush();
    }
  }
  flush();
  pages.push({ kind: "end", key: "end" });
  return { pages, pictures: kept.size + birthPictures, available: withPictures.length + birthPictures };
}
