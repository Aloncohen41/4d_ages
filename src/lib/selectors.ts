import { HeightEntry, Memory, WeightEntry } from "./types";
import { byMoment } from "./display";

/** Views over the single memory list. Nothing here is stored — it is all read from the memories. */
export const memoriesOf = (memories: Memory[], childId: string) => memories.filter((m) => m.childId === childId);

/** The logged milestone memories of a child, by milestone id (a child has at most one per milestone). */
export function milestonesLogged(memories: Memory[], childId: string): Record<string, Memory> {
  const out: Record<string, Memory> = {};
  for (const m of memories) if (m.childId === childId && m.type === "milestone" && m.milestoneId) out[m.milestoneId] = m;
  return out;
}

/** Height points for charts, oldest first. */
export function heightSeries(memories: Memory[], childId: string): HeightEntry[] {
  return memories
    .filter((m) => m.childId === childId && m.heightCm != null && m.source !== "Scan") // a scan's estimate before birth isn't a measurement
    .sort(byMoment)
    .map((m) => ({ id: m.id, date: m.date, cm: m.heightCm as number }));
}

/** Head circumference points, oldest first. */
export function headSeries(memories: Memory[], childId: string): HeightEntry[] {
  return memories
    .filter((m) => m.childId === childId && m.headCm != null && m.source !== "Scan")
    .sort(byMoment)
    .map((m) => ({ id: m.id, date: m.date, cm: m.headCm as number }));
}

/** Weight points for charts, oldest first. */
export function weightSeries(memories: Memory[], childId: string): WeightEntry[] {
  return memories
    .filter((m) => m.childId === childId && m.weightKg != null && m.source !== "Scan")
    .sort(byMoment)
    .map((m) => ({ id: m.id, date: m.date, kg: m.weightKg as number }));
}
