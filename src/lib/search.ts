import { Memory, Relative, Tag } from "./types";
import { labelOfTag, resolveTags } from "./tags";
import { TYPE_META } from "./entries";

/** Find memories whose title, text, place, type or tags contain every word you typed. Newest first. */
export function searchMemories(memories: Memory[], query: string, tags: Tag[], relatives: Relative[], limit = 40): Memory[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out: Memory[] = [];
  for (const m of memories) {
    const hay = [m.title, m.description, m.location, TYPE_META[m.type].label, ...resolveTags(m, tags).map((t) => labelOfTag(t, relatives))]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (words.every((w) => hay.includes(w))) out.push(m);
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || (b.time || "").localeCompare(a.time || "")).slice(0, limit);
}
