import { Child, MediaItem, Memory, MilestoneDef, Relative, SyncFields, Tag } from "./types";
import { inFamily } from "./family";

/*
 * Merge rules for a shared child (two phones, one cloud copy):
 *  - Every record carries `updatedAt` (when a phone last changed it).
 *  - The cloud row stores that as `client_ts`. Whichever side has the larger value wins.
 *  - `syncedTs` remembers which version the cloud already has, so unchanged records aren't re-sent.
 *  - Deletions travel as rows with deleted = true.
 */
export const isDirty = (r: SyncFields) => (r.updatedAt ?? 0) > (r.syncedTs ?? -1);
const tsOf = (r: { client_ts?: unknown }) => Number(r.client_ts) || 0;

/** A memory as one cloud row. `tags` carries a small snapshot so the other phone can add them to its tag list. */
export function memoryToRow(m: Memory, tagList: Tag[], ts: number) {
  const byId = new Map(tagList.map((t) => [t.id, t]));
  return {
    id: m.id, child_id: m.childId, type: m.type, title: m.title ?? null, description: m.description, date: m.date, time: m.time ?? null, location: m.location ?? null,
    milestone_id: m.milestoneId ?? null, height_cm: m.heightCm ?? null, weight_kg: m.weightKg ?? null,
    emoji: m.emoji, palette: m.palette, source: m.source, created_at_ts: m.createdAt,
    tags: m.tagIds.map((id) => byId.get(id)).filter((t): t is Tag => !!t).map((t) => ({ id: t.id, name: t.name, category: t.category, member: t.relatedFamilyMemberId ?? null })),
    media: m.media.filter((x) => x.path).map((x) => ({ id: x.id, path: x.path, kind: x.kind })),
    client_ts: ts, deleted: false,
  };
}

/** The tags a cloud row mentions (to be added to this phone's central list). */
export function tagsInRow(r: { tags?: { id: string; name: string; category: Tag["category"]; member?: string | null }[] }): Tag[] {
  return (Array.isArray(r.tags) ? r.tags : []).map((t) => ({ id: t.id, name: t.name, category: t.category, ...(t.member ? { relatedFamilyMemberId: t.member } : {}) }));
}

function rowToMemory(r: any, cur: Memory | undefined, ts: number): Memory {
  const media: MediaItem[] = (Array.isArray(r.media) ? r.media : []).map((m: any) => {
    const mine = cur?.media.find((x) => x.id === m.id);
    return { id: m.id, kind: m.kind === "video" ? "video" : "photo", path: m.path, uri: mine && mine.path === m.path ? mine.uri : "" } as MediaItem;
  });
  return {
    ...(cur || {}),
    id: r.id, childId: r.child_id, type: r.type, title: r.title ?? undefined, description: r.description ?? "", date: String(r.date),
    time: r.time ?? undefined, location: r.location ?? undefined, media,
    tagIds: (Array.isArray(r.tags) ? r.tags : []).map((t: any) => t.id),
    createdAt: Number(r.created_at_ts) || cur?.createdAt || ts,
    milestoneId: r.milestone_id ?? undefined, heightCm: r.height_cm != null ? Number(r.height_cm) : undefined, weightKg: r.weight_kg != null ? Number(r.weight_kg) : undefined,
    emoji: r.emoji ?? "📷", palette: r.palette ?? "peach", source: r.source ?? "Added", updatedAt: ts, syncedTs: ts,
  };
}

export function mergeMemories(all: Memory[], rows: any[], onRemove?: (m: Memory) => void): Memory[] {
  const out = all.slice();
  for (const r of rows) {
    const i = out.findIndex((m) => m.id === r.id);
    const cur = i >= 0 ? out[i] : undefined;
    const ts = tsOf(r);
    if (r.deleted) {
      if (cur && (cur.updatedAt ?? 0) <= ts) {
        onRemove?.(cur);
        out.splice(i, 1);
      }
      continue;
    }
    if (!cur) out.push(rowToMemory(r, undefined, ts));
    else if (ts > (cur.updatedAt ?? 0)) out[i] = rowToMemory(r, cur, ts);
    else if (ts === (cur.updatedAt ?? 0)) out[i] = { ...cur, syncedTs: ts };
  }
  return out;
}

export function mergeDefs(cur: MilestoneDef[], rows: any[]): MilestoneDef[] {
  const out = cur.slice();
  for (const r of rows) {
    const i = out.findIndex((d) => d.id === r.id);
    const ts = tsOf(r);
    if (r.deleted) {
      if (i >= 0 && (out[i].updatedAt ?? 0) <= ts) out.splice(i, 1);
      continue;
    }
    const fromRemote: MilestoneDef = { id: r.id, label: r.label ?? "", emoji: r.emoji ?? "🌟", hint: r.hint ?? "", custom: true, category: r.category ?? undefined, updatedAt: ts, syncedTs: ts };
    if (i < 0) out.push(fromRemote);
    else if (ts > (out[i].updatedAt ?? 0)) out[i] = fromRemote;
    else if (ts === (out[i].updatedAt ?? 0)) out[i] = { ...out[i], syncedTs: ts };
  }
  return out;
}

/**
 * Merging only ever adds or refreshes family members. Families are per child, so people pulled for a child are put in THAT child's family
 * (an existing person gains the child; someone from before per-child families, with no list, is already in every family and is left alone).
 */
export function mergeRelatives(cur: Relative[], rows: any[], childId?: string): Relative[] {
  const out = cur.slice();
  for (const r of rows) {
    if (r.deleted) continue;
    const i = out.findIndex((x) => x.id === r.id);
    const ts = tsOf(r);
    // relationships are free text now; a row from an older app may still carry its own wording beside a preset, which wins
    const relation = (typeof r.custom_label === "string" && r.custom_label.trim()) || (r.relation === "Other" ? "Family" : r.relation) || "Family";
    const fromRemote: Relative = { id: r.id, name: r.name ?? "", relation, nickname: r.nickname ?? undefined, description: r.description ?? undefined, updatedAt: ts, syncedTs: ts };
    if (i < 0) out.push(childId ? { ...fromRemote, childIds: [childId] } : fromRemote);
    else {
      const have = out[i];
      const childIds = childId && have.childIds && !have.childIds.includes(childId) ? [...have.childIds, childId] : have.childIds;
      if (ts > (have.updatedAt ?? 0)) out[i] = { ...have, ...fromRemote, childIds }; // keep the picture, which the cloud copy doesn't carry yet
      else if (childIds !== have.childIds) out[i] = { ...have, childIds };
    }
  }
  return out;
}

/** Which family members to send for this child: only people in that child's family, and only those the cloud doesn't have yet (or has older). */
export function relativesToPush(all: Relative[], childId: string, known: Map<string, number>): Relative[] {
  return all.filter((r) => inFamily(r, childId) && (!known.has(r.id) || (r.updatedAt ?? 0) > (known.get(r.id) ?? 0)));
}

export function mergeChild(cur: Child, row: any): Child {
  const ts = tsOf(row);
  if (ts > (cur.updatedAt ?? 0)) {
    return {
      ...cur,
      name: row.name ?? cur.name,
      birth: row.birth ? String(row.birth) : cur.birth,
      theme: row.theme ?? cur.theme,
      emoji: row.emoji ?? cur.emoji,
      avatarPhotoId: row.avatar_photo_id ?? undefined,
      growthRef: row.growth_ref ?? undefined,
      gender: row.gender ?? cur.gender,
      updatedAt: ts,
      syncedTs: ts,
    };
  }
  if (ts === (cur.updatedAt ?? 0)) return { ...cur, syncedTs: ts };
  return cur;
}

/** The newest `updated_at` among fetched rows, used as the next pull cursor. */
export function newestCursor(prev: string | undefined, ...sets: any[][]): string | undefined {
  let best = prev;
  for (const rows of sets) for (const r of rows) if (r.updated_at && (!best || String(r.updated_at) > best)) best = String(r.updated_at);
  return best;
}
