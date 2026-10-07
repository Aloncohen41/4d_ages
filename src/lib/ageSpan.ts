/** How a stretch of a child's life is written: "0–6 months", "1–2 years", "14–20 months", "2y 3m – 3y 1m". */
export interface AgeSpan {
  /** For the screen and the title card (uses an en dash). */
  display: string;
  /** For file names (plain hyphen). */
  file: string;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const years = (m: number) => `${Math.floor(m / 12)}y${m % 12 ? ` ${m % 12}m` : ""}`;

/** A single age, in whole months: "5 months", "1 year", "2y 3m". */
export function ageWord(months: number): string {
  const m = Math.max(0, Math.floor(months));
  if (m < 24 && m % 12 !== 0) return plural(m, "month");
  if (m % 12 === 0 && m >= 12) return plural(m / 12, "year");
  return m < 24 ? plural(m, "month") : years(m);
}

/**
 * The age range between two ages in months. Whole years read as years ("1–2 years"); anything up to two years reads in months
 * ("0–6 months", "14–20 months"); longer awkward ranges use "2y 3m – 3y 1m".
 */
export function ageSpan(startMonths: number, endMonths: number): AgeSpan {
  const a = Math.max(0, Math.floor(Math.min(startMonths, endMonths)));
  const b = Math.max(0, Math.floor(Math.max(startMonths, endMonths)));
  let display: string;
  if (a === b) display = ageWord(a);
  else if (a % 12 === 0 && b % 12 === 0) display = `${a / 12}–${plural(b / 12, "year")}`;
  else if (b <= 24) display = `${a}–${plural(b, "month")}`;
  else display = `${years(a)} – ${years(b)}`;
  return { display, file: display.replace(/\s*–\s*/g, "-") };
}
