import { Child, Memory, MilestoneDef, Relative, Tag, isPet } from "./types";
import { familyRows } from "./familyTree";
import { onMap, placesByYear, placesSummary } from "./places";
import { petAge } from "./pets";
import { indexTags, initialsOf, labelOfTag, displayName, relationLine } from "./tags";
import { ageLong, ageShort, daysBetween, formatDate, formatSpan, formatTime, parseISO, smartAge, todayISO } from "./date";
import { formatHeight, formatWeight, HeightUnit, WeightUnit } from "./growth";
import { TYPE_META } from "./entries";
import { APP_NAME } from "../brand";
import { CLASSICS, ClassicEntry, TEETH, datedItems, listItems } from "./classics";
import { AgeBand, BookColour, bookName, BookPage, BookPlan, BookSize, BookStyle, STYLE_LOOK, bookMetrics, ordinal, picturesOf, styleById, yearTitle } from "./bookPages";

/*
 * The book's pages as one HTML document. The PDF is printed from it, and the preview on the phone shows the very same document in a web view,
 * so every page looks the same in both. Pure (no phone APIs): the caller says where each picture comes from.
 *
 * The look follows the best-loved baby books: framed photos with a short caption, a details card for the day they were born, a page for the
 * family, a chapter heading for each age, an opener for every new year of life, small drawings that change with age (moon and stars for a
 * newborn, clouds, sun, balloons, a rainbow), and pages themed by what they hold (a ribbon for a first, confetti for a birthday, a quote for a story).
 */

export interface BookHtmlInput {
  child: Child;
  /** a book of brothers and sisters: the other children in it (their names and ages are shown with each memory) */
  siblings?: Child[];
  plan: BookPlan;
  defs: MilestoneDef[]; // the milestone catalogue (for names)
  style: BookStyle;
  colour?: BookColour; // "age" (the default) changes with their age
  size: BookSize;
  relatives?: Relative[]; // so person tags print as names
  tags?: Tag[]; // the central tag list
  title?: string;
  subtitle?: string;
  weightUnit?: WeightUnit;
  heightUnit?: HeightUnit;
  /** where a picture is read from: a data: URL for the PDF, the file itself for the preview. null leaves its frame empty. */
  image: (uri: string) => string | null;
  /** "print" for the PDF; "pager" (one page at a time, swiped) and "overview" (the cover and the first pages) for the preview. */
  mode?: "print" | "pager" | "overview";
  /** pager: the page to open on. overview: which pages to show, and how wide (in screen pixels) each is drawn. */
  start?: number;
  overview?: { index: number; width: number }[];
  /** pager: the page in front, with a little of the pages before and after it showing at the sides (the Customize view) */
  peek?: boolean;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The heading for a memory on its page: the milestone's name, the title, or what kind of memory it is. */
export function memoryHeading(m: Memory, defs: MilestoneDef[]): string {
  if (m.type === "milestone") return defs.find((d) => d.id === m.milestoneId)?.label ?? m.title ?? "Milestone";
  return m.title?.trim() || (m.type === "photo" ? "" : TYPE_META[m.type].label);
}

/** Each age's colours: a soft wash for the page and an ink for its headings and drawings. */
export const BAND_LOOK: Record<AgeBand, { wash: string; ink: string }> = {
  newborn: { wash: "#f9ebe6", ink: "#b8705f" },
  early: { wash: "#e7f0f6", ink: "#55819f" },
  late: { wash: "#fbf1d8", ink: "#ad7f22" },
  toddler: { wash: "#eaf3e3", ink: "#628649" },
  kid: { wash: "#efe9f8", ink: "#7a64ab" },
};
/** A single colour all through the book uses one of the age colours everywhere. */
/** The family page's title, in the words of each theme. */
export const FAMILY_TITLES: Record<BookStyle, string> = {
  classic: "The people who love you most",
  nature: "The roots that help you grow",
  playful: "Your very best playmates",
  modern: "Your people",
  stars: "The stars in your sky",
  blossom: "The birds that make you bloom",
  explorer: "Your crew for every adventure",
  rainbow: "All the colours of your rainbow",
  paws: "The humans who love you",
  feathers: "Your flock",
  stable: "Your herd",
  leafscale: "Your favourite humans",
};

const COLOUR_BAND: Record<Exclude<BookColour, "age">, AgeBand> = { blush: "newborn", sky: "early", sunshine: "late", sage: "toddler", lavender: "kid" };
/** The drawing for each age in each theme (Modern has none), and the ones on the cover, a year's opener and the family page. */
export const THEME_MOTIFS: Record<Exclude<BookStyle, "modern">, Record<AgeBand | "cover" | "cover2" | "year" | "family", string>> = {
  classic: { newborn: "moon", early: "clouds", late: "sun", toddler: "balloons", kid: "rainbow", cover: "moon", cover2: "star", year: "balloons", family: "heart" },
  nature: { newborn: "sprig", early: "flower", late: "sun", toddler: "tree", kid: "hills", cover: "sprig", cover2: "flower", year: "tree", family: "flower" },
  playful: { newborn: "rattle", early: "ball", late: "blocks", toddler: "kite", kid: "boat", cover: "rattle", cover2: "star", year: "kite", family: "heart" },
  stars: { newborn: "moon", early: "star", late: "moon", toddler: "star", kid: "moon", cover: "moon", cover2: "star", year: "star", family: "heart" },
  blossom: { newborn: "flower", early: "heart", late: "flower", toddler: "sprig", kid: "flower", cover: "flower", cover2: "heart", year: "balloons", family: "heart" },
  explorer: { newborn: "clouds", early: "plane", late: "sun", toddler: "kite", kid: "plane", cover: "plane", cover2: "clouds", year: "balloons", family: "heart" },
  rainbow: { newborn: "rainbow", early: "balloons", late: "sun", toddler: "rainbow", kid: "kite", cover: "rainbow", cover2: "sun", year: "balloons", family: "heart" },
  paws: { newborn: "paw", early: "ball", late: "bone", toddler: "paw", kid: "bone", cover: "paw", cover2: "heart", year: "ball", family: "heart" },
  feathers: { newborn: "feather", early: "clouds", late: "feather", toddler: "sun", kid: "feather", cover: "feather", cover2: "clouds", year: "sun", family: "heart" },
  stable: { newborn: "horseshoe", early: "rosette", late: "hills", toddler: "horseshoe", kid: "rosette", cover: "horseshoe", cover2: "rosette", year: "rosette", family: "heart" },
  leafscale: { newborn: "leaf", early: "sun", late: "sprig", toddler: "leaf", kid: "sprig", cover: "leaf", cover2: "sun", year: "sun", family: "heart" },
};

/**
 * The kids' themes' page backgrounds: a small repeating pattern (at a soft strength, so words and photos stay clear) and a frame drawn around
 * each page. Made of plain shapes, so it prints the same on every printer.
 */
/** A paw print, on a 100 × 100 box (a pad and four toes). */
const PAW = `<ellipse cx="50" cy="66" rx="22" ry="18"/><ellipse cx="24" cy="40" rx="9" ry="12"/><ellipse cx="42" cy="26" rx="9" ry="12"/><ellipse cx="60" cy="26" rx="9" ry="12"/><ellipse cx="77" cy="40" rx="9" ry="12"/>`;
const svgUrl = (inner: string, w = 80, h = 80) => `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${inner}</svg>`)}")`;
const tinyStar = (x: number, y: number, r: number, c: string) => {
  const pts = Array.from({ length: 10 }, (_, k) => { const a = (Math.PI / 5) * k - Math.PI / 2, rr = k % 2 ? r * 0.45 : r; return `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`; }).join(" ");
  return `<polygon points='${pts}' fill='${c}'/>`;
};
const tinyFlower = (x: number, y: number, r: number, c: string) =>
  `<g fill='${c}'>${[0, 72, 144, 216, 288].map((a) => `<ellipse cx='${x}' cy='${y - r}' rx='${r * 0.55}' ry='${r * 0.9}' transform='rotate(${a} ${x} ${y})'/>`).join("")}</g><circle cx='${x}' cy='${y}' r='${r * 0.45}' fill='#fff'/>`;
export const THEME_BACKGROUND: Partial<Record<BookStyle, { pattern: string; tile: number; frame?: string }>> = {
  stars: {
    pattern: svgUrl(`<g opacity='0.32'>${tinyStar(14, 16, 5, "#8f9ad6")}${tinyStar(58, 30, 3.5, "#c9a75a")}${tinyStar(34, 62, 4, "#8f9ad6")}<circle cx='70' cy='68' r='1.6' fill='#8f9ad6'/><circle cx='44' cy='12' r='1.2' fill='#c9a75a'/><path d='M66 8a8 8 0 1 0 7 12a6.5 6.5 0 1 1-7-12z' fill='#c9a75a'/></g>`),
    tile: 22, frame: "1px solid rgba(74,85,162,.35)",
  },
  blossom: {
    pattern: svgUrl(`<g opacity='0.3'>${tinyFlower(16, 18, 5, "#e8a2b8")}${tinyFlower(58, 52, 4, "#f2c3a1")}<circle cx='60' cy='14' r='1.8' fill='#e8a2b8'/><circle cx='22' cy='64' r='1.6' fill='#f2c3a1'/></g>`),
    tile: 20, frame: "2px dotted rgba(196,88,122,.45)",
  },
  explorer: {
    pattern: svgUrl(`<g opacity='0.3'><g fill='#9cc4de'><circle cx='14' cy='20' r='5'/><circle cx='21' cy='17' r='7'/><circle cx='28' cy='20' r='5'/><rect x='14' y='20' width='14' height='5' rx='2.5'/></g><path d='M52 54 L72 46 L60 60z' fill='#7fb0d0'/><path d='M60 60 L62 66 L66 56z' fill='#a9cbe0'/><path d='M4 70 Q20 62 34 70' fill='none' stroke='#9cc4de' stroke-width='1.2' stroke-dasharray='3 3'/></g>`),
    tile: 24, frame: "2px dashed rgba(47,122,168,.4)",
  },
  paws: {
    pattern: svgUrl(`<g opacity='0.26' fill='#c79a74'><g transform='translate(12 14) scale(.18)'>${PAW}</g><g transform='translate(48 46) scale(.14) rotate(20 50 50)'>${PAW}</g><rect x='50' y='14' width='16' height='4' rx='2'/><circle cx='50' cy='14' r='3'/><circle cx='50' cy='18' r='3'/><circle cx='66' cy='14' r='3'/><circle cx='66' cy='18' r='3'/></g>`),
    tile: 22, frame: "2px dotted rgba(176,106,59,.4)",
  },
  feathers: {
    pattern: svgUrl(`<g opacity='0.28'><path d='M16 40 C10 26 18 12 30 8 C30 22 26 34 16 40z' fill='#8fb6d6'/><path d='M16 40 L28 10' stroke='#fff' stroke-width='1'/><path d='M58 70 C52 58 58 46 68 42 C68 54 66 64 58 70z' fill='#b8cfe2'/><circle cx='60' cy='18' r='1.8' fill='#8fb6d6'/></g>`),
    tile: 22, frame: "1px solid rgba(63,127,179,.35)",
  },
  stable: {
    pattern: svgUrl(`<g opacity='0.26' fill='none' stroke='#8c9a52' stroke-width='3' stroke-linecap='round'><path d='M10 30 a10 10 0 1 1 20 0'/><path d='M46 66 a9 9 0 1 1 18 0'/></g><g opacity='0.26' fill='#c9b45e'><circle cx='60' cy='18' r='4'/><circle cx='24' cy='62' r='3'/></g>`),
    tile: 24, frame: "2px dashed rgba(107,123,51,.4)",
  },
  leafscale: {
    pattern: svgUrl(`<g opacity='0.28' fill='#7fb08a'><path d='M10 34 C10 18 24 10 36 10 C36 26 24 34 10 34z'/><path d='M52 70 C52 58 62 52 72 52 C72 64 62 70 52 70z'/></g><g opacity='0.3' fill='#e3c76a'><circle cx='62' cy='18' r='3'/></g>`),
    tile: 22, frame: "1px solid rgba(59,122,76,.35)",
  },
  rainbow: {
    pattern: svgUrl(`<g opacity='0.38'><circle cx='10' cy='12' r='2.4' fill='#f28b6b'/><rect x='34' y='8' width='7' height='3' rx='1.5' fill='#f6c453' transform='rotate(25 37 9)'/><circle cx='62' cy='18' r='2' fill='#7cc6a4'/><rect x='18' y='44' width='7' height='3' rx='1.5' fill='#8fb2e8' transform='rotate(-30 21 45)'/><circle cx='50' cy='48' r='2.6' fill='#c39be0'/><rect x='64' y='66' width='7' height='3' rx='1.5' fill='#f28b6b' transform='rotate(40 67 67)'/><circle cx='28' cy='70' r='1.8' fill='#f6c453'/></g>`),
    tile: 22,
  },
};

/** Small line drawings, one per age, plus the ones the themed pages use. Drawn in one colour, on a 100 × 100 box. */
const STAR = "50,6 61,38 95,38 67,58 78,92 50,72 22,92 33,58 5,38 39,38";
export function motif(name: string, c: string): string {
  const svg = (inner: string) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  switch (name) {
    case "moon":
      return svg(`<path d="M58 14a36 36 0 1 0 28 58A30 30 0 1 1 58 14z" fill="${c}"/><polygon points="${STAR}" transform="translate(12 10) scale(.16)" fill="${c}"/><polygon points="${STAR}" transform="translate(26 40) scale(.1)" fill="${c}"/><polygon points="${STAR}" transform="translate(80 8) scale(.12)" fill="${c}"/>`);
    case "clouds":
      return svg(`<g fill="${c}"><circle cx="30" cy="40" r="11"/><circle cx="44" cy="33" r="15"/><circle cx="60" cy="40" r="11"/><rect x="30" y="40" width="30" height="11" rx="5"/></g><g fill="${c}" opacity=".6"><circle cx="58" cy="72" r="8"/><circle cx="69" cy="66" r="11"/><circle cx="81" cy="72" r="8"/><rect x="58" y="72" width="23" height="8" rx="4"/></g>`);
    case "sun":
      return svg(`<circle cx="50" cy="50" r="17" fill="${c}"/><g stroke="${c}" stroke-width="5" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="50" y1="22" x2="50" y2="10" transform="rotate(${a} 50 50)"/>`).join("")}</g>`);
    case "balloons":
      return svg(`<g fill="none" stroke="${c}" stroke-width="1.6"><path d="M34 52 Q38 72 50 94"/><path d="M64 44 Q60 70 50 94"/><path d="M50 60 Q48 78 50 94"/></g><ellipse cx="34" cy="34" rx="14" ry="17" fill="${c}"/><ellipse cx="64" cy="27" rx="14" ry="17" fill="${c}" opacity=".7"/><ellipse cx="50" cy="45" rx="11" ry="14" fill="${c}" opacity=".85"/>`);
    case "rainbow":
      return svg(`<g fill="none" stroke-linecap="round" stroke="${c}"><path d="M14 74a36 36 0 0 1 72 0" stroke-width="7"/><path d="M26 74a24 24 0 0 1 48 0" stroke-width="7" opacity=".7"/><path d="M38 74a12 12 0 0 1 24 0" stroke-width="7" opacity=".45"/></g>`);
    case "star":
      return svg(`<polygon points="${STAR}" fill="${c}"/>`);
    case "plane":
      return svg(`<path d="M8 50 L92 18 L56 86 L46 60z" fill="${c}"/><path d="M46 60 L92 18 L40 52z" fill="#fff" opacity=".35"/><path d="M46 60 L50 80 L56 70" fill="${c}" opacity=".7"/>`);
    case "sprig":
      return svg(`<path d="M20 90 C40 60 55 40 82 12" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/><g fill="${c}"><path d="M38 64c-14-2-22-12-22-22 12 0 22 8 22 22z"/><path d="M44 58c4-14 16-20 26-18-2 12-12 20-26 18z"/><path d="M56 40c-12-6-16-18-12-26 10 4 16 14 12 26z"/><path d="M64 34c6-12 18-14 26-10-4 10-14 14-26 10z"/></g>`);
    case "flower":
      return svg(`<g fill="${c}">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="50" cy="30" rx="12" ry="19" transform="rotate(${a} 50 50)" opacity=".75"/>`).join("")}<circle cx="50" cy="50" r="10"/></g>`);
    case "tree":
      return svg(`<rect x="45" y="58" width="10" height="34" rx="3" fill="${c}" opacity=".8"/><circle cx="50" cy="40" r="26" fill="${c}"/><circle cx="32" cy="52" r="15" fill="${c}" opacity=".75"/><circle cx="68" cy="52" r="15" fill="${c}" opacity=".75"/>`);
    case "hills":
      return svg(`<path d="M2 86 Q30 40 58 86z" fill="${c}" opacity=".7"/><path d="M34 86 Q66 28 98 86z" fill="${c}"/><circle cx="76" cy="22" r="9" fill="${c}" opacity=".6"/>`);
    case "rattle":
      return svg(`<circle cx="38" cy="38" r="24" fill="${c}"/><circle cx="38" cy="38" r="12" fill="#fff" opacity=".45"/><path d="M54 56 L84 86" stroke="${c}" stroke-width="9" stroke-linecap="round"/><circle cx="86" cy="88" r="7" fill="${c}"/>`);
    case "ball":
      return svg(`<circle cx="50" cy="50" r="36" fill="${c}"/><path d="M14 50h72M50 14c-16 20-16 52 0 72M50 14c16 20 16 52 0 72" fill="none" stroke="#fff" stroke-width="4" opacity=".55"/>`);
    case "blocks":
      return svg(`<rect x="10" y="52" width="36" height="36" rx="5" fill="${c}"/><rect x="52" y="52" width="36" height="36" rx="5" fill="${c}" opacity=".7"/><rect x="31" y="12" width="36" height="36" rx="5" fill="${c}" opacity=".85"/>`);
    case "kite":
      return svg(`<path d="M50 6 L80 40 L50 74 L20 40z" fill="${c}"/><path d="M50 6V74M20 40H80" stroke="#fff" stroke-width="3" opacity=".5"/><path d="M50 74 C42 82 58 86 48 96" fill="none" stroke="${c}" stroke-width="2.5"/>`);
    case "boat":
      return svg(`<path d="M14 62 H86 L72 82 H28z" fill="${c}"/><path d="M50 16 L50 58 L78 58z" fill="${c}" opacity=".7"/><path d="M48 24 L48 58 L26 58z" fill="${c}" opacity=".85"/>`);
    case "heart":
      return svg(`<path d="M50 88 C20 66 6 48 6 32 A22 22 0 0 1 50 22 A22 22 0 0 1 94 32 C94 48 80 66 50 88z" fill="${c}"/>`);
    case "confetti":
      return svg(`<g fill="${c}"><circle cx="12" cy="18" r="3"/><rect x="30" y="8" width="6" height="3" rx="1" transform="rotate(30 33 9)"/><circle cx="52" cy="22" r="2.5"/><rect x="70" y="12" width="7" height="3" rx="1" transform="rotate(-25 73 13)"/><circle cx="90" cy="26" r="3"/><rect x="20" y="40" width="6" height="3" rx="1" transform="rotate(-40 23 41)"/><circle cx="80" cy="48" r="2.5"/><circle cx="40" cy="44" r="2"/><rect x="60" y="36" width="6" height="3" rx="1" transform="rotate(50 63 37)"/></g>`);
    case "paw":
      return svg(`<g fill="${c}">${PAW}</g>`);
    case "bone":
      return svg(`<g fill="${c}" transform="rotate(-30 50 50)"><rect x="24" y="43" width="52" height="14" rx="7"/><circle cx="22" cy="42" r="10"/><circle cx="22" cy="58" r="10"/><circle cx="78" cy="42" r="10"/><circle cx="78" cy="58" r="10"/></g>`);
    case "feather":
      return svg(`<path d="M28 90 C18 60 30 22 70 8 C76 44 60 76 28 90z" fill="${c}"/><path d="M28 90 L66 14" stroke="#fff" stroke-width="2.5" opacity=".55"/><path d="M38 70 L54 66 M44 54 L60 48 M50 40 L64 34" stroke="#fff" stroke-width="2" opacity=".4"/>`);
    case "horseshoe":
      return svg(`<path d="M24 86 V46 a26 26 0 0 1 52 0 V86" fill="none" stroke="${c}" stroke-width="13" stroke-linecap="round"/><g fill="#fff" opacity=".6"><circle cx="24" cy="66" r="2.5"/><circle cx="24" cy="48" r="2.5"/><circle cx="76" cy="66" r="2.5"/><circle cx="76" cy="48" r="2.5"/></g>`);
    case "rosette":
      return svg(`<path d="M38 56 L28 94 L42 86 L46 98 L50 60z M62 56 L72 94 L58 86 L54 98 L50 60z" fill="${c}" opacity=".75"/><g fill="${c}">${Array.from({ length: 12 }, (_, k) => `<circle cx="50" cy="16" r="9" transform="rotate(${k * 30} 50 40)"/>`).join("")}</g><circle cx="50" cy="40" r="17" fill="${c}"/><circle cx="50" cy="40" r="10" fill="#fff" opacity=".45"/>`);
    case "leaf":
      return svg(`<path d="M14 86 C14 40 44 14 88 12 C88 58 60 86 14 86z" fill="${c}"/><path d="M14 86 C40 60 60 40 86 14" stroke="#fff" stroke-width="2.5" opacity=".5" fill="none"/>`);
    case "quote":
      return svg(`<path d="M12 62c0-20 10-34 28-40l3 7c-10 5-15 12-15 20h14v26H12zM56 62c0-20 10-34 28-40l3 7c-10 5-15 12-15 20h14v26H56z" fill="${c}"/>`);
    default:
      return "";
  }
}

/** The baby teeth along two arches, the ones that are through filled in. */
function mouthSvg(through: Set<string>, c: string): string {
  const teeth = TEETH.map((x) => {
    const a = Math.PI * (0.06 + (0.88 * x.slot) / 9);
    const cx = 100 - Math.cos(a) * 82;
    const cy = x.upper ? 58 - Math.sin(a) * 46 : 72 + Math.sin(a) * 46;
    const on = through.has(x.id);
    return `<rect x="${(cx - 7).toFixed(1)}" y="${(cy - 8).toFixed(1)}" width="14" height="16" rx="6" fill="${on ? c : "#fff"}" stroke="${c}" stroke-width="1.6" opacity="${on ? 1 : 0.6}"/>`;
  }).join("");
  return `<div class="mouth"><svg viewBox="0 0 200 130" xmlns="http://www.w3.org/2000/svg">${teeth}</svg></div>`;
}

const KIND_BADGE: Partial<Record<Memory["type"], { label: string; icon: string }>> = {
  first: { label: "First", icon: "star" },
  milestone: { label: "Milestone", icon: "star" },
  last: { label: "Last", icon: "heart" },
  story: { label: "Story", icon: "quote" },
};

export function buildBookHtml(i: BookHtmlInput): string {
  const { child, plan, defs, size } = i;
  const style = styleById(i.style); // a theme saved by an earlier version ("minimal", "storybook") still draws
  const M = bookMetrics(size);
  const look = STYLE_LOOK[style];
  const mode = i.mode ?? "print";
  const wide = size.wCm / size.hCm > 1.2;
  const tall = size.hCm / size.wCm > 1.2;
  const rels = i.relatives || [];
  const tagIndex = indexTags(i.tags || []);

  // colours: each age has its own (or one colour all through, if chosen); Modern stays black on white unless a colour is chosen
  // the kids' themes have their own colour (unless one is chosen); the others change colour with age
  const THEME_COLOUR: Partial<Record<BookStyle, BookColour>> = { stars: "lavender", blossom: "blush", explorer: "sky" };
  const colour: BookColour = i.colour && i.colour !== "age" ? i.colour : THEME_COLOUR[style] ?? "age";
  const drawings = style === "modern" ? null : THEME_MOTIFS[style];
  const bandOf = (p: BookPage): AgeBand => (colour !== "age" ? COLOUR_BAND[colour] : p.chapter ? p.chapter.band : "newborn");
  const ink = (p: BookPage) => (look.motifs || colour !== "age" ? BAND_LOOK[bandOf(p)].ink : look.accent);
  const wash = (p: BookPage) => (look.motifs ? BAND_LOOK[bandOf(p)].wash : "#f4f4f4");
  const fixed = (band: AgeBand) => BAND_LOOK[colour !== "age" ? COLOUR_BAND[colour] : band]; // the cover and the end page
  const accent = colour !== "age" ? BAND_LOOK[COLOUR_BAND[colour]].ink : look.accent;
  const drawingFor = (p: BookPage) => (drawings ? drawings[p.chapter ? p.chapter.band : "newborn"] : "");

  const img = (uri?: string) => {
    const s = uri ? i.image(uri) : null;
    return s ? `<img src="${esc(s)}"${mode === "print" ? "" : ` loading="lazy"`}/>` : "";
  };
  const people = (ids?: string[]) => {
    const labels = (ids || []).map((x) => labelOfTag(tagIndex.get(x), rels)).filter(Boolean);
    return labels.length ? `<p class="with">With ${labels.map(esc).join(", ")}</p>` : "";
  };
  // a sibling book says whose memory each one is; ages are always that child's own
  const kids = [child, ...(i.siblings ?? []).filter((k) => k.id !== child.id)].sort((a, b) => a.birth.localeCompare(b.birth));
  const multi = kids.length > 1;
  const kidOf = (m: Memory) => kids.find((k) => k.id === m.childId) ?? child;
  const ageOf = (m: Memory) => { const k = kidOf(m); return ageShort(k.birth, m.date); }; // before the birth: "Week 20 (banana)"
  const names = (list: Child[]) => (list.length <= 2 ? list.map((k) => k.name).join(" & ") : `${list.slice(0, -1).map((k) => k.name).join(", ")} & ${list[list.length - 1].name}`);
  const meta = (m: Memory) => [multi ? kidOf(m).name : "", formatSpan(m.date, m.endDate), m.time ? formatTime(m.time) : "", ageOf(m), m.location?.trim() ?? ""].filter(Boolean).map(esc).join(" · ");
  const badge = (m: Memory, color: string, birthday = 0) => {
    if (birthday) return `<span class="badge" style="background:${color}">${motif("star", "#fff")}${ordinal(birthday)} birthday</span>`;
    const b = KIND_BADGE[m.type];
    return b ? `<span class="badge" style="background:${color}">${motif(b.icon, "#fff")}${b.label}</span>` : "";
  };
  const caption = (m: Memory, color: string, lines: number, birthday = 0) => {
    const head = memoryHeading(m, defs);
    return `<div class="caption">${badge(m, color, birthday)}${head ? `<h3>${esc(head)}</h3>` : ""}<p class="meta">${meta(m)}</p>${m.description?.trim() ? `<p class="body" style="-webkit-line-clamp:${lines}">${esc(m.description.trim())}</p>` : ""}${people(m.tagIds)}</div>`;
  };
  const chapterHead = (p: BookPage) => (p.opens && p.chapter ? `<div class="chapter" style="color:${ink(p)}"><span>${esc(p.chapter.label)}</span>${drawings ? `<i class="mini">${motif(drawingFor(p), ink(p))}</i>` : ""}</div>` : "");
  const corner = (p: BookPage, name = drawingFor(p)) => (name ? `<div class="motif">${motif(name, ink(p))}</div>` : "");

  const photos = (list: string[]) => {
    if (list.length <= 1) return `<div class="photo single">${img(list[0])}</div>`;
    return `<div class="photo grid n${list.length}">${list.map((u) => `<div class="cell">${img(u)}</div>`).join("")}</div>`;
  };

  // a filled-in Classic: its words as a card of details and paragraphs, its pictures, and (for teeth) the mouth with the teeth that are through
  const classicPage = (e: ClassicEntry, p: BookPage, n: number): string => {
    const tpl = CLASSICS.find((c) => c.id === e.id);
    if (!tpl) return "";
    const facts: [string, string][] = [];
    const paras: [string, string][] = [];
    let extra = "";
    const pics: string[] = [];
    for (const f of tpl.fields) {
      const v = e.values[f.id]?.trim();
      if (f.kind === "photo" || f.kind === "photos") (e.photos[f.id] ?? []).forEach((x) => x.uri && pics.push(x.uri));
      else if (f.kind === "date" && v) facts.push([f.label, formatDate(v)]);
      else if (f.kind === "time" && v) facts.push([f.label, formatTime(v)]);
      else if ((f.kind === "text" || f.kind === "choice") && v) facts.push([f.label, v]);
      else if (f.kind === "list" && v) paras.push([f.label, listItems(v).join(" · ")]);
      else if (f.kind === "long" && v) paras.push([f.label, v]);
      else if (f.kind === "teeth" || f.kind === "checklist") {
        const items = datedItems(e, f);
        if (f.kind === "teeth") extra += mouthSvg(new Set(items.map((x) => x.id)), ink(p));
        if (items.length && f.kind === "teeth") extra += `<div class="teeth">${items.map((x) => `<div><span>${esc(x.label.replace(/^./, (c) => c.toUpperCase()))}</span><b>${esc(formatDate(x.date))}</b></div>`).join("")}</div>`;
        else if (items.length) extra += `<div class="rows">${items.map((x) => `<div class="row"><span class="what">${esc(x.label.replace(/^./, (c) => c.toUpperCase()))}</span><span class="dots"></span><span class="when">${esc(ageShort(child.birth, x.date))}</span><span class="date">${esc(formatDate(x.date))}</span></div>`).join("")}</div>`;
      }
    }
    const grid = e.id === "grid";
    const shownPics = grid ? pics.slice(0, 12) : pics.slice(0, 4);
    const picHtml = !shownPics.length ? "" : grid
      ? `<div class="monthly">${tpl.fields.map((f) => { const u = e.photos[f.id]?.find((x) => x.uri)?.uri; return `<div class="month">${u ? img(u) : ""}<span>${esc(f.label)}</span></div>`; }).join("")}</div>`
      : photos(shownPics);
    return `<section class="page classic${shownPics.length ? " has-photo" : ""}">
      ${corner(p, drawings ? drawings.family : "")}
      <p class="kicker" style="color:${ink(p)}">Keepsake</p>
      <h2>${esc(tpl.title)}</h2>
      ${facts.length ? `<div class="facts">${facts.map(([k, v]) => `<div class="fact"><span class="k" style="color:${ink(p)}">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join("")}</div>` : ""}
      ${extra}
      ${paras.map(([k, v]) => `<h3>${esc(k)}</h3><p class="body" style="-webkit-line-clamp:${shownPics.length ? 3 : 8}">${esc(v)}</p>`).join("")}
      ${picHtml}
      ${numbered(n)}
    </section>`;
  };

  // page numbers run from the first page after the cover, like a printed book
  const numbered = (n: number) => `<div class="folio"><span></span><span>${n}</span></div>`;

  const page = (p: BookPage, n: number): string => {
    const folio = (label?: string) => `<div class="folio"><span>${label ? esc(label) : ""}</span><span>${n}</span></div>`;
    const running = p.chapter ? folio(p.chapter.label) : numbered(n);
    switch (p.kind) {
      case "cover": {
        const title = i.title || (multi ? `${names(kids)}: Our Story` : child.expecting ? `Waiting for ${child.name}` : bookName(child, todayISO()));
        const pic = p.photo ? i.image(p.photo) : null;
        return `<section class="page cover" style="background-color:${look.motifs ? fixed("newborn").wash : look.paper}">
          ${drawings ? `<div class="motif big tl">${motif(drawings.cover, fixed("newborn").ink)}</div><div class="motif tr">${motif(drawings.cover2, fixed("late").ink)}</div>` : ""}
          <div class="cover-frame">${pic ? `<img src="${esc(pic)}"/>` : `<div class="monogram">${esc(initialsOf(child.name))}</div>`}</div>
          <h1 style="color:${accent}">${esc(title)}</h1>
          <p class="subtitle">${esc(i.subtitle || (multi ? kids.map((k) => `${k.name}, born ${formatDate(k.birth)}`).join(" · ") : child.expecting ? `Due ${formatDate(child.birth)}` : isPet(child) ? `Came home ${formatDate(child.gotchaDay ?? child.birth)}` : `Born ${formatDate(child.birth)}`))}</p>
          <p class="brand">${esc(APP_NAME)}</p>
        </section>`;
      }
      case "birth": {
        const born = kids.find((k) => k.id === p.childId) ?? child;
        const d = p.details;
        const day = parseISO(d.date);
        const rows: [string, string][] = [
          ["Born", `${WEEKDAYS[day.getDay()]}, ${formatDate(d.date)}`],
          ...(d.time ? [["Time", formatTime(d.time)] as [string, string]] : []),
          ...(d.place ? [["Place", d.place] as [string, string]] : []),
          ...(d.weightText ? [["Weight", d.weightText] as [string, string]] : d.weightKg ? [["Weight", formatWeight(d.weightKg, i.weightUnit ?? "kg")] as [string, string]] : []),
          ...(d.lengthText ? [["Length", d.lengthText] as [string, string]] : d.heightCm ? [["Length", formatHeight(d.heightCm, i.heightUnit ?? "cm")] as [string, string]] : []),
          ...(d.type ? [["Birth", d.type] as [string, string]] : []),
          ...(d.labour ? [["Labour", d.labour] as [string, string]] : []),
          ...(d.who ? [["Who was there", d.who] as [string, string]] : []),
        ];
        const photoUri = p.photoUri;
        const story = p.storyText;
        return `<section class="page birth${photoUri ? " has-photo" : ""}" style="background-color:${wash(p)}">
          ${corner(p, drawings ? drawings.newborn : "")}
          ${photoUri ? `<div class="photo single arch">${img(photoUri)}</div>` : ""}
          <div class="birth-text">
            <p class="kicker" style="color:${ink(p)}">Hello, world</p>
            <h2>The day ${esc(born.name)} was born</h2>
            <div class="facts">${rows.map(([k, v]) => `<div class="fact"><span class="k" style="color:${ink(p)}">${k}</span><span class="v">${esc(v)}</span></div>`).join("")}</div>
            ${p.story?.title?.trim() ? `<h3>${esc(p.story.title.trim())}</h3>` : ""}
            ${story ? `<p class="body" style="-webkit-line-clamp:${photoUri ? 3 : 10}">${esc(story)}</p>` : ""}
          </div>
          ${numbered(n)}
        </section>`;
      }
      case "classic":
        return classicPage(p.entry, p, n);
      case "family": {
        if (p.tree) {
          const rows = familyRows(p.people);
          const face = (r: Relative, big = false) => {
            const pic = r.photoUri ? i.image(r.photoUri) : null;
            return `<div class="node${big ? " me" : ""}"><div class="face" style="background:${wash(p)};color:${ink(p)};border-color:${big ? accent : "#fff"}">${pic ? `<img src="${esc(pic)}"/>` : esc(initialsOf(r.name || displayName(r)))}</div><b>${esc(displayName(r))}</b><span>${esc(relationLine(r))}</span></div>`;
          };
          // the child in the middle of their own row, with their brothers, sisters, cousins and pets around them
          const coverPhoto = plan.pages[0]?.kind === "cover" ? plan.pages[0].photo : undefined;
          const me = { id: child.id, name: child.name, relation: "That's me!", ...(coverPhoto ? { photoUri: coverPhoto } : {}) } as Relative;
          const half = Math.ceil(rows.same.length / 2);
          const same = [...rows.same.slice(0, half).map((r) => face(r)), face(me, true), ...rows.same.slice(half).map((r) => face(r))];
          const row = (nodes: string[], cls: string) => (nodes.length ? `<div class="gen ${cls}"><div class="nodes${nodes.length > 1 ? " linked" : ""}${nodes.length > 5 ? " many" : ""}">${nodes.join("")}</div></div>` : "");
          const parts = [row(rows.grand.map((r) => face(r)), "grand"), row(rows.parent.map((r) => face(r)), "parent"), row(same, "same")].filter(Boolean);
          return `<section class="page family tree-page tree-${style}">
            ${corner(p, drawings ? drawings.family : "")}
            <p class="kicker" style="color:${ink(p)}">Your family tree</p>
            <h2>${esc(FAMILY_TITLES[style])}</h2>
            <div class="tree" style="--line:${ink(p)}">${parts.join('<div class="stem"></div>')}</div>
            ${rows.other.length ? `<p class="others-label" style="color:${ink(p)}">And everyone else who loves you</p><div class="gen other"><div class="nodes">${rows.other.map((r) => face(r)).join("")}</div></div>` : ""}
            ${numbered(n)}
          </section>`;
        }
        return `<section class="page family">
          ${corner(p, drawings ? drawings.family : "")}
          <p class="kicker" style="color:${ink(p)}">Your family</p>
          <h2>${esc(FAMILY_TITLES[style])}</h2>
          <div class="people">${p.people.map((r) => {
            const pic = r.photoUri ? i.image(r.photoUri) : null;
            return `<div class="person"><div class="face" style="background:${wash(p)};color:${ink(p)}">${pic ? `<img src="${esc(pic)}"/>` : esc(initialsOf(r.name || displayName(r)))}</div>
              <div class="who"><h3>${esc(displayName(r))}</h3><p class="meta">${esc(relationLine(r))}</p>${r.description?.trim() ? `<p class="body" style="-webkit-line-clamp:2">${esc(r.description.trim())}</p>` : ""}</div></div>`;
          }).join("")}</div>
          ${numbered(n)}
        </section>`;
      }
      case "year": {
        return `<section class="page year" style="background-color:${wash(p)}">
          ${drawings ? `<div class="motif big tr">${motif(drawings.year, ink(p))}</div><div class="motif confetti">${motif("confetti", ink(p))}</div>` : ""}
          <p class="kicker" style="color:${ink(p)}">${p.year === 1 ? "Happy first birthday" : `Happy ${ordinal(p.year)} birthday`}</p>
          <div class="numeral" style="color:${ink(p)}">${p.year}</div>
          <h2>${yearTitle(p.year)}</h2>
          <p class="subtitle">From ${p.year} to ${p.year + 1} years old</p>
          ${running}
        </section>`;
      }
      case "picture": {
        const m = p.memory;
        const color = p.birthday ? ink(p) : m.type === "last" ? "#8b84a8" : ink(p);
        const themed = p.birthday ? " birthday" : m.type === "first" || m.type === "milestone" ? " first" : m.type === "story" ? " story" : "";
        return `<section class="page picture${themed}${wide ? " wide" : ""}" style="color:${look.ink};--ring:${ink(p)}">
          ${p.birthday && drawings ? `<div class="motif confetti">${motif("confetti", ink(p))}</div>` : ""}
          ${chapterHead(p)}
          <div class="spread${p.notes ? " with-notes" : ""}">${photos(p.photos)}<div class="words">${caption(m, color, p.notes ? 2 : wide ? 8 : tall ? 5 : 3, p.birthday)}${p.notes ? `<div class="cards mini">${p.notes.map((x) => `<div class="card" style="border-color:${ink(p)}">${caption(x, ink(p), 2)}</div>`).join("")}</div>` : ""}</div></div>
          ${running}
        </section>`;
      }
      case "pictures": {
        // two to four moments sharing a page, each with its picture and a short caption
        const n2 = p.items.length;
        return `<section class="page pictures n${n2}${wide ? " wide" : ""}" style="color:${look.ink}">
          ${chapterHead(p)}
          <div class="moments">${p.items.map((it) => `<div class="moment"><div class="photo single">${img(it.photo)}</div>${caption(it.memory, ink(p), n2 > 2 ? 1 : 3)}</div>`).join("")}</div>
          ${running}
        </section>`;
      }
      case "together": {
        // the pictures with a brother, a sister or a pet, laid out like the shared-moment pages, under "With Rex"
        const n2 = p.items.length;
        return `<section class="page pictures together n${n2}${wide ? " wide" : ""}" style="color:${look.ink}">
          <p class="kicker" style="color:${accent}">${p.part ? "More moments together" : "Together"}</p>
          <h2>With ${esc(p.who.name)}</h2>
          <div class="moments">${p.items.map((it) => `<div class="moment"><div class="photo single">${img(it.photo)}</div>${caption(it.memory, ink(p), 1)}</div>`).join("")}</div>
          ${numbered(n)}
        </section>`;
      }
      case "birthStory": {
        const who = (kids.find((k) => k.id === p.childId) ?? child).name;
        return `<section class="page classic birth-story">
          ${corner(p, drawings ? drawings.newborn : "")}
          <p class="kicker" style="color:${ink(p)}">The day ${esc(who)} was born</p>
          <h2>${p.part ? "The story, continued" : "Our birth story"}</h2>
          ${p.parts.map((x) => `<h3>${esc(x.label)}</h3><p class="body">${esc(x.text)}</p>`).join("")}
          ${numbered(n)}
        </section>`;
      }
      case "story": {
        const m = p.memory;
        return `<section class="page story-page">
          ${chapterHead(p)}
          <div class="quote">${motif("quote", ink(p))}</div>
          ${caption(m, ink(p), tall ? 22 : wide ? 12 : 16)}
          ${running}
        </section>`;
      }
      case "notes": {
        return `<section class="page notes n${p.memories.length}">
          ${p.opens ? "" : corner(p)}
          ${chapterHead(p)}
          ${p.opens ? "" : `<p class="kicker" style="color:${ink(p)}">Little moments</p>`}
          <div class="cards">${p.memories.map((m) => `<div class="card" style="border-color:${m.type === "last" ? "#8b84a8" : ink(p)}">${caption(m, m.type === "last" ? "#8b84a8" : ink(p), 4, 0)}</div>`).join("")}</div>
          ${running}
        </section>`;
      }
      case "firsts": {
        return `<section class="page firsts">
          ${corner(p, drawings ? "star" : "")}
          <p class="kicker" style="color:${accent}">Looking back</p>
          <h2>${p.part ? "Your firsts, continued" : "Your firsts"}</h2>
          <div class="rows">${p.memories.map((m) => `<div class="row"><span class="what">${esc(memoryHeading(m, defs) || "A first")}</span><span class="dots"></span><span class="when">${esc(multi ? `${kidOf(m).name}, ${ageOf(m)}` : ageOf(m))}</span><span class="date">${esc(formatDate(m.date))}</span></div>`).join("")}</div>
          ${numbered(n)}
        </section>`;
      }
      case "cameHome": {
        const v = p.entry?.values ?? {};
        const photos = (p.entry?.photos.photos ?? []).map((x) => x.uri).filter(Boolean).slice(0, 1);
        const pin = v.lat && v.lon ? onMap(Number(v.lat), Number(v.lon)) : null;
        const facts: [string, string][] = [["The day", formatDate(v.date || child.gotchaDay || child.birth)], ...(v.from ? [["From", v.from] as [string, string]] : []), ...(v.place ? [["Where", v.place] as [string, string]] : []), ...(v.address && v.address !== v.place ? [["", v.address] as [string, string]] : [])];
        return `<section class="page birth${photos.length ? " has-photo" : ""}" style="background-color:${wash(p)}">
          ${corner(p, drawings ? drawings.cover : "")}
          ${photos.length ? `<div class="photo single arch">${img(photos[0])}</div>` : ""}
          <div class="birth-text">
            <p class="kicker" style="color:${ink(p)}">Welcome home</p>
            <h2>The day ${esc(child.name)} came home</h2>
            <div class="facts">${facts.map(([k, val]) => `<div class="fact"><span class="k" style="color:${ink(p)}">${esc(k)}</span><span class="v">${esc(val)}</span></div>`).join("")}</div>
            ${v.story?.trim() ? `<p class="body" style="-webkit-line-clamp:${photos.length ? 3 : 8}">${esc(v.story.trim())}</p>` : ""}
            ${p.mapUri && pin && !photos.length ? `<div class="worldmap mini">${img(p.mapUri)}<span class="pin" style="left:${(pin.x * 100).toFixed(2)}%;top:${(pin.y * 100).toFixed(2)}%;background:${ink(p)}"></span></div>` : ""}
          </div>
          ${numbered(n)}
        </section>`;
      }
      case "places": {
        const years = placesByYear(p.places);
        return `<section class="page places">
          ${corner(p, drawings ? drawings.cover2 : "")}
          <p class="kicker" style="color:${ink(p)}">Adventures</p>
          <h2>Everywhere ${esc(child.name)} has been</h2>
          ${p.mapUri ? `<div class="worldmap">${img(p.mapUri)}${p.places.map((pl) => { const q = onMap(pl.lat, pl.lon); return `<span class="pin" style="left:${(q.x * 100).toFixed(2)}%;top:${(q.y * 100).toFixed(2)}%;background:${accent}"></span>`; }).join("")}</div>` : ""}
          <p class="meta">${esc(placesSummary(p.places))}</p>
          <div class="years">${years.map((y) => `<div class="year-row"><b style="color:${ink(p)}">${esc(y.year)}</b><span>${esc(y.places.map((pl) => pl.name).join(" · "))}</span></div>`).join("")}</div>
          ${numbered(n)}
        </section>`;
      }
      case "memorial": {
        return `<section class="page memorial" style="background-color:${look.motifs ? fixed("kid").wash : look.paper}">
          <div class="motif big">${motif("rainbow", accent)}</div>
          <p class="kicker" style="color:${accent}">In loving memory</p>
          <h2>${esc(child.name)}</h2>
          <p class="subtitle">${esc(p.dates)}</p>
          ${p.words.trim() ? `<p class="body">${esc(p.words.trim())}</p>` : ""}
        </section>`;
      }
      case "end": {
        const now = todayISO();
        const sm = smartAge(child.birth, now);
        const weeksToGo = Math.max(0, Math.ceil(daysBetween(now, child.birth) / 7));
        const all = plan.pages;
        const count = (k: Memory["type"][]) => new Set(all.flatMap((q) => (q.kind === "picture" ? [q.memory, ...(q.notes ?? [])] : q.kind === "story" ? [q.memory] : q.kind === "pictures" ? q.items.map((x) => x.memory) : q.kind === "notes" ? q.memories : [])).filter((m) => k.includes(m.type)).map((m) => m.id)).size;
        const stats = [
          [plan.pictures, plan.pictures === 1 ? "photo" : "photos"],
          [count(["first", "milestone"]), "firsts and milestones"],
          [count(["story"]), count(["story"]) === 1 ? "story" : "stories"],
        ].filter(([v]) => (v as number) > 0);
        return `<section class="page end" style="background-color:${look.motifs ? fixed("kid").wash : look.paper}">
          ${drawings ? `<div class="motif tr">${motif("heart", fixed("newborn").ink)}</div>` : ""}
          <p class="kicker" style="color:${accent}">And the story goes on</p>
          ${multi
            ? `<h2>${esc(names(kids))} today</h2><div class="ages">${kids.map((k) => `<div><b>${esc(k.expecting ? "Due" : smartAge(k.birth, now).value)}</b><span>${esc(k.name)}, ${esc(k.expecting ? formatDate(k.birth) : smartAge(k.birth, now).unit)}</span></div>`).join("")}</div>`
            : child.expecting
              ? `<h2>Not long now, ${esc(child.name)}</h2><div class="numeral" style="color:${accent}">${weeksToGo}</div><p class="subtitle">${weeksToGo === 1 ? "week" : "weeks"} to go · due ${esc(formatDate(child.birth))}</p>`
              : isPet(child)
                ? `<h2>${esc(child.name)} today</h2><p class="subtitle">${esc(petAge(child, now).human)} · ${esc(petAge(child, now).own ?? petAge(child, now).stage)}</p>`
                : `<h2>${esc(child.name)} today</h2><div class="numeral" style="color:${accent}">${esc(sm.value)}</div><p class="subtitle">${esc(sm.unit)} · ${esc(ageLong(child.birth, now))}</p>`}
          ${stats.length ? `<div class="stats">${stats.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("")}</div>` : ""}
          <p class="brand">Made with love on ${esc(formatDate(now))} · ${esc(APP_NAME)}</p>
        </section>`;
      }
    }
  };

  const pt = (x: number) => `${x.toFixed(2)}pt`;
  const U = (k: number) => pt(k * M.u);
  const bg = THEME_BACKGROUND[style];
  const frame = look.frame ? `border:${U(look.frame)} solid #fff;box-shadow:0 ${U(0.5)} ${U(1.6)} rgba(60,40,30,.18);` : "";
  const css = `
@page{size:${pt(M.w)} ${pt(M.h)};margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:${look.bodyCss};color:${look.ink};-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1,h2,h3,.numeral,.kicker{font-family:${look.fontCss};margin:0}
.page{position:relative;width:${pt(M.w)};height:${pt(M.h)};padding:${pt(M.margin)} ${pt(M.margin)} ${U(10)};overflow:hidden;display:flex;flex-direction:column;background:${look.paper};page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
${bg ? `.page{background-image:${bg.pattern};background-size:${U(bg.tile)} ${U(bg.tile)};background-repeat:repeat}` : ""}
${bg?.frame ? `.page:before{content:"";position:absolute;inset:${U(2.6)};border:${bg.frame.replace(/^(\d+)px/, (_m, w) => U(Number(w) * 0.35))};border-radius:${U(3)};pointer-events:none}` : ""}
.motif{position:absolute;top:${U(3)};right:${U(3)};width:${U(13)};height:${U(13)};opacity:.32;pointer-events:none}
.motif svg{width:100%;height:100%;display:block}
.motif.big{width:${U(26)};height:${U(26)};opacity:.22}
.motif.tl{top:${U(4)};left:${U(4)};right:auto}.motif.tr{top:${U(5)};right:${U(5)}}.motif.br{top:auto;bottom:${U(5)};right:${U(5)}}
.motif.confetti{top:0;left:0;right:0;width:100%;height:${U(40)};opacity:.45}
.folio{position:absolute;left:${pt(M.margin)};right:${pt(M.margin)};bottom:${U(3.6)};display:flex;justify-content:space-between;font-size:${pt(M.small)};color:${look.sub};letter-spacing:.06em;text-transform:uppercase}
.kicker{font-size:${pt(M.meta)};letter-spacing:.14em;text-transform:uppercase;font-weight:700;margin-bottom:${U(1.2)}}
h1{font-size:${pt(M.title * 1.05)};line-height:1.15;color:${look.accent};font-weight:600;text-align:center}
h2{font-size:${pt(M.title * 0.78)};line-height:1.2;color:${look.ink};font-weight:600;margin-bottom:${U(3)}}
h3{font-size:${pt(M.label)};line-height:1.25;color:${look.ink};font-weight:700;margin:${U(0.8)} 0 0}
.meta{font-size:${pt(M.meta)};margin:${U(0.7)} 0 0;color:${look.sub}}
.body{font-size:${pt(M.body)};line-height:1.45;margin:${U(1.4)} 0 0;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-line}
.with{font-size:${pt(M.small)};margin:${U(1.2)} 0 0;color:${look.sub};font-style:italic}
.subtitle{font-size:${pt(M.meta * 1.15)};color:${look.sub};margin:${U(1.2)} 0 0;text-align:center}
.brand{position:absolute;left:0;right:0;bottom:${U(4.5)};text-align:center;font-size:${pt(M.small)};letter-spacing:.18em;text-transform:uppercase;color:${look.sub}}
.badge{display:inline-flex;align-items:center;gap:${U(0.8)};color:#fff;font-size:${pt(M.small)};font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:${U(0.6)} ${U(1.8)};border-radius:${U(3)}}
.badge svg{width:${U(2.4)};height:${U(2.4)}}
.chapter{display:flex;align-items:center;gap:${U(2)};font-family:${look.fontCss};font-size:${pt(M.label * 1.15)};font-weight:700;margin-bottom:${U(2.4)}}
.chapter:after{content:"";flex:1;height:${U(0.3)};background:currentColor;opacity:.35;order:1}
.chapter .mini{order:2;width:${U(7)};height:${U(7)};opacity:.45;flex:none}
.chapter .mini svg{width:100%;height:100%;display:block}

/* photos: one framed photo shown whole, or a collage of up to four */
.photo{flex:1;min-height:0;min-width:0;display:flex;align-items:center;justify-content:center}
.photo.single img{max-width:100%;max-height:100%;object-fit:contain;border-radius:${U(look.radius)};${frame}}
.photo.grid{display:grid;gap:${U(1.6)};align-items:stretch;justify-content:stretch;align-self:stretch;width:100%;grid-auto-rows:minmax(0,1fr)}
.photo.grid .cell{min-height:0;min-width:0;overflow:hidden;border-radius:${U(look.radius)};${frame}}
.photo.grid img{width:100%;height:100%;object-fit:cover;display:block}
.photo.n2{grid-template-columns:1fr 1fr}
.photo.n3{grid-template-columns:1.4fr 1fr;grid-template-rows:minmax(0,1fr) minmax(0,1fr)}.photo.n3 .cell:first-child{grid-row:span 2}
.photo.n4{grid-template-columns:1fr 1fr;grid-template-rows:minmax(0,1fr) minmax(0,1fr)}
.photo.arch img{border-radius:${U(30)} ${U(30)} ${U(look.radius + 1)} ${U(look.radius + 1)}}

/* the cover */
.cover{align-items:center;justify-content:center;text-align:center;padding-bottom:${U(12)}}
.cover-frame{width:${U(tall ? 62 : 52)};height:${U(tall ? 62 : 52)};border-radius:50%;overflow:hidden;border:${U(1.6)} solid #fff;box-shadow:0 ${U(0.8)} ${U(3)} rgba(60,40,30,.2);margin-bottom:${U(5)};background:#fff;display:flex;align-items:center;justify-content:center}
.cover-frame img{width:100%;height:100%;object-fit:cover}
.monogram{font-family:${look.fontCss};font-size:${U(20)};color:${look.accent}}

/* the day they were born */
.birth{gap:${U(3)}}
.birth.has-photo .photo{flex:1.1}
.birth:not(.has-photo){justify-content:center}
.birth-text{flex:none}
.worldmap{position:relative;width:100%;margin-top:${U(2)};border-radius:${U(1.6)};overflow:hidden;line-height:0}
.worldmap img{width:100%;display:block}
.worldmap.mini{width:70%}
.worldmap .pin{position:absolute;width:${U(2.2)};height:${U(2.2)};margin:-${U(1.1)} 0 0 -${U(1.1)};border-radius:50%;border:${U(0.4)} solid #fff;box-shadow:0 0 ${U(0.6)} rgba(0,0,0,.25)}
.places .years{margin-top:${U(1.6)};display:flex;flex-direction:column;gap:${U(0.8)}}
.places .year-row{display:flex;gap:${U(2)};font-size:${pt(M.small)}}
.places .year-row b{min-width:${U(7)}}
.memorial{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.memorial .motif.big{position:static;width:${U(22)};height:${U(14)};margin-bottom:${U(2)}}
.memorial h2{margin-top:${U(1)}}
.memorial .body{-webkit-line-clamp:8;max-width:80%;margin-top:${U(2)}}
.facts{display:grid;grid-template-columns:repeat(${tall ? 2 : 3},1fr);gap:${U(1.4)} ${U(3)};margin-top:${U(1)}}
.fact{display:flex;flex-direction:column;background:rgba(255,255,255,.7);border-radius:${U(1.6)};padding:${U(1.2)} ${U(1.8)}}
.fact .k{font-size:${pt(M.small)};line-height:1.3;letter-spacing:.1em;text-transform:uppercase;font-weight:700}
.fact .v{font-size:${pt(M.body)};margin-top:${U(0.3)}}

/* the family */
.tree{display:flex;flex-direction:column;align-items:stretch;margin-top:${U(1.5)}}
.tree .stem{width:0;height:${U(2.6)};border-left:${U(0.35)} solid var(--line);margin:0 auto;opacity:.55}
.gen .nodes{display:flex;flex-wrap:wrap;justify-content:center;gap:${U(1.6)} ${U(2.4)};position:relative;padding-top:${U(2.2)}}
.tree .gen:first-child .nodes{padding-top:0}
.gen .nodes.linked::before{content:"";position:absolute;top:0;left:14%;right:14%;border-top:${U(0.35)} solid var(--line);opacity:.55}
.tree .gen:first-child .nodes.linked::before{display:none}
.gen .nodes.linked .node::before{content:"";position:absolute;top:-${U(2.2)};left:50%;height:${U(2.2)};border-left:${U(0.35)} solid var(--line);opacity:.55}
.tree .gen:first-child .nodes.linked .node::before{display:none}
.node{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;width:${U(16)}}
.node .face{width:${U(12.5)};height:${U(12.5)};font-size:${U(5)}}
.nodes.many .node{width:${U(13)}}
.nodes.many .node .face{width:${U(10)};height:${U(10)};font-size:${U(4)}}
.node.me .face{width:${U(16)};height:${U(16)};border-width:${U(1)};font-size:${U(6.5)}}
.node b{font-size:${pt(M.small * 1.05)};margin-top:${U(0.8)};line-height:1.15}
.node span{font-size:${pt(M.small * 0.85)};opacity:.7;line-height:1.15}
.others-label{text-align:center;font-size:${pt(M.small)};font-weight:700;margin:${U(3)} 0 0}
.gen.other .nodes{padding-top:${U(1.2)}}
.tree-nature .node .face,.tree-leafscale .node .face{border-radius:60% 0 60% 0}
.tree-playful .node .face,.tree-paws .node .face{border-radius:28%}
.tree-blossom .tree .stem,.tree-blossom .gen .nodes.linked::before,.tree-blossom .gen .nodes.linked .node::before,.tree-paws .tree .stem,.tree-paws .gen .nodes.linked::before,.tree-paws .gen .nodes.linked .node::before{border-style:dotted}
.tree-explorer .tree .stem,.tree-explorer .gen .nodes.linked::before,.tree-explorer .gen .nodes.linked .node::before,.tree-feathers .tree .stem,.tree-feathers .gen .nodes.linked::before,.tree-feathers .gen .nodes.linked .node::before{border-style:dashed}
.tree-modern .node .face{box-shadow:none;border:${U(0.3)} solid #222}
.people{display:grid;grid-template-columns:repeat(${size.notesPerPage <= 2 || tall ? 2 : 3},1fr);gap:${U(3.2)} ${U(3)};align-content:start}
.person{display:flex;flex-direction:column;align-items:center;text-align:center}
.face{width:${U(15)};height:${U(15)};border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;font-family:${look.fontCss};font-size:${U(6)};font-weight:700;border:${U(0.8)} solid #fff;box-shadow:0 ${U(0.3)} ${U(1)} rgba(60,40,30,.15)}
.face img{width:100%;height:100%;object-fit:cover}
.who .body{-webkit-line-clamp:2;font-size:${pt(M.small)}}

/* a new year of life */
.year,.end{align-items:center;justify-content:center;text-align:center}
.numeral{font-size:${U(34)};line-height:1;font-weight:700;margin:${U(1)} 0 ${U(2)}}
.end .numeral{font-size:${U(24)}}
.stats{display:flex;gap:${U(5)};margin-top:${U(5)}}
.ages{display:flex;gap:${U(6)};margin-top:${U(3)};flex-wrap:wrap;justify-content:center}
.ages div{display:flex;flex-direction:column;align-items:center}
.ages b{font-family:${look.fontCss};font-size:${U(14)};line-height:1;color:${accent}}
.ages span{font-size:${pt(M.small)};color:${look.sub};margin-top:${U(1)}}
.stats div{display:flex;flex-direction:column;align-items:center}
.stats b{font-family:${look.fontCss};font-size:${pt(M.title * 0.7)};color:${look.accent}}
.stats span{font-size:${pt(M.small)};color:${look.sub};text-transform:uppercase;letter-spacing:.08em;margin-top:${U(0.6)}}

/* a picture and its caption: stacked, or side by side on a landscape page */
.spread{flex:1;min-height:0;display:flex;flex-direction:column;gap:${U(2.6)}}
.picture.wide .spread{flex-direction:row;align-items:center}
.picture.wide .photo{flex:1.7;height:100%}
.picture.wide .caption{flex:1}
.caption{flex:none}
.picture:not(.wide) .photo.single{align-items:flex-end}
.picture.first .photo.single img{outline:${U(0.4)} solid var(--ring);outline-offset:${U(1)}}
.picture.birthday .caption h3{font-size:${pt(M.label * 1.25)}}

/* a picture with a few short notes under it */
.spread .words{flex:none;display:flex;flex-direction:column;gap:${U(2)}}
.picture.wide .spread .words{flex:1}
.spread.with-notes .photo{flex:1.4}
.cards.mini{gap:${U(1.6)}}
.cards.mini h3{font-size:${pt(M.label * 0.9)}}
.cards.mini .body{font-size:${pt(M.small * 1.1)}}

/* two to four moments on a page */
.moments{flex:1;min-height:0;display:grid;gap:${U(3)}}
.moment{display:flex;flex-direction:column;gap:${U(1.4)};min-height:0;min-width:0}
.moment .photo{flex:1;min-height:0}
.moment .caption h3{font-size:${pt(M.label * 0.95)}}
.moment .caption .body{font-size:${pt(M.body * 0.92)}}
.together h2{margin-bottom:${U(2)}}
.pictures.n2 .moments{grid-template-rows:minmax(0,1fr) minmax(0,1fr)}
.pictures.n2 .moment{flex-direction:row;align-items:center;gap:${U(3)}}
.pictures.n2 .moment .photo{flex:1.25;height:100%}
.pictures.n2 .moment .caption{flex:1}
.pictures.n2:nth-of-type(even) .moment:nth-child(2){flex-direction:row-reverse}
.pictures.n2.wide .moments{grid-template-rows:none;grid-template-columns:1fr 1fr}
.pictures.n2.wide .moment{flex-direction:column;align-items:stretch}
.pictures.n2.wide .moment .photo{height:auto}
.pictures.n3 .moments{grid-template-columns:1fr 1fr;grid-template-rows:minmax(0,1.2fr) minmax(0,1fr)}
.pictures.n3 .moment:first-child{grid-column:span 2;flex-direction:row;align-items:center;gap:${U(3)}}
.pictures.n3 .moment:first-child .photo{flex:1.4;height:100%}
.pictures.n3 .moment:first-child .caption{flex:1}
.pictures.n3.wide .moments{grid-template-columns:1fr 1fr 1fr;grid-template-rows:minmax(0,1fr)}
.pictures.n3.wide .moment:first-child{grid-column:auto;flex-direction:column;align-items:stretch}
.pictures.n4 .moments{grid-template-columns:1fr 1fr;grid-template-rows:minmax(0,1fr) minmax(0,1fr)}

/* a story, given a page of its own */
.story-page .quote{width:${U(12)};height:${U(12)};opacity:.5;margin-bottom:${U(1)}}
.story-page .body{font-family:${look.fontCss};font-size:${pt(M.body * 1.12)};line-height:1.55}

/* memories without a picture */
.cards{display:flex;flex-direction:column;gap:${U(2.6)}}
.notes.n1 .cards,.notes.n2 .cards{flex:1;justify-content:center;gap:${U(6)}}
.notes.n1 .card h3{font-size:${pt(M.label * 1.35)}}
.notes.n1 .card .body{font-size:${pt(M.body * 1.2)}}
.card{border-left:${U(0.8)} solid;padding:${U(0.4)} 0 ${U(0.4)} ${U(2.6)}}

/* a Classic */
.classic h2{margin-bottom:${U(2)}}
.classic .facts{margin-bottom:${U(2)}}
.classic .photo{margin-top:${U(2)}}
.mouth{width:${U(46)};margin:${U(1)} auto ${U(2)}}
.mouth svg{width:100%;display:block}
.teeth{display:grid;grid-template-columns:1fr 1fr;gap:${U(0.6)} ${U(3)};font-size:${pt(M.small)}}
.teeth div{display:flex;justify-content:space-between;gap:${U(1)};border-bottom:${U(0.2)} dotted ${look.sub}}
.teeth b{font-weight:400;color:${look.sub};white-space:nowrap}
.monthly{flex:1;min-height:0;display:grid;grid-template-columns:repeat(${wide ? 6 : 4},1fr);grid-auto-rows:minmax(0,1fr);gap:${U(1.4)};margin-top:${U(2)}}
.month{position:relative;overflow:hidden;border-radius:${U(look.radius)};background:${look.motifs ? "rgba(0,0,0,.04)" : "#f2f2f2"}}
.month img{width:100%;height:100%;object-fit:cover;display:block}
.month span{position:absolute;left:${U(1)};bottom:${U(0.8)};font-size:${pt(M.small)};color:#fff;text-shadow:0 0 ${U(0.6)} rgba(0,0,0,.6)}

/* every first, looking back */
.rows{display:flex;flex-direction:column;gap:${U(1.5)}}
.row{display:flex;align-items:baseline;gap:${U(1.4)};font-size:${pt(M.body)}}
.row .what{font-weight:700}
.row .dots{flex:1;border-bottom:${U(0.3)} dotted ${look.sub};opacity:.6;transform:translateY(-${U(0.6)})}
.row .what{flex:0 1 auto}
.row .when{color:${look.ink};white-space:nowrap}
.row .date{color:${look.sub};font-size:${pt(M.small)};min-width:${U(22)};text-align:right}
`;

  const pagesHtml = plan.pages.map((p, n) => page(p, n));
  if (mode === "print") return `<html><head><meta charset="utf-8"/><style>${css}</style></head><body>${pagesHtml.join("")}</body></html>`;

  // the preview: the same pages, scaled to the screen (1pt = 4/3 css px). Each page sits in a frame of its scaled size and is scaled with a
  // transform, which shrinks it exactly (a zoomed page would be laid out again at the new size, and lay out differently).
  const pageW = M.w * (4 / 3), pageH = M.h * (4 / 3);
  const sheet = (h: string, z: number) => `<div class="frame" style="width:${(pageW * z).toFixed(1)}px;height:${(pageH * z).toFixed(1)}px"><div class="sheet" style="transform:scale(${z.toFixed(5)})">${h}</div></div>`;
  const screenCss = `
html,body{background:transparent;overflow-x:hidden}
.frame{position:relative;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.18);background:${look.paper};flex:none}
.sheet{position:absolute;top:0;left:0;width:${pageW.toFixed(2)}px;height:${pageH.toFixed(2)}px;transform-origin:0 0}
.pager{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;height:100vh;scrollbar-width:none}
.pager::-webkit-scrollbar{display:none}
.pager .slot{flex:0 0 100vw;height:100vh;scroll-snap-align:center;display:flex;align-items:center;justify-content:center}
.pager.peek{padding-left:11vw;box-sizing:border-box}
.pager.peek .slot{flex:0 0 78vw;transition:transform .25s,opacity .25s}
.pager.peek .slot:not(.on){transform:scale(.9);opacity:.55}
.pager.peek::after{content:"";flex:0 0 11vw}
.overview{display:flex;flex-wrap:wrap;justify-content:space-between;row-gap:10px}
.overview .slot{display:flex;flex-direction:column;align-items:center;cursor:pointer}
.overview .lead{flex:0 0 100%;padding:4px 0 6px}
.overview .num{font:500 11px Roboto,sans-serif;color:#888;margin-top:4px}
`;
  if (mode === "overview") {
    const slots = (i.overview ?? []).map(({ index, width }, k) => `<div class="slot${k === 0 ? " lead" : ""}" onclick="tap(${index})">${sheet(pagesHtml[index] ?? "", width / pageW)}${k === 0 ? "" : `<div class="num">Page ${index + 1}</div>`}</div>`);
    return `<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${css}${screenCss}</style></head><body><div class="overview">${slots.join("")}</div>
<script>function tap(i){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({open:i}))}</script></body></html>`;
  }
  return `<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${css}${screenCss}</style></head><body><div class="pager${i.peek ? " peek" : ""}" id="pager">${pagesHtml.map((h) => `<div class="slot">${sheet(h, 1)}</div>`).join("")}</div>
<script>
(function(){
  var pager=document.getElementById('pager'),frames=document.querySelectorAll('.frame'),slots=document.querySelectorAll('.slot'),last=-1,SW=${i.peek ? 0.78 : 1};
  function step(){return window.innerWidth*SW;}
  function fit(){var z=Math.min((step()-24)/${pageW.toFixed(2)},(window.innerHeight-24)/${pageH.toFixed(2)});
    for(var k=0;k<frames.length;k++){frames[k].style.width=(${pageW.toFixed(2)}*z)+'px';frames[k].style.height=(${pageH.toFixed(2)}*z)+'px';frames[k].firstChild.style.transform='scale('+z+')';}}
  function report(){var i=Math.round(pager.scrollLeft/step());if(i!==last){if(slots[last])slots[last].classList.remove('on');if(slots[i])slots[i].classList.add('on');last=i;window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({page:i}));}}
  window.go=function(i){pager.scrollTo({left:i*step(),behavior:'smooth'})};
  fit();window.addEventListener('resize',fit);pager.addEventListener('scroll',report,{passive:true});
  pager.scrollLeft=${i.start ?? 0}*step();report();
})();
</script></body></html>`;
}

/** Pictures are printed at about this sharpness: sharp on paper, and a fraction of a camera photo's size. */
export const PRINT_DPI = 170;
/** The most picture data one book embeds. The phone prints the whole book in one go, so the total must stay well within its memory. */
export const PRINT_BUDGET_BYTES = 14 * 1024 * 1024;
/** No picture is printed larger than this (sharp even across a 30 cm page). */
export const MAX_PRINT_PX = 1600;
/** Roughly how many bytes a JPEG takes per pixel at the quality used for print. */
const JPEG_BYTES_PER_PIXEL = 0.16;

/**
 * How large (longest side, in pixels) to make each picture for the PDF: as large as the place it's shown on the page needs at print sharpness,
 * never more. If the whole book would still be too heavy, every picture is made smaller by the same amount. Pure, for tests.
 */
export function printSizes(plan: BookPlan, size: BookSize): Map<string, number> {
  const M = bookMetrics(size);
  const inches = (pt: number) => pt / 72;
  const full = inches(Math.max(M.w, M.h) - 2 * M.margin) * PRINT_DPI; // a picture across the whole page
  const want = new Map<string, number>();
  const need = (uri: string | undefined, share: number) => {
    if (!uri) return;
    const px = Math.min(MAX_PRINT_PX, Math.max(240, Math.round(full * share)));
    want.set(uri, Math.max(want.get(uri) ?? 0, px));
  };
  for (const p of plan.pages) {
    if (p.kind === "cover") need(p.photo, 0.6);
    if (p.kind === "birth") need(p.photoUri, 0.75);
    if (p.kind === "picture") p.photos.forEach((u) => need(u, p.photos.length > 1 ? 0.55 : p.notes ? 0.75 : 0.9));
    if (p.kind === "pictures" || p.kind === "together") p.items.forEach((it) => need(it.photo, p.items.length > 2 ? 0.5 : 0.6));
    if (p.kind === "family") p.people.forEach((r) => need(r.photoUri, 0.2));
    if (p.kind === "classic") for (const [field, list] of Object.entries(p.entry.photos)) list.forEach((x) => need(x.uri, p.entry.id === "grid" ? 0.28 : field === "photo" || list.length === 1 ? 0.7 : 0.5));
    if (p.kind === "cameHome") { (p.entry?.photos.photos ?? []).slice(0, 1).forEach((x) => need(x.uri, 0.75)); need(p.mapUri, 0.5); }
    if (p.kind === "places") need(p.mapUri, 0.9);
  }
  const bytes = [...want.values()].reduce((t, px) => t + px * px * 0.75 * JPEG_BYTES_PER_PIXEL, 0);
  if (bytes > PRINT_BUDGET_BYTES) {
    const k = Math.sqrt(PRINT_BUDGET_BYTES / bytes);
    for (const [u, px] of want) want.set(u, Math.max(200, Math.round(px * k)));
  }
  return want;
}

/** Every picture the book shows (so the PDF can load each one once, ahead of time). */
export function picturesInBook(plan: BookPlan): string[] {
  const out = new Set<string>();
  for (const p of plan.pages) {
    if (p.kind === "cover" && p.photo) out.add(p.photo);
    if (p.kind === "picture") p.photos.forEach((u) => out.add(u));
    if (p.kind === "pictures" || p.kind === "together") p.items.forEach((it) => out.add(it.photo));
    if (p.kind === "birth" && p.photoUri) out.add(p.photoUri);
    if (p.kind === "classic") Object.values(p.entry.photos).flat().forEach((x) => x.uri && out.add(x.uri));
    if (p.kind === "family") p.people.forEach((r) => r.photoUri && out.add(r.photoUri));
    if (p.kind === "cameHome") { (p.entry?.photos.photos ?? []).slice(0, 1).forEach((x) => x.uri && out.add(x.uri)); if (p.mapUri) out.add(p.mapUri); }
    if (p.kind === "places" && p.mapUri) out.add(p.mapUri);
  }
  return [...out];
}
