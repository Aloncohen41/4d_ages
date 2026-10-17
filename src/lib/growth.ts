import { GrowthRef, HeightEntry } from "./types";
import { daysBetween } from "./date";

import { tr } from "./i18n";
/*
 * APPROXIMATE reference values based on the WHO Child Growth Standards (length/height-for-age, 0–5 years).
 * Rows are [age in months, median cm, approx. standard deviation cm]. They are rounded and simplified for a
 * gentle "typical range" band — NOT a medical tool. Replace with the official WHO LMS tables for exact percentiles.
 */
type Row = [number, number, number];
const BOYS: Row[] = [[0, 49.9, 1.9], [1, 54.7, 2.0], [2, 58.4, 2.1], [3, 61.4, 2.2], [4, 63.9, 2.3], [5, 65.9, 2.4], [6, 67.6, 2.4], [7, 69.2, 2.5], [8, 70.6, 2.6], [9, 72.0, 2.6], [10, 73.3, 2.7], [11, 74.5, 2.7], [12, 75.7, 2.8], [15, 79.1, 3.0], [18, 82.3, 3.2], [21, 85.1, 3.4], [24, 87.1, 3.5], [36, 96.1, 3.9], [48, 103.3, 4.3], [60, 110.0, 4.7]];
const GIRLS: Row[] = [[0, 49.1, 1.9], [1, 53.7, 2.0], [2, 57.1, 2.1], [3, 59.8, 2.2], [4, 62.1, 2.3], [5, 64.0, 2.4], [6, 65.7, 2.5], [7, 67.3, 2.5], [8, 68.7, 2.6], [9, 70.1, 2.6], [10, 71.5, 2.7], [11, 72.8, 2.8], [12, 74.0, 2.9], [15, 77.5, 3.1], [18, 80.7, 3.3], [21, 83.7, 3.5], [24, 85.7, 3.6], [36, 95.1, 4.0], [48, 102.7, 4.4], [60, 109.4, 4.8]];

function interp(rows: Row[], m: number): [number, number] | null {
  if (m < 0 || m > 60) return null;
  for (let i = 1; i < rows.length; i++) {
    if (m <= rows[i][0]) {
      const a = rows[i - 1];
      const b = rows[i];
      const f = (m - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    }
  }
  return null;
}

/** Typical range (about ±2 SD) in cm, or null when there's no reference for that age/choice. "all" is girls and boys together (their average). */
export function typicalRange(ref: GrowthRef | undefined, months: number): [number, number] | null {
  if (!ref || ref === "none") return null;
  const r = ref === "all" ? both(months) : interp(ref === "boy" ? BOYS : GIRLS, months);
  return r ? [r[0] - 2 * r[1], r[0] + 2 * r[1]] : null;
}
function both(months: number): [number, number] | null {
  const g = interp(GIRLS, months), b = interp(BOYS, months);
  return g && b ? [(g[0] + b[0]) / 2, (g[1] + b[1]) / 2] : null;
}

/**
 * Which range a child is compared with: the parent's own choice (Girls / Boys / All) if they made one, otherwise their gender —
 * Girl → Girls, Boy → Boys, Prefer not to say (or not set) → All. "none" (off, from earlier versions) counts as no choice.
 */
export function effectiveRef(child: { growthRef?: GrowthRef; gender?: "girl" | "boy" | "unspecified" }): "girl" | "boy" | "all" {
  if (child.growthRef === "girl" || child.growthRef === "boy" || child.growthRef === "all") return child.growthRef;
  return child.gender === "girl" ? "girl" : child.gender === "boy" ? "boy" : "all";
}

/** The door frame's scale: 0 to 2 metres, so a child is never drawn at the top of the frame (65 cm sits about a third of the way up). */
export const DOOR_MAX_CM = 200;
export interface DoorRef {
  cm: number;
  name: string;
  icon: "ref-bottle" | "ref-ruler" | "ref-chair" | "ref-dog" | "ref-table" | "ref-counter" | "ref-door" | "ref-kid" | "ref-adult" | "ref-fridge";
}
/** Everyday things at their real height, spread over the whole frame. Approximate. */
export const DOOR_REFS: DoorRef[] = [
  { cm: 18, get name() { return tr("Baby bottle"); }, icon: "ref-bottle" },
  { cm: 30, get name() { return tr("School ruler"); }, icon: "ref-ruler" },
  { cm: 46, get name() { return tr("Chair seat"); }, icon: "ref-chair" },
  { cm: 60, get name() { return tr("Labrador"); }, icon: "ref-dog" },
  { cm: 75, get name() { return tr("Table"); }, icon: "ref-table" },
  { cm: 91, get name() { return tr("Kitchen counter"); }, icon: "ref-counter" },
  { cm: 104, get name() { return tr("Door handle"); }, icon: "ref-door" },
  { cm: 138, get name() { return tr("A ten-year-old"); }, icon: "ref-kid" },
  { cm: 170, get name() { return tr("An adult"); }, icon: "ref-adult" },
  { cm: 185, get name() { return tr("Fridge"); }, icon: "ref-fridge" },
];

export function rangeStatus(ref: GrowthRef | undefined, months: number, cm: number): "below" | "within" | "above" | null {
  const r = typicalRange(ref, months);
  if (!r) return null;
  return cm < r[0] ? "below" : cm > r[1] ? "above" : "within";
}

export const monthsOld = (birth: string, date: string) => daysBetween(birth, date) / 30.4375;

export type HeightUnit = "cm" | "in";
export const formatHeight = (cm: number, unit: HeightUnit) => (unit === "in" ? `${(cm / 2.54).toFixed(1)} in` : `${cm % 1 === 0 ? cm.toFixed(0) : cm.toFixed(1)} cm`);
export const toCm = (value: number, unit: HeightUnit) => (unit === "in" ? value * 2.54 : value);
export const fromCm = (cm: number, unit: HeightUnit) => (unit === "in" ? cm / 2.54 : cm);

/** Latest measurement on or before a date */
export function heightAt(entries: HeightEntry[], date: string): HeightEntry | undefined {
  let best: HeightEntry | undefined;
  for (const e of entries) if (e.date <= date && (!best || e.date > best.date)) best = e;
  return best;
}

export type RefCategory = "Everyday objects" | "Toys" | "Animals" | "Furniture" | "Household items" | "Fun objects";
export interface FunRef {
  cm: number;
  emoji: string;
  name: string;
  category: RefCategory;
}

const r = (cm: number, emoji: string, name: string, category: RefCategory): FunRef => ({ cm, emoji, name, category });

/** Familiar (and a few surprising) things, from a newborn (~50 cm) all the way up to a grown-up (~2 m). Approximate. */
export const FUN_REFS: FunRef[] = [
  r(20, "🍌", "a banana", "Everyday objects"),
  r(23, "🍼", "a baby bottle", "Household items"),
  r(28, "🪑", "a footstool", "Furniture"),
  r(30, "📏", "a school ruler", "Everyday objects"),
  r(32, "🐶", "a pug", "Animals"),
  r(35, "🧸", "a teddy bear", "Toys"),
  r(38, "🎳", "a bowling pin", "Fun objects"),
  r(40, "🐇", "a rabbit", "Animals"),
  r(45, "🐈", "a house cat", "Animals"),
  r(50, "🧺", "a laundry basket", "Household items"),
  r(53, "🎸", "a ukulele", "Fun objects"),
  r(55, "🧳", "a carry-on suitcase", "Everyday objects"),
  r(60, "🐕", "a Labrador", "Animals"),
  r(62, "🛏️", "a bedside table", "Furniture"),
  r(65, "🥖", "a baguette", "Everyday objects"),
  r(68, "🐴", "a rocking horse", "Toys"),
  r(70, "🚧", "a traffic cone", "Fun objects"),
  r(75, "🐨", "a koala", "Animals"),
  r(80, "🛹", "a skateboard", "Fun objects"),
  r(85, "🛴", "a kick scooter", "Toys"),
  r(90, "🦙", "an alpaca", "Animals"),
  r(91, "🍳", "a kitchen counter", "Furniture"),
  r(95, "🪑", "a dining chair", "Furniture"),
  r(100, "🎸", "an acoustic guitar", "Fun objects"),
  r(104, "🚪", "a door handle", "Household items"),
  r(110, "🧹", "an upright vacuum cleaner", "Household items"),
  r(115, "🐧", "an emperor penguin", "Animals"),
  r(120, "🎢", "a roller-coaster height line", "Fun objects"),
  // from about six to grown-up: the gap between a ten-year-old and an adult is full of these
  r(122, "🦘", "a red kangaroo sitting up", "Animals"),
  r(125, "🎹", "an upright piano", "Furniture"),
  r(128, "🦕", "a T. rex's thigh bone", "Fun objects"),
  r(132, "🦩", "a flamingo", "Animals"),
  r(135, "🦯", "a hiking pole", "Everyday objects"),
  r(140, "🏒", "a hockey stick", "Fun objects"),
  r(145, "🧸", "the giant teddy from the fair", "Toys"),
  r(147, "🎱", "a snooker cue", "Fun objects"),
  r(150, "🐼", "a giant panda standing up", "Animals"),
  r(155, "🏂", "a snowboard", "Fun objects"),
  r(160, "📮", "a red post box", "Everyday objects"),
  r(163, "🛏️", "a bunk bed", "Furniture"),
  r(167, "🦤", "an emu", "Animals"),
  r(172, "🦍", "a gorilla standing tall", "Animals"),
  r(178, "🧊", "a fridge-freezer", "Household items"),
  r(183, "🥤", "a vending machine", "Everyday objects"),
  r(186, "🏄", "a surfboard", "Fun objects"),
  r(190, "🕰️", "a grandfather clock", "Furniture"),
  r(198, "🛝", "a climbing frame", "Toys"),
  r(203, "🚪", "a front door", "Household items"),
  r(210, "🐦", "an ostrich", "Animals"),
];

/** Small things to stack or line up: "as tall as 104 pencils". Each with its height, or its length end to end. */
export const STACK_REFS: { cm: number; one: string; many: string; emoji: string; how: "stacked" | "end to end" }[] = [
  { cm: 1.2, get one() { return tr("pancake"); }, get many() { return tr("pancakes"); }, emoji: "🥞", how: "stacked" },
  { cm: 5.4, get one() { return tr("rubber duck"); }, get many() { return tr("rubber ducks"); }, emoji: "🦆", how: "stacked" },
  { cm: 9.5, get one() { return tr("cupcake"); }, get many() { return tr("cupcakes"); }, emoji: "🧁", how: "stacked" },
  { cm: 19, get one() { return tr("pencil"); }, get many() { return tr("pencils"); }, emoji: "✏️", how: "end to end" },
  { cm: 20, get one() { return tr("banana"); }, get many() { return tr("bananas"); }, emoji: "🍌", how: "end to end" },
  { cm: 15, get one() { return tr("hot dog"); }, get many() { return tr("hot dogs"); }, emoji: "🌭", how: "end to end" },
  { cm: 6.7, get one() { return tr("tennis ball"); }, get many() { return tr("tennis balls"); }, emoji: "🎾", how: "stacked" },
];

/** "As tall as 104 pencils, end to end": one of the small things, turned with `turn` (for "More"). */
export function heightInThings(cm: number, turn = 0): { count: number; ref: (typeof STACK_REFS)[number]; text: string } | null {
  if (cm < 20) return null;
  const ref = STACK_REFS[((turn % STACK_REFS.length) + STACK_REFS.length) % STACK_REFS.length];
  const count = Math.round(cm / ref.cm);
  return { count, ref, text: `As tall as ${count} ${count === 1 ? ref.one : ref.many}, ${ref.how}` };
}

export interface WeightRef { kg: number; emoji: string; name: string; many: string }
const w = (kg: number, emoji: string, name: string, many: string): WeightRef => ({ kg, emoji, name, many });

/** Things to weigh against, from a hamster to a horse (and a car). Approximate. */
export const WEIGHT_REFS: WeightRef[] = [
  w(0.02, "🔋", "an AA battery", "AA batteries"),
  w(0.06, "🥚", "an egg", "eggs"),
  w(0.12, "🍌", "a banana", "bananas"),
  w(0.2, "🍎", "a big apple", "big apples"),
  w(0.45, "⚽", "a football", "footballs"),
  w(1, "🍍", "a pineapple", "pineapples"),
  w(2.3, "🧱", "a house brick", "house bricks"),
  w(4.5, "🐈", "a house cat", "house cats"),
  w(5, "🍉", "a watermelon", "watermelons"),
  w(7, "🎳", "a bowling ball", "bowling balls"),
  w(10, "🛞", "a car tyre", "car tyres"),
  w(16, "📺", "a big TV", "big TVs"),
  w(25, "🥔", "a sack of potatoes", "sacks of potatoes"),
  w(30, "🐕", "a Labrador", "Labradors"),
  w(45, "🦘", "a kangaroo", "kangaroos"),
  w(70, "🧺", "a washing machine", "washing machines"),
  w(100, "🐼", "a giant panda", "giant pandas"),
  w(160, "🦍", "a gorilla", "gorillas"),
  w(230, "🎹", "an upright piano", "upright pianos"),
  w(450, "🐻‍❄️", "a polar bear", "polar bears"),
  w(700, "🐄", "a cow", "cows"),
  w(1100, "🚗", "a small car", "small cars"),
];

/** "As heavy as 5 watermelons": the biggest thing that goes into the weight a whole number of times (turned with `turn` for "More"). */
export function weightInThings(kg: number, turn = 0): { count: number; ref: WeightRef; text: string }[] {
  const fits = WEIGHT_REFS.filter((x) => x.kg <= kg && kg / x.kg <= 400).reverse(); // the closest first, nothing silly like 30,000 eggs
  if (!fits.length) return [];
  const out = fits.map((ref) => {
    const count = Math.max(1, Math.round(kg / ref.kg));
    return { count, ref, text: count === 1 ? `As heavy as ${ref.name}` : `As heavy as ${count} ${ref.many}` };
  });
  const start = ((turn * 3) % out.length + out.length) % out.length;
  return [...out.slice(start), ...out.slice(0, start)].slice(0, 3);
}

/** The tallest familiar object that's no taller than the child */
export function funReference(cm: number): FunRef | null {
  let best: FunRef | null = null;
  for (const x of FUN_REFS) if (x.cm <= cm) best = x;
  return best;
}

export interface Comparison {
  ref: FunRef;
  /** how much taller the child is than the thing */
  diff: number;
  /** "About as tall as" when it's within 3 cm, otherwise "Taller than" */
  phrase: string;
}

/**
 * A few comparisons from different categories (the closest object below the child's height in each),
 * nearest first. `offset` rotates through them so "more comparisons" shows something new.
 */
export function funComparisons(cm: number, count = 3, offset = 0): Comparison[] {
  const best = new Map<RefCategory, FunRef>();
  for (const x of FUN_REFS) if (x.cm <= cm) best.set(x.category, x); // sorted ascending, so the last one per category is the closest
  const all = [...best.values()].sort((a, b) => b.cm - a.cm);
  if (!all.length) return [];
  const n = Math.min(count, all.length);
  const out: Comparison[] = [];
  for (let i = 0; i < n; i++) {
    const ref = all[(offset * n + i) % all.length];
    const diff = cm - ref.cm;
    out.push({ ref, diff, phrase: diff <= 3 ? tr("About as tall as") : tr("Taller than") });
  }
  return out;
}

/** The next object up, and how far there is to go */
export function nextUp(cm: number): { ref: FunRef; gap: number } | null {
  const next = FUN_REFS.find((x) => x.cm > cm);
  return next ? { ref: next, gap: next.cm - cm } : null;
}

/**
 * Where to put labels that each want to sit at a height (`wanted`, in px from the top, in the order given) without overlapping: each keeps its
 * place unless it would touch the one above, then it moves down just enough. Labels that would fall past `max` are pulled back up. Pure, for tests.
 */
export function placeLabels(wanted: number[], gap: number, min = 0, max = Infinity): number[] {
  const order = wanted.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const out = new Array<number>(wanted.length);
  let last = -Infinity;
  for (const { y, i } of order) {
    const top = Math.max(y, min, last + gap);
    out[i] = top;
    last = top;
  }
  // anything pushed below the bottom is moved back up, keeping the gaps
  let floor = max;
  for (const { i } of [...order].reverse()) {
    if (out[i] > floor) out[i] = floor;
    floor = out[i] - gap;
  }
  return out;
}

/** Objects to draw beside the door frame, thinned out so they don't overlap */
export function frameRefs(maxCm: number, heightPx: number, minGapPx = 30): FunRef[] {
  const out: FunRef[] = [];
  let lastY = -Infinity; // walk from the tallest (top of the frame) downwards
  for (const x of [...FUN_REFS].filter((y) => y.cm <= maxCm).reverse()) {
    const y = heightPx - (x.cm / maxCm) * heightPx;
    if (y - lastY >= minGapPx) {
      out.push(x);
      lastY = y;
    }
  }
  return out.reverse();
}

export type WeightUnit = "kg" | "lb";
export const KG_PER_LB = 0.45359237;
export const toKg = (value: number, unit: WeightUnit) => (unit === "lb" ? value * KG_PER_LB : value);
export const fromKg = (kg: number, unit: WeightUnit) => (unit === "lb" ? kg / KG_PER_LB : kg);
export const formatWeight = (kg: number, unit: WeightUnit) => `${fromKg(kg, unit).toFixed(unit === "lb" ? 1 : 2).replace(/\.?0+$/, "")} ${unit}`;
