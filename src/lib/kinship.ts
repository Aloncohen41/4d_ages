/*
 * How each person in a child's family is related, in a way the app (and the book's family tree) can use, beside the family's own words for
 * them ("Savta", "Nana", "Mummy"):
 *  - who they are to the child (a grandparent, an aunt or uncle, a cousin…), which sets their row in the tree;
 *  - whose side of the family they're on: one of the parents, by the parent's own entry when they're in the family ("Dana's side"), or simply
 *    "mother" / "father" when they aren't (so two grandmas are never mixed up, and two mums or two dads work just as well);
 *  - who they're together with (grandma and grandpa, an aunt and her husband), so couples sit side by side;
 *  - for a cousin, which aunt or uncle is their parent; for a great-grandparent, which grandparent is their child.
 * All of it can be left out: it's worked out from the family's own words where it can be ("Mum's mum", "Dad's sister", "Savta").
 *
 * A person is one record shared by brothers and sisters, so their side is the same for each (true for full siblings; a half-sibling's other
 * family isn't in this child's family at all). Pure, for tests.
 */
import type { Relative } from "./types";

export type Kin =
  | "parent" | "step-parent" | "grandparent" | "step-grandparent" | "great-grandparent"
  | "aunt-uncle" | "great-aunt-uncle" | "cousin" | "sibling" | "half-sibling" | "step-sibling"
  | "godparent" | "carer" | "friend" | "pet" | "other";

/** The tree's rows, from the top. */
export type Row = "great" | "grand" | "parent" | "same" | "other";

export interface KinInfo { id: Kin; label: string; row: Row; sided: boolean }

export const KINS: KinInfo[] = [
  { id: "parent", label: "Parent", row: "parent", sided: false },
  { id: "grandparent", label: "Grandparent", row: "grand", sided: true },
  { id: "great-grandparent", label: "Great-grandparent", row: "great", sided: true },
  { id: "aunt-uncle", label: "Aunt or uncle", row: "parent", sided: true },
  { id: "great-aunt-uncle", label: "Great-aunt or uncle", row: "grand", sided: true },
  { id: "cousin", label: "Cousin", row: "same", sided: true },
  { id: "sibling", label: "Brother or sister", row: "same", sided: false },
  { id: "half-sibling", label: "Half-brother or sister", row: "same", sided: true },
  { id: "step-sibling", label: "Stepbrother or sister", row: "same", sided: true },
  { id: "step-parent", label: "Step-parent", row: "parent", sided: true },
  { id: "step-grandparent", label: "Step-grandparent", row: "grand", sided: true },
  { id: "godparent", label: "Godparent", row: "other", sided: false },
  { id: "carer", label: "Nanny or carer", row: "other", sided: false },
  { id: "friend", label: "Family friend", row: "other", sided: false },
  { id: "pet", label: "Pet", row: "same", sided: false },
  { id: "other", label: "Someone else", row: "other", sided: false },
];
export const kinInfo = (k?: string) => KINS.find((x) => x.id === k) ?? KINS[KINS.length - 1];

const has = (re: RegExp, s: string) => re.test(s);
const GRAND_WORDS = /\b(grand\w*|gran|granny|nan|nana|nanna|nanny|nonna|nonno|oma|opa|savta|saba|bubbe|bubby|bubbie|zayde|zaide|abuela|abuelo|yiayia|yaya|papou|grampa|grampy|gramps|poppy|pop-?pop|mimi|gigi|babushka|dedushka|lola|lolo|teta|jiddo|sito)\b/i;
const MUM_WORDS = /\b(mum|mummy|mom|mommy|mother|mama|mam|ma|ima|imma|eema)\b/i;
const DAD_WORDS = /\b(dad|daddy|father|papa|pa|abba|aba|baba)\b/i;

/** Who someone is to the child, read from the family's own words (the best guess; it can always be chosen by hand). */
export function inferKin(relation: string): Kin {
  const r = (relation ?? "").trim();
  if (!r) return "other";
  // "Nanny" is a grandmother in much of the UK; a nanny who looks after them is "our nanny" (or an au pair, a childminder…)
  if (/\b(our|the|my)\s+nanny\b|\bau pair\b|\bbabysitter\b|\bchildminder\b|\bcarer\b|\bcaregiver\b|\bmetapelet\b/i.test(r)) return "carer";
  if (/^our\s/i.test(r)) return "pet";
  if (/god\s?(mother|father|parent|mum|dad)|godmum|goddad/i.test(r)) return "godparent";
  if (/\bfriend\b/i.test(r)) return "friend";
  if (/\b(mum|mom|dad|mother|father)'?s\s+(partner|husband|wife|boyfriend|girlfriend)\b/i.test(r)) return "step-parent";
  if (/great[- ]?(great[- ]?)*grand|great[- ]?(gran|nan|nana|savta|saba|oma|opa|abuela|abuelo)\b/i.test(r)) return "great-grandparent";
  if (/great[- ]?(aunt|auntie|aunty|uncle)/i.test(r)) return "great-aunt-uncle";
  if (/step[- ]?(grand|gran|nan|nana)/i.test(r)) return "step-grandparent";
  if (has(GRAND_WORDS, r) || /\b(mum|mom|dad|mother|father)'?s\s+(mum|mom|mother|dad|father|mama|papa)\b/i.test(r)) return "grandparent";
  if (/\bstep[- ]?(mum|mom|mother|dad|father|parent)/i.test(r)) return "step-parent";
  if (/\bstep[- ]?(sister|brother|sibling)/i.test(r)) return "step-sibling";
  if (/\bhalf[- ]?(sister|brother|sibling)/i.test(r)) return "half-sibling";
  if (/\b(aunt|aunty|auntie|uncle|dod|doda)\b/i.test(r) || /\b(mum|mom|dad|mother|father)'?s\s+(sister|brother)\b/i.test(r)) return "aunt-uncle";
  if (/\bcousin\b/i.test(r)) return "cousin";
  if (/\b(sister|brother|sibling|twin|sis|bro)\b/i.test(r)) return "sibling";
  if (MUM_WORDS.test(r) || DAD_WORDS.test(r) || /\b(parent|guardian)\b/i.test(r)) return "parent";
  return "other";
}

/** Whose side someone is on, read from their words: "Mum's mum", "Dad's sister", "maternal grandma"; none when it doesn't say. */
export function inferSide(relation: string): "mother" | "father" | undefined {
  const r = (relation ?? "").toLowerCase();
  if (/\bmaternal\b|\b(mum|mom|mummy|mommy|mother|mama|ima)'?s\b|\bon (mum|mom|my mother)/.test(r)) return "mother";
  if (/\bpaternal\b|\b(dad|daddy|father|papa|abba)'?s\b|\bon (dad|my father)/.test(r)) return "father";
  return undefined;
}

/** Whether a parent is the mother or the father, from their words ("Mummy", "Daddy"); undefined when it doesn't say ("Parent", a name). */
export function parentRole(relation: string): "mother" | "father" | undefined {
  const r = relation ?? "";
  if (/\bstep/i.test(r)) return undefined;
  if (MUM_WORDS.test(r)) return "mother";
  if (DAD_WORDS.test(r)) return "father";
  return undefined;
}

type Person = Pick<Relative, "id" | "relation"> & Partial<Pick<Relative, "kin" | "side" | "partnerId" | "through" | "childRef">>;

/** Who someone is to the child: chosen, or (a sibling who is one of the children, a pet) known, or read from their words. */
export function kinOf(r: Person): Kin {
  if (r.kin) return r.kin as Kin;
  const guess = inferKin(r.relation);
  if (r.childRef) return guess === "pet" ? "pet" : guess === "half-sibling" || guess === "step-sibling" ? guess : "sibling";
  return guess;
}

/** The two parents in the family, in the family's order: the first is on the left of the tree, the second on the right. */
export function parentsOf<T extends Person>(family: T[]): T[] {
  return family.filter((r) => kinOf(r) === "parent").slice(0, 2);
}

/**
 * The order people are offered in (tagging a post): the parents first, mum before dad, then everyone else A to Z by the name they're shown with.
 */
export function peopleOrder<T extends Person & { name: string; nickname?: string }>(family: T[]): T[] {
  const rank = (r: T) => (kinOf(r) === "parent" ? (parentRole(r.relation) === "father" ? 1 : 0) : 2);
  const shown = (r: T) => (r.nickname || r.name).toLocaleLowerCase();
  return [...family].sort((a, b) => rank(a) - rank(b) || shown(a).localeCompare(shown(b)));
}

/** Which side someone is on: 0 (the first parent's), 1 (the second's), or null (both, neither, or not said). */
export function sideIndex(r: Person, family: Person[]): 0 | 1 | null {
  if (!kinInfo(kinOf(r)).sided) return null;
  const parents = parentsOf(family);
  const side = r.side ?? (r.through ? family.find((x) => x.id === r.through)?.side : undefined) ?? inferSide(r.relation);
  if (!side) {
    // a partner's side: an aunt's husband is on her side
    const partner = r.partnerId ? family.find((x) => x.id === r.partnerId) : undefined;
    return partner && partner.side ? sideIndex({ ...r, side: partner.side, partnerId: undefined }, family) : null;
  }
  const byId = parents.findIndex((p) => p.id === side);
  if (byId >= 0) return byId as 0 | 1;
  if (side === "mother" || side === "father") {
    const roles = parents.map((p) => parentRole(p.relation));
    const k = roles.indexOf(side);
    if (k >= 0) return k as 0 | 1;
    // the parents' words don't say (or there are none yet): the mother's side on the left
    if (parents.length < 2) return side === "mother" ? 0 : 1;
    return side === "mother" ? (roles[0] === "father" ? 1 : 0) : roles[1] === "mother" ? 0 : 1;
  }
  return null;
}

/** The choices for "Whose side?": each parent by name when they're in the family, else "Mum's side" and "Dad's side". */
export function sideChoices(family: (Person & { name: string; nickname?: string })[]): { id: string; label: string }[] {
  const parents = parentsOf(family);
  if (parents.length === 2) return parents.map((p) => ({ id: p.id, label: `${p.nickname || p.name || p.relation}'s side` }));
  const out = parents.map((p) => ({ id: p.id, label: `${p.nickname || p.name || p.relation}'s side` }));
  const taken = new Set(parents.map((p) => parentRole(p.relation)));
  if (!taken.has("mother")) out.push({ id: "mother", label: "Mum's side" });
  if (!taken.has("father")) out.push({ id: "father", label: "Dad's side" });
  return out.slice(0, 2);
}

export interface TreeLayout<T> {
  /** each row: the first parent's side (left), the middle, and the second parent's side (right) */
  great: { left: T[]; mid: T[]; right: T[] };
  grand: { left: T[]; mid: T[]; right: T[] };
  parent: { left: T[]; mid: T[]; right: T[] };
  same: { left: T[]; mid: T[]; right: T[] };
  other: T[];
  /** what to call each side ("Dana's side"), when the tree has two */
  sides: [string, string] | null;
}

/** Couples next to each other (in the order the first of them comes), everyone else as they are. */
export function pairUp<T extends Person>(list: T[]): T[] {
  const out: T[] = [];
  for (const p of list) {
    if (out.includes(p)) continue;
    out.push(p);
    const partner = list.find((x) => x !== p && !out.includes(x) && (x.id === p.partnerId || x.partnerId === p.id));
    if (partner) out.push(partner);
  }
  return out;
}

/**
 * The family tree: great-grandparents, grandparents, the parents with the aunts and uncles on each parent's side, then the child's own row
 * with the cousins on each side and the brothers, sisters and pets in the middle; anyone else (godparents, friends) below. On each side the
 * people nearest the middle are the closest: the parents meet in the middle, each with their own brothers and sisters out to the side.
 */
export function treeLayout<T extends Person & { name: string; nickname?: string }>(family: T[]): TreeLayout<T> {
  const empty = () => ({ left: [] as T[], mid: [] as T[], right: [] as T[] });
  const out: TreeLayout<T> = { great: empty(), grand: empty(), parent: empty(), same: empty(), other: [], sides: null };
  const parents = parentsOf(family);
  for (const r of family) {
    const row = kinInfo(kinOf(r)).row;
    if (row === "other") { out.other.push(r); continue; }
    const k = kinOf(r);
    if (k === "parent") {
      (parents.indexOf(r) === 1 ? out.parent.right : parents.indexOf(r) === 0 ? out.parent.left : out.parent.mid).push(r);
      continue;
    }
    const s = sideIndex(r, family);
    out[row][s === 0 ? "left" : s === 1 ? "right" : "mid"].push(r);
  }
  // nearest the middle: the parents (and step-parents) at the inner edge of their side
  const inner = (list: T[], atEnd: boolean) => {
    const ps = list.filter((r) => kinOf(r) === "parent" || kinOf(r) === "step-parent");
    const rest = pairUp(list.filter((r) => !ps.includes(r)));
    return atEnd ? [...rest, ...pairUp(ps)] : [...pairUp(ps), ...rest];
  };
  out.parent.left = inner(out.parent.left, true);
  out.parent.right = inner(out.parent.right, false);
  for (const row of ["great", "grand", "same"] as const) {
    out[row].left = pairUp(out[row].left);
    out[row].mid = pairUp(out[row].mid);
    out[row].right = pairUp(out[row].right);
  }
  out.parent.mid = pairUp(out.parent.mid);
  const anySided = (["great", "grand", "parent", "same"] as const).some((row) => out[row].left.length || out[row].right.length);
  if (anySided && parents.length) {
    const names = sideChoices(family).map((c) => c.label);
    if (names.length === 2) out.sides = [names[0], names[1]];
  }
  return out;
}

/** "Dana's side" for someone on a side; "" for anyone else; null when they should have a side but none is known yet (to ask). */
export function sideLabel<T extends Person & { name: string; nickname?: string }>(r: T, family: T[]): string | null {
  if (!kinInfo(kinOf(r)).sided) return "";
  const s = sideIndex(r, family);
  if (s == null) return null;
  const labels = sideChoices(family);
  const parents = parentsOf(family);
  if (parents.length === 2) return labels[s]?.label ?? "";
  return (s === 0 ? "Mum's side" : "Dad's side");
}
