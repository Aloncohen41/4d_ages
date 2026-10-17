import { MediaItem, Memory, MemoryType } from "./types";
import { uniqueIds } from "./tags";

import { tr } from "./i18n";
export const TYPE_META: Record<MemoryType, { label: string; emoji: string; palette: string; source: string }> = {
  photo: { get label() { return tr("Photo"); }, emoji: "📷", palette: "peach", get source() { return tr("Added"); } },
  story: { get label() { return tr("Story"); }, emoji: "📖", palette: "sky", get source() { return tr("Story"); } },
  milestone: { get label() { return tr("Milestone"); }, emoji: "⭐", palette: "butter", get source() { return tr("Milestone"); } },
  measure: { get label() { return tr("Measurement"); }, emoji: "📏", palette: "sage", get source() { return tr("Measurement"); } },
  first: { get label() { return tr("First"); }, emoji: "🥇", palette: "peach", get source() { return tr("First"); } },
  last: { get label() { return tr("Last"); }, emoji: "🏁", palette: "lav", get source() { return tr("Last"); } },
  health: { get label() { return tr("Health"); }, emoji: "🩺", palette: "sky", get source() { return tr("Health"); } },
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
  headCm?: number; // measure: head circumference
  healthKind?: import("./types").HealthKind; // health
  endDate?: string; // a pregnancy symptom: the last day it lasted
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
    headCm: i.type === "measure" ? i.headCm : undefined,
    healthKind: i.type === "health" ? i.healthKind ?? "other" : undefined,
    endDate: i.endDate && i.endDate > i.date ? i.endDate : undefined,
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
