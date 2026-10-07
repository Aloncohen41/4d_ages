import { MILESTONE_DEFS, Tag, TagCategory } from "./types";
import { makeTag, personLabel, upsertTagIn, uniqueIds } from "./tags";

/*
 * Migrations for the saved data. They work on the stored (loose) shape rather than today's types, because the data
 * on a phone is whatever an older version of the app wrote. Each step only ADDS or RESHAPES — memories, dates, notes,
 * photos and tags are carried over, never dropped — and each step is safe to run twice.
 *
 *   v2  old built-in "First …" milestones become First entries
 *   v3  "people in this photo" become person tags; tags stored as "<kind>:<value>"
 *   v4  tags move to one central list; memories hold tag ids
 *   v5  one list of memories: photos, milestone records and standalone heights/weights all become memories
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Loose = Record<string, any>;

/** The old built-in "First …" milestones. They are now proper `First` entries, so existing records move across. */
export const LEGACY_FIRSTS: Record<string, { title: string; emoji: string }> = {
  "first-smile": { title: "First smile", emoji: "😊" },
  "first-word": { title: "First word", emoji: "🗣️" },
  "first-tooth": { title: "First tooth", emoji: "🦷" },
  "first-steps": { title: "First steps", emoji: "👣" },
  "first-solid-food": { title: "First solid food", emoji: "🥑" },
  "first-haircut": { title: "First haircut", emoji: "✂️" },
  "first-birthday": { title: "First birthday", emoji: "🎂" },
  "first-laugh": { title: "First laugh", emoji: "😄" },
  "first-wave": { title: "First wave bye-bye", emoji: "👋" },
  "first-swim": { title: "First swim", emoji: "🏊" },
  "first-holiday": { title: "First holiday", emoji: "✈️" },
};

/* ---------------- v2 ---------------- */
export function migrateLegacyFirsts<S extends Loose>(s: S): S {
  let photos: Loose[] = (s.photos || []).slice();
  const milestones: Record<string, Record<string, Loose>> = {};
  for (const [childId, recs] of Object.entries((s.milestones || {}) as Record<string, Record<string, Loose>>)) {
    const next = { ...recs };
    for (const [id, rec] of Object.entries(recs)) {
      const legacy = LEGACY_FIRSTS[id];
      if (!legacy) continue;
      delete next[id];
      photos = photos.filter((p) => !(p.childId === childId && p.milestoneId === id)); // its old timeline card
      const entryId = `en-mig-${childId}-${id}`;
      if (photos.some((p) => p.id === entryId)) continue;
      const media: Loose[] = rec.media || [];
      const first = media[0];
      photos.push({
        id: entryId, childId, date: rec.date, caption: rec.note || "", title: legacy.title, time: rec.time, location: rec.location,
        tags: rec.tags || [], people: [], kind: first?.kind ?? "photo", uri: first?.uri || undefined, media,
        emoji: rec.emoji || legacy.emoji, palette: "peach", source: "First", entryKind: "first", updatedAt: rec.updatedAt ?? Date.now(),
      });
    }
    milestones[childId] = next;
  }
  return { ...s, photos, milestones };
}

/* ---------------- v3 ---------------- */
const CATS = new Set(["person", "event", "place", "other"]);
/** Old tag strings: "person:rosa", "event:Party", or a plain word (= other). */
export function legacyTag(raw: string): { category: TagCategory; value: string } {
  const s = String(raw).trim().replace(/^#+/, "");
  const i = s.indexOf(":");
  if (i > 0 && CATS.has(s.slice(0, i).toLowerCase())) return { category: s.slice(0, i).toLowerCase() as TagCategory, value: s.slice(i + 1).trim() };
  return { category: "other", value: s };
}
const legacyKey = (raw: string) => {
  const t = legacyTag(raw);
  return `${t.category}:${t.value}`;
};
function dedupeKeys(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const k = legacyKey(raw);
    if (!legacyTag(raw).value || seen.has(k.toLowerCase())) continue;
    seen.add(k.toLowerCase());
    out.push(k);
  }
  return out;
}

export function migrateTagsV3<S extends Loose>(s: S): S {
  const photos = (s.photos || []).map((p: Loose) => ({
    ...p,
    tags: dedupeKeys([...(p.tags || []), ...(p.people || []).map((id: string) => `person:${id}`)]),
    people: undefined,
  }));
  const milestones: Record<string, Record<string, Loose>> = {};
  for (const [childId, recs] of Object.entries((s.milestones || {}) as Record<string, Record<string, Loose>>)) {
    const next: Record<string, Loose> = {};
    for (const [id, rec] of Object.entries(recs)) next[id] = { ...rec, tags: dedupeKeys(rec.tags || []) };
    milestones[childId] = next;
  }
  return { ...s, photos, milestones };
}

/* ---------------- v4 ---------------- */
/** Move tags into one central list; memories keep only the ids. */
export function migrateTagsV4<S extends Loose>(s: S): S {
  let registry: Tag[] = (s.tags || []).slice();
  const relatives: Loose[] = s.relatives || [];

  const toId = (raw: string): string | null => {
    const t = legacyTag(raw);
    if (!t.value) return null;
    const tag = t.category === "person" ? personTagFor(t.value) : makeTag(t.category, t.value);
    registry = upsertTagIn(registry, tag);
    return tag.id;
  };
  const personTagFor = (memberId: string): Tag => {
    const r = relatives.find((x) => x.id === memberId);
    return makeTag("person", r ? personLabel(r as { name: string; relation: string; customLabel?: string }) : "Family member", memberId);
  };
  const convert = (item: Loose): Loose => {
    const { tags, people, ...rest } = item;
    const raw: string[] = Array.isArray(tags) ? tags : [];
    const fromPeople: string[] = Array.isArray(people) ? people.map((id: string) => `person:${id}`) : [];
    const ids = uniqueIds([...(item.tagIds || []), ...[...raw, ...fromPeople].map(toId)]);
    return { ...rest, tagIds: ids };
  };

  const photos = (s.photos || []).map(convert);
  const milestones: Record<string, Record<string, Loose>> = {};
  for (const [childId, recs] of Object.entries((s.milestones || {}) as Record<string, Record<string, Loose>>)) {
    milestones[childId] = {};
    for (const [id, rec] of Object.entries(recs)) milestones[childId][id] = convert(rec);
  }
  return { ...s, photos, milestones, tags: registry };
}

/* ---------------- v5 ---------------- */
const noonOf = (date: string) => Date.parse(`${date}T12:00:00`) || Date.now();

/**
 * One list of memories. Nothing is dropped:
 *  - every stored photo / story / first / last / measurement becomes a memory of that type (its files become `media`);
 *  - every milestone record becomes a milestone memory (same id as its old timeline card, so links keep working);
 *  - a milestone card that somehow has no record is kept, built from the card itself;
 *  - heights and weights that aren't already part of a measurement become measurement memories.
 */
export function migrateMemoriesV5<S extends Loose>(s: S): S {
  if (!s.photos && !s.milestones && !s.heights && !s.weights) return s; // already v5 (or nothing saved)

  const oldPhotos: Loose[] = s.photos || [];
  const records: Record<string, Record<string, Loose>> = s.milestones || {};
  const customDefs: Record<string, Loose[]> = s.customDefs || {};
  const labelOf = (childId: string, defId: string): string | undefined =>
    MILESTONE_DEFS.find((d) => d.id === defId)?.label ?? (customDefs[childId] || []).find((d) => d.id === defId)?.label;

  const mediaOf = (p: Loose): Loose[] =>
    Array.isArray(p.media) && p.media.length ? p.media : p.uri ? [{ id: `mi-${p.id}`, uri: p.uri, kind: p.kind ?? "photo", ...(p.storagePath ? { path: p.storagePath } : {}) }] : [];

  const memories: Loose[] = [];

  // 1) photos, stories, firsts, lasts, measurements (milestone cards are rebuilt from their records below)
  for (const p of oldPhotos) {
    if (p.milestoneId) continue;
    memories.push({
      id: p.id, childId: p.childId, type: p.entryKind ?? "photo",
      title: p.title, description: p.caption ?? p.description ?? "", date: p.date, time: p.time, location: p.location,
      media: mediaOf(p), tagIds: p.tagIds ?? [], createdAt: p.createdAt ?? noonOf(p.date),
      heightCm: p.heightCm, weightKg: p.weightKg,
      emoji: p.emoji ?? "📷", palette: p.palette ?? "peach", source: p.source ?? "Added",
      updatedAt: p.updatedAt, syncedTs: p.syncedTs,
    });
  }

  // 2) milestone records (+ any orphan card)
  const seen = new Set<string>();
  for (const [childId, recs] of Object.entries(records)) {
    for (const [defId, rec] of Object.entries(recs)) {
      const card = oldPhotos.find((p) => p.childId === childId && p.milestoneId === defId);
      const id = card?.id ?? `ms-${childId}-${defId}`;
      seen.add(`${childId}|${defId}`);
      memories.push({
        id, childId, type: "milestone", milestoneId: defId,
        title: labelOf(childId, defId) ?? card?.title ?? defId, description: rec.note ?? "", date: rec.date, time: rec.time, location: rec.location,
        media: Array.isArray(rec.media) ? rec.media : [], tagIds: rec.tagIds ?? [], createdAt: rec.createdAt ?? noonOf(rec.date),
        emoji: rec.emoji ?? card?.emoji ?? "⭐", palette: "butter", source: "Milestone", updatedAt: rec.updatedAt, syncedTs: rec.syncedTs,
      });
    }
  }
  for (const p of oldPhotos) {
    if (!p.milestoneId || seen.has(`${p.childId}|${p.milestoneId}`)) continue;
    memories.push({
      id: p.id, childId: p.childId, type: "milestone", milestoneId: p.milestoneId,
      title: labelOf(p.childId, p.milestoneId) ?? p.title ?? p.milestoneId, description: p.caption ?? "", date: p.date, time: p.time, location: p.location,
      media: mediaOf(p), tagIds: p.tagIds ?? [], createdAt: p.createdAt ?? noonOf(p.date),
      emoji: p.emoji ?? "⭐", palette: "butter", source: "Milestone", updatedAt: p.updatedAt, syncedTs: p.syncedTs,
    });
  }

  // 3) heights / weights that no measurement already carries (older versions logged them on the Growth tab)
  const byId = new Map(memories.map((m) => [m.id, m]));
  const carried = (entryId: string, suffix: string) => {
    if (!entryId.endsWith(suffix)) return false;
    const m = byId.get(entryId.slice(0, -suffix.length));
    return !!m && m.type === "measure";
  };
  const standalone: Record<string, { date: string; cm?: number; kg?: number; id: string; updatedAt?: number }> = {};
  const note = (childId: string, e: Loose, field: "cm" | "kg", suffix: string) => {
    if (carried(String(e.id), suffix)) return;
    const k = `${childId}|${e.date}`;
    const cur = standalone[k] ?? (standalone[k] = { date: e.date, id: String(e.id), updatedAt: e.updatedAt });
    cur[field] = Number(e[field]);
    if (field === "cm") cur.id = String(e.id); // a merged height + weight keeps the height's id
  };
  for (const [childId, list] of Object.entries((s.heights || {}) as Record<string, Loose[]>)) for (const e of list) note(childId, e, "cm", "-h");
  for (const [childId, list] of Object.entries((s.weights || {}) as Record<string, Loose[]>)) for (const e of list) note(childId, e, "kg", "-w");
  for (const [k, e] of Object.entries(standalone)) {
    const childId = k.split("|")[0];
    memories.push({
      id: `me-mig-${e.id}`, childId, type: "measure", description: "", date: e.date, media: [], tagIds: [], createdAt: noonOf(e.date),
      heightCm: e.cm, weightKg: e.kg, emoji: "📏", palette: "sage", source: "Measurement", updatedAt: e.updatedAt,
    });
  }

  // 4) deletions still waiting to be sent to the cloud
  const tombstones = ((s.tombstones || []) as Loose[])
    .map((t) => (t.table === "photos" ? { ...t, table: "memories" } : t.table === "milestones" ? { ...t, table: "memories", id: `ms-${t.childId}-${t.id}` } : t.table === "heights" ? { ...t, table: "memories", id: `me-mig-${t.id}` } : t))
    .filter((t) => t.table === "memories" || t.table === "custom_defs");

  const { photos: _p, milestones: _m, heights: _h, weights: _w, ...rest } = s;
  void _p; void _m; void _h; void _w;
  return { ...rest, memories, tombstones } as unknown as S;
}

/** Bring saved data from any older version up to date. */
export function migrateStored<S extends Loose>(persisted: S, fromVersion: number): S {
  let s: Loose = persisted;
  if (fromVersion < 2) s = migrateLegacyFirsts(s);
  if (fromVersion < 3) s = migrateTagsV3(s);
  if (fromVersion < 4) s = migrateTagsV4(s);
  if (fromVersion < 5) s = migrateMemoriesV5(s);
  return s as S;
}
