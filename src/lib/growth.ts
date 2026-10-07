import { GrowthRef, HeightEntry } from "./types";
import { daysBetween } from "./date";

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

/** Typical range (about ±2 SD) in cm, or null when there's no reference for that age/choice */
export function typicalRange(ref: GrowthRef | undefined, months: number): [number, number] | null {
  if (!ref || ref === "none") return null;
  const r = interp(ref === "boy" ? BOYS : GIRLS, months);
  return r ? [r[0] - 2 * r[1], r[0] + 2 * r[1]] : null;
}

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

/** Familiar things at heights that make sense from a newborn (~50 cm) up to a five-year-old (~110 cm). Approximate. */
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
];

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
    out.push({ ref, diff, phrase: diff <= 3 ? "About as tall as" : "Taller than" });
  }
  return out;
}

/** The next object up, and how far there is to go */
export function nextUp(cm: number): { ref: FunRef; gap: number } | null {
  const next = FUN_REFS.find((x) => x.cm > cm);
  return next ? { ref: next, gap: next.cm - cm } : null;
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
