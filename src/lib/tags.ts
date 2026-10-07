import { Relative, Tag, TagCategory } from "./types";

/**
 * Tags are stored once, centrally: { id, name, category, relatedFamilyMemberId? }.
 * Memories (photos, stories, milestones, firsts, lasts, measurements, …) only hold the tag ids, so a tag can be
 * renamed in one place, a person tag always points at its family member, and searching by a tag is a simple id lookup.
 */
export const TAG_CATEGORIES: { id: TagCategory; label: string; short: string; emoji: string }[] = [
  { id: "person", label: "Person / Family", short: "People", emoji: "👪" },
  { id: "event", label: "Event", short: "Events", emoji: "🎉" },
  { id: "place", label: "Location", short: "Places", emoji: "📍" },
  { id: "other", label: "Custom / Other", short: "Other", emoji: "🏷️" },
];
export const CATEGORY_ICON: Record<TagCategory, string> = { person: "👪", event: "🎉", place: "📍", other: "🏷️" };
const MAX_LEN = 40;

const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

/** Stable, readable ids: the same name in the same category is always the same tag (on every phone). */
export function slugify(name: string): string {
  const n = name.trim().toLowerCase();
  const ascii = n.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, MAX_LEN);
  return /^[\x00-\x7f]*$/.test(n) ? ascii : `u${hash(n)}`; // names with other alphabets get a hash instead
}
export const tagIdFor = (category: TagCategory, name: string, memberId?: string) =>
  category === "person" && memberId ? `tag-person-${memberId}` : `tag-${category}-${slugify(name) || hash(name)}`;

export function makeTag(category: TagCategory, name: string, memberId?: string): Tag {
  const clean = category === "person" ? name.trim() : name.trim().slice(0, MAX_LEN);
  return { id: tagIdFor(category, clean, memberId), name: clean, category, ...(memberId ? { relatedFamilyMemberId: memberId } : {}) };
}

/** The tag for a family member. */
export const personTag = (r: Relative): Tag => makeTag("person", personLabel(r), r.id);

export const relationLabel = (r: Pick<Relative, "relation" | "customLabel">) => r.customLabel?.trim() || (r.relation === "Other" ? "Family" : r.relation);
/** "Grandma Rosa" — the relationship first so that searching "grandma" finds her. */
export const personLabel = (r: Pick<Relative, "name" | "relation" | "customLabel">) => [relationLabel(r), r.name.trim()].filter(Boolean).join(" ");

/** Add a tag to the list, or refresh its name. Returns the same list when nothing changed. */
export function upsertTagIn(list: Tag[], tag: Tag): Tag[] {
  if (!tag.name.trim()) return list;
  const i = list.findIndex((t) => t.id === tag.id);
  if (i < 0) return [...list, tag];
  const cur = list[i];
  if (cur.name === tag.name && cur.relatedFamilyMemberId === tag.relatedFamilyMemberId && cur.category === tag.category) return list;
  const next = list.slice();
  next[i] = { ...cur, ...tag };
  return next;
}

/** New tags typed as text ("beach, lake") */
export function tagsFromText(category: TagCategory, text: string): Tag[] {
  return text.split(/[,\n]+/).map((x) => makeTag(category, x)).filter((t) => t.name);
}

export const uniqueIds = (ids: (string | undefined)[]) => [...new Set(ids.filter((x): x is string => !!x))];

/** The place written in a memory's Location field counts as a Location tag, without being stored twice. */
export function implicitPlace(item: { location?: string }): Tag | null {
  const place = item.location?.trim();
  return place ? makeTag("place", place) : null;
}
export function effectiveTagIds(item: { tagIds?: string[]; location?: string }): string[] {
  const p = implicitPlace(item);
  return uniqueIds([...(item.tagIds || []), p?.id]);
}

export const hasTagId = (ids: string[] | undefined, id: string) => (ids || []).includes(id);
export const withoutTagId = (ids: string[] | undefined, id: string) => (ids || []).filter((x) => x !== id);

export function indexTags(list: Tag[]): Map<string, Tag> {
  return new Map(list.map((t) => [t.id, t]));
}

/** What to print for a tag: people show the family member's current name, everything else its own name. */
export function labelOfTag(tag: Tag | undefined, relatives: Relative[]): string {
  if (!tag) return "";
  if (tag.category === "person") {
    const r = relatives.find((x) => x.id === tag.relatedFamilyMemberId);
    if (r) return personLabel(r);
  }
  return tag.name;
}

/** Family-member ids of the person tags among these ids (what the cloud copy and old code called "people"). */
export function personIdsOf(ids: string[] | undefined, list: Tag[]): string[] {
  const idx = indexTags(list);
  return (ids || []).map((id) => idx.get(id)?.relatedFamilyMemberId).filter((x): x is string => !!x);
}

/** Resolve ids to tag objects (including a Location-field place, which isn't stored in the list). */
export function resolveTags(item: { tagIds?: string[]; location?: string }, list: Tag[]): Tag[] {
  const idx = indexTags(list);
  const place = implicitPlace(item);
  const out: Tag[] = [];
  for (const id of item.tagIds || []) {
    const t = idx.get(id);
    if (t) out.push(t);
  }
  if (place && !out.some((t) => t.id === place.id)) out.push(idx.get(place.id) ?? place);
  return out;
}

export interface TagStat {
  id: string;
  tag: Tag;
  category: TagCategory;
  label: string;
  count: number;
}

/** Every tag in use, how often, most used first. */
export function tagStats(items: { tagIds?: string[]; location?: string }[], list: Tag[], relatives: Relative[]): TagStat[] {
  const map = new Map<string, TagStat>();
  for (const it of items) {
    for (const tag of resolveTags(it, list)) {
      const cur = map.get(tag.id);
      if (cur) cur.count++;
      else map.set(tag.id, { id: tag.id, tag, category: tag.category, label: labelOfTag(tag, relatives), count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Tags whose name, or (for people) name / relationship, contains the query. */
export function searchTags(stats: TagStat[], query: string, relatives: Relative[]): TagStat[] {
  const q = query.trim().toLowerCase().replace(/^#/, "");
  if (!q) return stats;
  return stats.filter((s) => {
    if (s.label.toLowerCase().includes(q) || s.tag.name.toLowerCase().includes(q)) return true;
    if (s.category === "person") {
      const r = relatives.find((x) => x.id === s.tag.relatedFamilyMemberId);
      return !!r && [r.name, r.relation, r.customLabel || ""].some((v) => v.toLowerCase().includes(q));
    }
    return false;
  });
}

/** Memories carrying any of these tag ids. */
export function itemsWithTags<T extends { tagIds?: string[]; location?: string }>(items: T[], ids: string[]): T[] {
  const want = new Set(ids);
  return items.filter((it) => effectiveTagIds(it).some((t) => want.has(t)));
}

const PERSON_PREFIX = "tag-person-";
/** Replace the person tags among these ids with exactly these family members (other tags are left alone). */
export function withPeopleIds(ids: string[] | undefined, memberIds: string[]): string[] {
  return uniqueIds([...(ids || []).filter((x) => !x.startsWith(PERSON_PREFIX)), ...memberIds.map((m) => `${PERSON_PREFIX}${m}`)]);
}
export const memberIdOfTagId = (id: string) => (id.startsWith(PERSON_PREFIX) ? id.slice(PERSON_PREFIX.length) : undefined);

/** A tag from its id: from the list, or (for a person) rebuilt from the family member. */
export function tagFromId(id: string, list: Tag[], relatives: Relative[]): Tag | undefined {
  const found = list.find((t) => t.id === id);
  if (found) return found;
  const m = memberIdOfTagId(id);
  const r = m ? relatives.find((x) => x.id === m) : undefined;
  return r ? personTag(r) : undefined;
}
