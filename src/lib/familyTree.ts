/*
 * The family page's rows, from how people are related (see kinship.ts for the whole tree, with each parent's side). Kept for the simpler
 * lists that only need the generation. Pure, for tests.
 */
import { inferKin, kinInfo } from "./kinship";

export type Generation = "grand" | "parent" | "same" | "other";

/** Which row of the tree someone belongs on, from how they're related ("Nana", "Savta", "Mummy", "Our dog"). */
export function generationOf(relation: string): Generation {
  const row = kinInfo(inferKin(relation)).row;
  return row === "great" ? "grand" : row;
}

export interface TreeRows<T> { grand: T[]; parent: T[]; same: T[]; other: T[] }

/** The family in their rows, each row in the family's own order. */
export function familyRows<T extends { relation: string }>(people: T[]): TreeRows<T> {
  const rows: TreeRows<T> = { grand: [], parent: [], same: [], other: [] };
  for (const p of people) rows[generationOf(p.relation)].push(p);
  return rows;
}

/** How many people fit in one row of the tree on a page this wide (smaller faces when there are more). */
export const perRow = (pageWide: boolean) => (pageWide ? 7 : 5);
