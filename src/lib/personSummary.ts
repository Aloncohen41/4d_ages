import { Memory, MemoryType } from "./types";

export interface SummaryItem {
  key: string;
  label: string; // "7 photos"
  /** The newest memory of this kind (the timeline is newest first): where tapping the item scrolls to. */
  firstId?: string;
}

const NOUN: Record<MemoryType, [string, string]> = {
  photo: ["photo", "photos"], story: ["story", "stories"], milestone: ["milestone", "milestones"],
  first: ["first", "firsts"], last: ["last", "lasts"], measure: ["measurement", "measurements"],
};
const plural = (n: number, [one, many]: [string, string]) => `${n} ${n === 1 ? one : many}`;

/**
 * "5 memories, 7 photos, 1 first, 1 story": a person's memories counted (newest first in, as on their page). Photos count every picture and video
 * in any memory, so the number always matches what the timeline shows. Kinds with none are left out. Pure, for tests.
 */
export function personSummary(posts: Memory[]): SummaryItem[] {
  if (!posts.length) return [];
  const out: SummaryItem[] = [{ key: "all", label: plural(posts.length, ["memory", "memories"]), firstId: posts[0].id }];
  const withMedia = posts.filter((p) => p.media.length);
  const pictures = withMedia.reduce((n, p) => n + p.media.length, 0);
  if (pictures) out.push({ key: "media", label: plural(pictures, NOUN.photo), firstId: withMedia[0].id });
  for (const type of ["first", "story", "milestone", "last", "measure"] as MemoryType[]) {
    const list = posts.filter((p) => p.type === type);
    if (list.length) out.push({ key: type, label: plural(list.length, NOUN[type]), firstId: list[0].id });
  }
  return out;
}
