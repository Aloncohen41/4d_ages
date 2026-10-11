import { Memory, MilestoneDef, Relative, Tag } from "./types";
import { labelOfTag, resolveTags } from "./tags";
import { TYPE_META } from "./entries";
import { ageBucket, ageShort, formatDate } from "./date";

/** What else a memory can be found by: its age ("6 months") needs the birth date, a milestone its name. */
export interface SearchContext {
  birth?: string;
  defs?: MilestoneDef[];
}

/**
 * Find memories whose title, text, place, type, tags or date contain every word you typed. The date can be typed as it's written
 * ("March 2025", "5 March"), as numbers ("2025-03"), or as an age ("6 months", "newborn") when the birth date is given. Newest first.
 */
export function searchMemories(memories: Memory[], query: string, tags: Tag[], relatives: Relative[], limit = 40, ctx: SearchContext = {}): Memory[] {
  const words = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (!words.length) return [];
  const out: Memory[] = [];
  for (const m of memories) {
    const milestone = m.type === "milestone" ? ctx.defs?.find((d) => d.id === m.milestoneId)?.label : undefined;
    const hay = [
      m.title, m.description, m.location, milestone, TYPE_META[m.type].label, ...resolveTags(m, tags).map((t) => labelOfTag(t, relatives)),
      formatDate(m.date), m.date, ctx.birth ? ageShort(ctx.birth, m.date) : "", ctx.birth ? ageBucket(ctx.birth, m.date) : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (words.every((w) => hay.includes(w))) out.push(m);
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || (b.time || "").localeCompare(a.time || "")).slice(0, limit);
}
