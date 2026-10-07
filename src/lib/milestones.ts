import { MilestoneDef } from "./types";

/** "5–8 months", "14 months–2 years", "2.5–3.5 years" */
export function ageWindowLabel([lo, hi]: [number, number]): string {
  const yrs = (m: number) => `${+(m / 12).toFixed(1)}`;
  if (hi <= 24) return `${lo}–${hi} months`;
  if (lo >= 24) return `${yrs(lo)}–${yrs(hi)} years`;
  return `${lo} months–${yrs(hi)} years`;
}

/** 0 when the child is inside the typical window, otherwise how many months outside it */
export function relevance(def: MilestoneDef, months: number): number {
  if (!def.months) return 999;
  const [lo, hi] = def.months;
  return months < lo ? lo - months : months > hi ? months - hi : 0;
}

/** Milestones not yet logged that are due about now (within two months either side of the usual window), earliest first. */
export function comingUp(defs: MilestoneDef[], logged: (id: string) => boolean, months: number, limit = 6): MilestoneDef[] {
  return defs
    .filter((d) => !logged(d.id) && d.months && relevance(d, months) <= 2)
    .sort((a, b) => relevance(a, months) - relevance(b, months) || (a.months![0] - b.months![0]))
    .slice(0, limit);
}

/** Open milestones ordered by how well they fit the child's age */
export function byAgeFit(defs: MilestoneDef[], months: number): MilestoneDef[] {
  return [...defs].sort((a, b) => relevance(a, months) - relevance(b, months) || a.label.localeCompare(b.label));
}
