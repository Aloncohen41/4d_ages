import { Child, FoodTry, MediaItem, Memory, MilestoneDef, Relative, SyncFields, Tag } from "./types";
import { inFamily } from "./family";
import type { ClassicEntry } from "./classics";

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
    milestone_id: m.milestoneId ?? null, height_cm: m.heightCm ?? null, weight_kg: m.weightKg ?? null, head_cm: m.headCm ?? null, health_kind: m.healthKind ?? null, end_date: m.endDate ?? null,
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
    return { id: m.id, kind: m.kind === "video" || m.kind === "audio" ? m.kind : "photo", path: m.path, uri: mine && mine.path === m.path ? mine.uri : "" } as MediaItem;
  });
  return {
    ...(cur || {}),
    id: r.id, childId: r.child_id, type: r.type, title: r.title ?? undefined, description: r.description ?? "", date: String(r.date),
    time: r.time ?? undefined, location: r.location ?? undefined, media,
    tagIds: (Array.isArray(r.tags) ? r.tags : []).map((t: any) => t.id),
    createdAt: Number(r.created_at_ts) || cur?.createdAt || ts,
    milestoneId: r.milestone_id ?? undefined, heightCm: r.height_cm != null ? Number(r.height_cm) : undefined, weightKg: r.weight_kg != null ? Number(r.weight_kg) : undefined, headCm: r.head_cm != null ? Number(r.head_cm) : undefined, healthKind: r.health_kind ?? undefined, endDate: r.end_date ? String(r.end_date) : undefined,
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
  let out = cur.slice();
  for (const r of rows) {
    if (r.deleted) {
      // taken out of this child's family on another phone (or their own profile was deleted): out of it here too, and gone when in no family
      const i = out.findIndex((x) => x.id === r.id);
      if (i >= 0 && tsOf(r) >= (out[i].updatedAt ?? 0)) {
        const left = (out[i].childIds ?? []).filter((x) => x !== childId);
        out = left.length && childId ? out.map((x, k) => (k === i ? { ...x, childIds: left } : x)) : out.filter((_, k) => k !== i);
      }
      continue;
    }
    const i = out.findIndex((x) => x.id === r.id);
    const ts = tsOf(r);
    // relationships are free text now; a row from an older app may still carry its own wording beside a preset, which wins
    const relation = (typeof r.custom_label === "string" && r.custom_label.trim()) || (r.relation === "Other" ? "Family" : r.relation) || "Family";
    const fromRemote: Relative = { id: r.id, name: r.name ?? "", relation, nickname: r.nickname ?? undefined, description: r.description ?? undefined, ...(r.child_ref ? { childRef: r.child_ref } : {}), ...kinFromRow(r), updatedAt: ts, syncedTs: ts };
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

/** How a family member is related (see kinship.ts), as the cloud keeps it. */
export const kinColumns = (r: Pick<Relative, "kin" | "side" | "partnerId" | "through">) => ({ kin: r.kin ?? null, side: r.side ?? null, partner_id: r.partnerId ?? null, through_id: r.through ?? null });
/** …and back. A row from before these existed has none of them, and the person's words are read instead. */
export function kinFromRow(r: { kin?: string | null; side?: string | null; partner_id?: string | null; through_id?: string | null }): Pick<Relative, "kin" | "side" | "partnerId" | "through"> {
  return { kin: (r.kin ?? undefined) as Relative["kin"], side: r.side ?? undefined, partnerId: r.partner_id ?? undefined, through: r.through_id ?? undefined };
}

/** Which family members to send for this child: only people in that child's family, and only those the cloud doesn't have yet (or has older). */
export function relativesToPush(all: Relative[], childId: string, known: Map<string, number>, refs: Map<string, string | null> = new Map()): Relative[] {
  // also a sibling the cloud doesn't yet know is one of the children (saved before the link existed)
  return all.filter((r) => inFamily(r, childId) && (!known.has(r.id) || (r.updatedAt ?? 0) > (known.get(r.id) ?? 0) || (!!r.childRef && refs.has(r.id) && refs.get(r.id) !== r.childRef)));
}

/** A pet's columns in the cloud (empty for a child). */
export const petColumns = (c: Child) => ({
  kind: c.kind ?? null, species: c.species ?? null, breed: c.breed ?? null, dog_size: c.dogSize ?? null, birth_approx: !!c.birthApprox, gotcha_day: c.gotchaDay ?? null,
});
/** A pet's fields from a cloud row (nothing for a child). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const petFromRow = (row: any): Partial<Child> => (row?.kind === "pet"
  ? { kind: "pet", species: row.species ?? undefined, breed: row.breed ?? undefined, dogSize: row.dog_size ?? undefined, birthApprox: row.birth_approx ? true : undefined, gotchaDay: row.gotcha_day ? String(row.gotcha_day) : undefined }
  : { kind: undefined, species: undefined, breed: undefined, dogSize: undefined, birthApprox: undefined, gotchaDay: undefined });

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
      expecting: row.expecting === true ? true : undefined,
      foodGoal: row.food_goal ? Number(row.food_goal) : undefined,
      ...petFromRow(row),
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

/** A fill-in page as one cloud row: its words, and its pictures that are already uploaded. */
export function classicToRow(e: ClassicEntry, ts: number) {
  const media: Record<string, { id: string; path: string; kind: string }[]> = {};
  for (const [field, list] of Object.entries(e.photos)) {
    const up = list.filter((x) => x.path).map((x) => ({ id: x.id, path: x.path as string, kind: x.kind }));
    if (up.length) media[field] = up;
  }
  return { child_id: e.childId, id: e.id, data: e.values, media, client_ts: ts, deleted: false };
}

function rowToClassic(r: any, cur: ClassicEntry | undefined, ts: number): ClassicEntry {
  const photos: Record<string, MediaItem[]> = {};
  for (const [field, list] of Object.entries((r.media && typeof r.media === "object" ? r.media : {}) as Record<string, any[]>)) {
    photos[field] = (Array.isArray(list) ? list : []).map((m) => {
      const mine = cur?.photos[field]?.find((x) => x.id === m.id);
      return { id: m.id, kind: m.kind === "video" || m.kind === "audio" ? m.kind : "photo", path: m.path, uri: mine && mine.path === m.path ? mine.uri : "" } as MediaItem;
    });
  }
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries((r.data && typeof r.data === "object" ? r.data : {}) as Record<string, unknown>)) if (typeof v === "string") values[k] = v;
  return { id: r.id, childId: r.child_id, values, photos, updatedAt: ts, syncedTs: ts };
}

/** Fill-in pages: the newer side wins, as for memories. `onRemove` hears about pages deleted on the other phone (to delete their pictures). */
export function mergeClassics(all: ClassicEntry[], rows: any[], onRemove?: (e: ClassicEntry) => void): ClassicEntry[] {
  const out = all.slice();
  for (const r of rows) {
    const i = out.findIndex((e) => e.childId === r.child_id && e.id === r.id);
    const cur = i >= 0 ? out[i] : undefined;
    const ts = tsOf(r);
    if (r.deleted) {
      if (cur && (cur.updatedAt ?? 0) <= ts) {
        onRemove?.(cur);
        out.splice(i, 1);
      }
      continue;
    }
    if (!cur) out.push(rowToClassic(r, undefined, ts));
    else if (ts > (cur.updatedAt ?? 0)) out[i] = rowToClassic(r, cur, ts);
    else if (ts === (cur.updatedAt ?? 0)) out[i] = { ...cur, syncedTs: ts };
  }
  return out;
}

/* ---------- First foods: one row per try (see foods.ts) ---------- */

export function foodTryToRow(x: FoodTry, ts: number) {
  return { child_id: x.childId, id: x.id, food: x.food, date: x.date, amount: x.amount ?? null, liked: x.liked ?? null, reaction: x.reaction ?? null, note: x.note ?? null, client_ts: ts, deleted: false };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeFoodTries(all: FoodTry[], rows: any[]): FoodTry[] {
  const out = all.slice();
  for (const r of rows) {
    const i = out.findIndex((x) => x.childId === r.child_id && x.id === r.id);
    const cur = i >= 0 ? out[i] : undefined;
    const ts = tsOf(r);
    if (r.deleted) {
      if (cur && (cur.updatedAt ?? 0) <= ts) out.splice(i, 1);
      continue;
    }
    const row: FoodTry = { id: r.id, childId: r.child_id, food: r.food, date: String(r.date), amount: r.amount ?? undefined, liked: r.liked ?? undefined, reaction: r.reaction ?? undefined, note: r.note ?? undefined, updatedAt: ts, syncedTs: ts };
    if (!cur) out.push(row);
    else if (ts > (cur.updatedAt ?? 0)) out[i] = row;
    else if (ts === (cur.updatedAt ?? 0)) out[i] = { ...cur, syncedTs: ts };
  }
  return out;
}
