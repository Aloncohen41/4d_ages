import { Child, KidTheme, Relative } from "./types";

/*
 * Each child has their own family. A person is one record that can be in the family of several children (Grandma is in both siblings'),
 * so editing her name or picture changes it everywhere, and a tag on a memory means the same person whichever child you are looking at.
 * Importing family into a child therefore never copies anyone: it adds the child to the person.
 */

/** In this child's family? A person with no `childIds` predates per-child families, and is in every child's family. */
export const inFamily = (r: Relative, childId: string) => !r.childIds || r.childIds.includes(childId);
export const familyOf = (relatives: Relative[], childId: string) => relatives.filter((r) => inFamily(r, childId));

/**
 * Called when a new child is about to be added: everyone from the old shared list is pinned to the children who exist now, so the new
 * child starts with an empty family (and can import) rather than silently inheriting everyone.
 */
export const pinToExistingChildren = (relatives: Relative[], existingKidIds: string[]): Relative[] =>
  relatives.map((r) => (r.childIds ? r : { ...r, childIds: [...existingKidIds] }));

const norm = (x: string | undefined) => (x ?? "").trim().toLowerCase();
/** Looks like someone already in the family (same name and same relationship) — probably the same person entered twice. */
export const looksLikeSomeoneIn = (r: Relative, family: Relative[]) =>
  family.some((x) => norm(x.name) !== "" && norm(x.name) === norm(r.name) && norm(x.relation) === norm(r.relation));

export interface ImportSource {
  child: Child;
  /** People in that child's family who are not yet in the target's family. */
  people: Relative[];
  /** The ones that look like someone the target already has (listed, but not marked by default). */
  likelyDuplicates: string[];
}

/** For each OTHER child that has anyone worth importing: who could be brought over. Children with nothing to offer are left out. */
export function importSources(relatives: Relative[], kids: Child[], targetId: string): ImportSource[] {
  const targetFamily = familyOf(relatives, targetId);
  const out: ImportSource[] = [];
  for (const k of kids) {
    if (k.id === targetId) continue;
    const people = familyOf(relatives, k.id).filter((r) => !inFamily(r, targetId) && r.childRef !== targetId); // never a child's own sibling-record
    if (!people.length) continue;
    out.push({ child: k, people, likelyDuplicates: people.filter((p) => looksLikeSomeoneIn(p, targetFamily)).map((p) => p.id) });
  }
  return out;
}

/** Everyone is marked to begin with, except people who look like someone already there. */
export const defaultSelection = (src: ImportSource): string[] => src.people.filter((p) => !src.likelyDuplicates.includes(p.id)).map((p) => p.id);
/** One tap on a person: marked → left out, left out → marked. */
export const toggleSelection = (selected: string[], id: string): string[] => (selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

/** A family in the order the parent arranged it: the people they placed first, in that order, then everyone else in the order they were added. */
export function orderedFamily(family: Relative[], order: string[] | undefined): Relative[] {
  const pos = new Map((order ?? []).map((id, i) => [id, i]));
  const placed = pos.size;
  const key = (id: string, i: number) => pos.get(id) ?? placed + i;
  return family
    .map((r, i) => ({ r, k: key(r.id, i) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.r);
}

/** Moves one person up or down by one place; returns the full new order (every id in the list). */
export function moveInOrder(ids: string[], id: string, by: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const out = ids.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** People whose name, nickname or relationship contains the search text. */
export function searchFamily(family: Relative[], query: string): Relative[] {
  const q = query.trim().toLowerCase();
  if (!q) return family;
  return family.filter((r) => [r.name, r.nickname, r.relation, r.customLabel].some((v) => (v ?? "").toLowerCase().includes(q)));
}

/** Adds the child to each of these people. People already in that family, or unknown, are left alone. */
export function addToFamily(relatives: Relative[], childId: string, ids: string[], stamp: number): Relative[] {
  const want = new Set(ids);
  return relatives.map((r) => {
    if (!want.has(r.id) || inFamily(r, childId) || r.childRef === childId) return r;
    return { ...r, childIds: [...(r.childIds ?? []), childId], updatedAt: stamp };
  });
}

/** Sets exactly which children's families a person is in (used by the "Family of" choice when editing someone). */
export const setFamilies = (relatives: Relative[], id: string, childIds: string[], stamp: number): Relative[] =>
  relatives.map((r) => (r.id === id ? { ...r, childIds: [...new Set(childIds)].filter((c) => c !== r.childRef), updatedAt: stamp } : r));

/* ------------------------------------------------------------------ siblings, set up automatically */

export const SIBLING_RELATIONS: readonly string[] = ["Sister", "Brother", "Sibling"];
/** By the colour chosen for the child: pink → Sister, blue → Brother, green → Sibling. */
export const siblingRelation = (theme: KidTheme): string => (theme === "pink" ? "Sister" : theme === "blue" ? "Brother" : "Sibling");

/** A child's sibling wording: from their gender when it is set (Girl → Sister, Boy → Brother, Prefer not to say → Sibling), else from their colour as before. */
export const siblingRelationOf = (k: Pick<Child, "theme" | "gender">): string =>
  k.gender === "girl" ? "Sister" : k.gender === "boy" ? "Brother" : k.gender === "unspecified" ? "Sibling" : siblingRelation(k.theme);

const newSibling = (k: Child, inFamiliesOf: string[], stamp: number, id: string): Relative =>
  ({ id, name: k.name, relation: siblingRelationOf(k), childRef: k.id, childIds: inFamiliesOf, updatedAt: stamp });

/**
 * A new child has just been added. Every child gets ONE sibling-person (linked to the child), who is in the family of every OTHER child:
 *  - the new child becomes a Sister / Brother / Sibling in each existing child's family, and
 *  - each existing child becomes one in the new child's family.
 * It only ever ADDS: if someone had taken a sibling out of a family on purpose, that is left alone.
 */
export function addSiblingsForNewChild(relatives: Relative[], existing: Child[], added: Child, stamp: number, makeId: () => string): Relative[] {
  if (!existing.length) return relatives;
  const all = [...existing, added];
  let out = relatives.slice();
  // the newcomer, in the families of everyone who was already here (or, if you had already added them by hand, that person is linked instead)
  const mine = findSiblingOf(out, added);
  const everyoneElse = existing.map((k) => k.id);
  if (mine < 0) out.push(newSibling(added, everyoneElse, stamp, makeId()));
  else out[mine] = { ...out[mine], childRef: added.id, childIds: [...new Set([...(out[mine].childIds ?? []), ...everyoneElse])].filter((c) => c !== added.id), updatedAt: stamp };
  // each existing child, in the newcomer's family (creating their sibling-person if they never had one)
  for (const k of existing) {
    const i = findSiblingOf(out, k);
    if (i < 0) out.push(newSibling(k, all.filter((o) => o.id !== k.id).map((o) => o.id), stamp, makeId()));
    else {
      const r = out[i];
      const base = r.childIds ?? existing.filter((o) => o.id !== k.id).map((o) => o.id);
      if (!base.includes(added.id)) out[i] = { ...r, childRef: k.id, childIds: [...base, added.id], updatedAt: stamp };
      else if (!r.childRef) out[i] = { ...r, childRef: k.id };
    }
  }
  return out;
}

/** The record that stands for this child: the linked one, or someone added by hand with this name as a Sister / Brother / Sibling. */
function findSiblingOf(rs: Relative[], k: Child): number {
  const linked = rs.findIndex((r) => r.childRef === k.id);
  if (linked >= 0) return linked;
  return rs.findIndex((r) => !r.childRef && SIBLING_RELATIONS.includes(r.relation) && norm(r.name) !== "" && norm(r.name) === norm(k.name));
}

/** True when there are several children but nobody has ever been set up as a sibling (so the one-tap "set up siblings" is worth offering). */
export const needsSiblingSetup = (relatives: Relative[], kids: Child[]) => kids.length > 1 && !relatives.some((r) => r.childRef);

/** The same result for children who already exist (siblings missing entirely): everyone in everyone else's family. */
export function setUpSiblings(relatives: Relative[], kids: Child[], stamp: number, makeId: () => string): Relative[] {
  let out = relatives.slice();
  for (const k of kids) {
    const others = kids.filter((o) => o.id !== k.id).map((o) => o.id);
    if (!others.length) continue;
    const i = findSiblingOf(out, k);
    if (i < 0) out.push(newSibling(k, others, stamp, makeId()));
    else {
      const r = out[i];
      const want = [...new Set([...(r.childIds ?? []), ...others])].filter((c) => c !== k.id);
      out[i] = { ...r, childRef: k.id, childIds: want, updatedAt: stamp };
    }
  }
  return out;
}

/** When a child is renamed (or their colour or gender changes), their sibling-person follows — unless the person was changed by hand. */
export function followChild(relatives: Relative[], before: Child, after: Child, stamp: number): Relative[] {
  return relatives.map((r) => {
    if (r.childRef !== after.id) return r;
    const patch: Partial<Relative> = {};
    if (after.name !== before.name && r.name === before.name) patch.name = after.name;
    if (siblingRelationOf(after) !== siblingRelationOf(before) && r.relation === siblingRelationOf(before)) patch.relation = siblingRelationOf(after);
    return Object.keys(patch).length ? { ...r, ...patch, updatedAt: stamp } : r;
  });
}
