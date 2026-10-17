import { GROWTH_REFS, LmsRow } from "./growthRefs";
import { ageBetween, daysBetween } from "./date";
import { GrowthRef } from "./types";

import { tr } from "./i18n";
/*
 * Growth percentiles: where a height, weight or head measurement sits among children of the same age and sex, worked out with the LMS method
 * the WHO and CDC charts are published in (z = ((x / M)^L − 1) / (L × S)). Pure, so it can be tested without a phone.
 *
 * WHO (the default): birth to 5 years from the WHO Child Growth Standards, then the WHO 2007 reference (height to 19, weight to 10). UK-WHO
 * uses these same WHO standards from 2 weeks to 4 years. CDC: the US charts, birth to 20 years. Head circumference: to 5 years (WHO) or 3 (CDC).
 * For a child whose sex is not given, the girls' and boys' results are averaged.
 */

export type GrowthChartSource = "who" | "cdc";
export type Measure = "height" | "weight" | "head";
export const CHART_SOURCES: { id: GrowthChartSource; label: string; desc: string }[] = [
  { id: "who", label: "WHO", get desc() { return tr("World Health Organization charts (the same as UK-WHO from 2 weeks to 4 years)"); } },
  { id: "cdc", get label() { return tr("CDC (US)"); }, get desc() { return tr("US Centers for Disease Control charts"); } },
];

/** Exact age in months (a month being 30.4375 days), as the charts use. */
export const ageInMonths = (birth: string, date: string) => daysBetween(birth, date) / 30.4375;

/** L, M and S at an age, between the two nearest rows of the table; null outside the ages the chart covers. */
export function lmsAt(rows: LmsRow[], months: number): [number, number, number] | null {
  if (!rows.length || months < rows[0][0] || months > rows[rows.length - 1][0]) return null;
  let i = 0;
  while (i < rows.length - 1 && rows[i + 1][0] < months) i++;
  const a = rows[i], b = rows[Math.min(i + 1, rows.length - 1)];
  const f = b[0] === a[0] ? 0 : (months - a[0]) / (b[0] - a[0]);
  return [a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2]), a[3] + f * (b[3] - a[3])];
}

/** The z-score of a measurement from L, M and S. */
export function zScore(x: number, [L, M, S]: [number, number, number]): number {
  return Math.abs(L) < 1e-9 ? Math.log(x / M) / S : (Math.pow(x / M, L) - 1) / (L * S);
}

/** The share of children below a z-score (the standard normal distribution), 0–1. */
export function normalCdf(z: number): number {
  // Abramowitz & Stegun 7.1.26, accurate to about 1e-7
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

export interface Percentile {
  z: number;
  percentile: number; // 0–100
}

/** Where a measurement sits, for a girl, a boy, or (for "all") the average of both. Null if the chart doesn't cover that age. */
export function percentileFor(source: GrowthChartSource, measure: Measure, sex: GrowthRef, months: number, value: number): Percentile | null {
  const one = (s: "girl" | "boy") => {
    const lms = lmsAt(GROWTH_REFS[source][measure][s], months);
    return lms ? zScore(value, lms) : null;
  };
  const zs = sex === "girl" || sex === "boy" ? [one(sex)] : [one("girl"), one("boy")];
  if (zs.some((z) => z == null)) return null;
  const z = (zs as number[]).reduce((a, b) => a + b, 0) / zs.length;
  return { z, percentile: normalCdf(z) * 100 };
}

/** "52nd percentile"; the far ends as "below the 1st" and "above the 99th". */
export function percentileLabel(p: number): string {
  if (p < 1) return tr("Below the 1st percentile");
  if (p > 99) return tr("Above the 99th percentile");
  const n = Math.round(p);
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix} percentile`;
}

/**
 * The combined indicator: whether weight and height are in step. A centile space on the charts is about 0.67 of a z-score; weight and height
 * more than two spaces apart are worth a look, in either direction.
 */
export type InStep = "in-step" | "heavier" | "lighter";
export function inStep(height: Percentile, weight: Percentile): InStep {
  const gap = weight.z - height.z;
  return gap > 1.34 ? "heavier" : gap < -1.34 ? "lighter" : "in-step";
}
export const IN_STEP_TEXT: Record<InStep, string> = {
  get "in-step"() { return tr("Height and weight are growing in step."); },
  get heavier() { return tr("Weight is ahead of height for now. Worth mentioning at the next check-up."); },
  get lighter() { return tr("Weight is behind height for now. Worth mentioning at the next check-up."); },
};

/** The age a measurement was taken at, as the summary shows it: "at 6 months", "at 2 years, 3 months". */
export function atAge(birth: string, date: string): string {
  const a = ageBetween(birth, date);
  const months = a.years * 12 + a.months;
  if (a.totalDays < 14) return tr("at {0} day{1}", [a.totalDays, a.totalDays === 1 ? "" : "s"]);
  if (months < 1) return tr("at {0} weeks", [Math.floor(a.totalDays / 7)]);
  if (a.years < 2) return tr("at {0} month{1}", [months, months === 1 ? "" : "s"]);
  return tr("at {0} years{1}", [a.years, a.months ? `, ${a.months} month${a.months === 1 ? "" : "s"}` : ""]);
}

/** The measurement at a z-score, from L, M and S (the inverse of zScore). */
export function valueAtZ(z: number, [L, M, S]: [number, number, number]): number {
  return Math.abs(L) < 1e-9 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}

/** The percentile lines drawn behind a growth curve: the 3rd, 50th and 97th. */
export const CENTILE_LINES = [
  { label: "97th", z: 1.881 },
  { label: "50th", z: 0 },
  { label: "3rd", z: -1.881 },
] as const;

/**
 * A percentile line, month by month from birth to `maxMonths` (as far as the chart goes): [months, value] points. For a child whose sex is not
 * given, the girls' and boys' lines are averaged.
 */
export function centileCurve(source: GrowthChartSource, measure: Measure, sex: GrowthRef, z: number, maxMonths: number): [number, number][] {
  const out: [number, number][] = [];
  const sexes: ("girl" | "boy")[] = sex === "girl" || sex === "boy" ? [sex] : ["girl", "boy"];
  for (let m = 0; m <= maxMonths; m += maxMonths > 60 ? 3 : 1) {
    const values = sexes.map((s) => lmsAt(GROWTH_REFS[source][measure][s], m)).map((lms) => (lms ? valueAtZ(z, lms) : null));
    if (values.some((v) => v == null)) continue;
    out.push([m, (values as number[]).reduce((a, b) => a + b, 0) / values.length]);
  }
  return out;
}
