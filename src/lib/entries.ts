import { MediaItem, Memory, MemoryType } from "./types";
import { uniqueIds } from "./tags";

export const TYPE_META: Record<MemoryType, { label: string; emoji: string; palette: string; source: string }> = {
  photo: { label: "Photo", emoji: "📷", palette: "peach", source: "Added" },
  story: { label: "Story", emoji: "📖", palette: "sky", source: "Story" },
  milestone: { label: "Milestone", emoji: "⭐", palette: "butter", source: "Milestone" },
  measure: { label: "Height / Weight", emoji: "📏", palette: "sage", source: "Measurement" },
  first: { label: "First", emoji: "🥇", palette: "peach", source: "First" },
  last: { label: "Last", emoji: "🏁", palette: "lav", source: "Last" },
};
/** Older name for the same table, kept so existing imports keep working. */
export const KIND_META = TYPE_META;

/** What every create / edit form hands to the store — the same shape for every type. */
export interface MemoryInput {
  id?: string; // when editing
  childId: string;
  type: MemoryType;
  title?: string;
  description: string;
  date: string;
  time?: string;
  location?: string;
  media: MediaItem[];
  tagIds: string[];
  emoji: string;
  milestoneId?: string; // milestone
  heightCm?: number; // measure
  weightKg?: number; // measure
  source?: string;
}

/** The id a milestone memory always has: one memory per milestone per child. */
export const milestoneMemoryId = (childId: string, milestoneId: string) => `ms-${childId}-${milestoneId}`;

/** Build (or update) a memory from form input. Editing keeps its createdAt and sync bookkeeping. */
export function buildMemory(i: MemoryInput, id: string, old: Memory | undefined, ts: number): Memory {
  const meta = TYPE_META[i.type];
  return {
    ...(old || {}),
    id,
    childId: i.childId,
    type: i.type,
    title: i.title?.trim() || undefined,
    description: i.description.trim(),
    date: i.date,
    time: i.time || undefined,
    location: i.location?.trim() || undefined,
    media: i.media,
    tagIds: uniqueIds(i.tagIds),
    createdAt: old?.createdAt ?? ts,
    milestoneId: i.type === "milestone" ? i.milestoneId : undefined,
    heightCm: i.type === "measure" ? i.heightCm : undefined,
    weightKg: i.type === "measure" ? i.weightKg : undefined,
    emoji: i.emoji || meta.emoji,
    palette: meta.palette,
    source: i.source ?? old?.source ?? meta.source,
    updatedAt: ts,
  };
}

/** Parse a typed number ("74,5" or "74.5"). */
export function parseNumber(text: string): number | null {
  const n = parseFloat(text.replace(",", ".").trim());
  return isFinite(n) ? n : null;
}
