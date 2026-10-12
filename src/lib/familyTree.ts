/*
 * The family page as a family tree: the grandparents at the top, then the parents' generation (mums and dads, aunts and uncles), then the
 * child in the middle of their own row with their brothers, sisters, cousins and pets, and everyone else who loves them below. Which row
 * someone is in comes from the relationship, in the family's own words ("Nana", "Savta", "Mummy", "Our dog"). Pure, for tests.
 */

export type Generation = "grand" | "parent" | "same" | "other";

const GRAND = /\b(grand\w*|great[- ]?\w+|gran|granny|nan|nana|nanna|nanny|nonna|nonno|oma|opa|savta|saba|bubbe|bubby|zayde|zaide|abuela|abuelo|yiayia|yaya|papou|grampa|grampy|gramps|grandad|granddad|poppy|pop-?pop|mimi|gigi|baba|dedushka|babushka)\b/i;
const PARENT = /\b(mum|mummy|mom|mommy|mother|mama|mam|dad|daddy|father|papa|abba|ima|imma|parent|step\w*|guardian|aunt|aunty|auntie|uncle|godmother|godfather)\b/i;
const SAME = /\b(sister|brother|sibling|twin|cousin|half[- ]?(sister|brother))\b|^our\s/i;

/** Which row of the tree someone belongs on, from how they're related. */
export function generationOf(relation: string): Generation {
  const r = (relation ?? "").trim();
  if (GRAND.test(r)) return "grand";
  if (/god(mother|father|parent)/i.test(r)) return "other"; // godparents aren't the parents' generation of the tree
  if (PARENT.test(r)) return "parent";
  if (SAME.test(r)) return "same";
  return "other";
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
