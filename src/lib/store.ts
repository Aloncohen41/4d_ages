import { useDeferredValue } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDataStorage } from "./dataStorage";
import { addSiblingsForNewChild, addToFamily, followChild, pinToExistingChildren, setFamilies, setUpSiblings } from "./family";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Child, EntryKind, MilestoneDef, Memory, NotifPrefs, Relative, SharedItem, Tag, Tombstone } from "./types";
import { personTag, upsertTagIn, uniqueIds } from "./tags";
import type { HeightUnit, WeightUnit } from "./growth";
import { MemoryInput, buildMemory, milestoneMemoryId } from "./entries";
import { migrateStored } from "./migrate";
import { backupIfOlder } from "./backup";
import { buildSample } from "./sample";
import { deleteFile } from "./media";
import { filesOf } from "./display";

export const GROW_SPEEDS = [0.5, 1, 2, 4];

export interface SyncStatus {
  busy: boolean;
  error?: string;
  at?: number;
  progress?: string;
}

/** Which "+" form is open; `title` / `emoji` pre-fill it (used by the idea chips). */
export interface EntrySheetState {
  kind: EntryKind;
  editId?: string; // a memory id (for a milestone: the milestone's id in the catalogue)
  title?: string;
  emoji?: string;
}

/** Photos and videos shared into the app from Android, waiting on the import screen. */
export interface Incoming {
  items: SharedItem[];
  busy?: number; // number of files still being copied
}

export interface State {
  hydrated: boolean;
  kids: Child[];
  activeId: string;
  memories: Memory[]; // every photo, story, milestone, first, last and measurement
  relatives: Relative[];
  customDefs: Record<string, MilestoneDef[]>; // each child's own milestones (the catalogue; logging one makes a memory)
  growSpeed: number;
  heightUnit: HeightUnit;
  weightUnit: WeightUnit;
  tags: Tag[]; // the central tag list
  milestoneAnswers: Record<string, Record<string, string>>; // child → milestone → the day the parent said "not yet"
  tombstones: Tombstone[];
  syncMeta: Record<string, { cursor?: string; lastSync?: string }>;
  notif: NotifPrefs;
  // not saved
  sync: SyncStatus;
  shareOpen: boolean;
  pendingRecap: { childId: string; year: number } | null;
  entrySheet: EntrySheetState | null;
  tagSheet: { keys: string[] } | null; // the tag browser / results (keys empty = browse all tags)
  photoEdit: string | null; // id of the plain photo being edited
  incoming: Incoming | null;

  setActive: (id: string) => void;
  addChild: (c: Child) => void;
  updateChild: (id: string, patch: Partial<Child>) => void;
  addMemories: (list: Memory[]) => void;
  updateMemory: (id: string, patch: Partial<Pick<Memory, "date" | "description" | "tagIds" | "time" | "location" | "title">>) => void;
  /** Create or edit a memory of any type from a form. Returns its id. */
  saveMemory: (input: MemoryInput) => string;
  removeMemory: (id: string) => void;
  /** Remember a video's thumbnail. Local only: it is a file on this phone, so it does not count as an edit. */
  setMediaThumb: (memoryId: string, mediaId: string, thumb: string) => void;
  /** "Not yet" for a milestone: it is asked about again after a month, and it informs the Reinforce view. */
  answerNotYet: (childId: string, defId: string, today: string) => void;
  addCustomDef: (childId: string, def: MilestoneDef) => void;
  deleteCustomDef: (childId: string, milestoneId: string) => void;
  addRelative: (r: Relative) => void;
  updateRelative: (id: string, patch: Partial<Relative>) => void;
  removeRelative: (id: string) => void;
  /** Bring people into this child's family (adds the child to the same person records — nothing is copied). */
  importFamily: (childId: string, relativeIds: string[]) => void;
  /** For children who already exist: make each a sibling (Sister / Brother / Sibling by colour) in the others' families. */
  setupSiblings: () => void;
  /** Set exactly which children's families a person is in. */
  setRelativeChildren: (id: string, childIds: string[]) => void;
  upsertTags: (tags: Tag[]) => void;
  pruneTags: () => void;
  setHeightUnit: (u: HeightUnit) => void;
  setWeightUnit: (u: WeightUnit) => void;
  setGrowSpeed: (v: number) => void;
  setNotif: (patch: Partial<NotifPrefs>) => void;
  setSync: (patch: Partial<SyncStatus>) => void;
  setShareOpen: (open: boolean) => void;
  setPendingRecap: (v: { childId: string; year: number } | null) => void;
  setEntrySheet: (v: EntrySheetState | null) => void;
  setTagSheet: (v: { keys: string[] } | null) => void;
  setPhotoEdit: (id: string | null) => void;
  setIncoming: (v: Incoming | null) => void;
  loadSample: () => void;
  resetAll: () => void;
}

export const uid = (p = "id") => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const now = () => Date.now();

/** Deletions are only remembered for children that are shared (so the other phone learns about them). */
function addTomb(s: State, childId: string, t: Omit<Tombstone, "childId" | "ts">, base: Tombstone[] = s.tombstones): Tombstone[] {
  if (!s.kids.find((k) => k.id === childId)?.shared) return base;
  return [...base, { ...t, childId, ts: now() }];
}

/** Delete a memory's files from the phone. */
const deleteMedia = (m: Memory) => filesOf(m.media).forEach(deleteFile);

export const STORE_VERSION = 5;
// Not brand, and never to be renamed: this key is where every existing phone keeps its memories (and where the pre-migration backups are made).
const STORE_KEY = "4d-ages-v1";

/**
 * The saved data on the phone, plus a safety net: an untouched copy of older saved data is kept before any migration (see backup.ts).
 * Changing only the selected child doesn't rewrite the file (see dataStorage.ts) — that selection lives in its own tiny record.
 */
const safeStorage = createDataStorage(AsyncStorage, async (name, raw) => {
  if (name === STORE_KEY) await backupIfOlder(AsyncStorage, name, STORE_VERSION, raw);
});

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false,
      kids: [],
      activeId: "",
      memories: [],
      relatives: [],
      customDefs: {},
      growSpeed: 1,
      heightUnit: "cm",
      weightUnit: "kg",
      tags: [],
      milestoneAnswers: {},
      tombstones: [],
      syncMeta: {},
      notif: { enabled: false, daysBefore: 3, hour: 9 },
      sync: { busy: false },
      shareOpen: false,
      pendingRecap: null,
      entrySheet: null,
      tagSheet: null,
      photoEdit: null,
      incoming: null,

      setActive: (activeId) => set({ activeId }),
      setHeightUnit: (heightUnit) => set({ heightUnit }),
      setWeightUnit: (weightUnit) => set({ weightUnit }),
      setEntrySheet: (entrySheet) => set({ entrySheet }),
      setTagSheet: (tagSheet) => set({ tagSheet }),
      setPhotoEdit: (photoEdit) => set({ photoEdit }),
      setIncoming: (incoming) => set({ incoming }),

      // a new child starts with an EMPTY family: the people from the old shared list are pinned to the children who already exist
      // …and the children become each other's siblings automatically (pink → Sister, blue → Brother, green → Sibling)
      addChild: (c) => set((s) => {
        const child = { ...c, updatedAt: c.updatedAt ?? now() };
        const pinned = s.kids.length ? pinToExistingChildren(s.relatives, s.kids.map((k) => k.id)) : s.relatives;
        return { kids: [...s.kids, child], relatives: addSiblingsForNewChild(pinned, s.kids, child, now(), () => uid("rel")), activeId: c.id };
      }),
      updateChild: (id, patch) => {
        const onlyFlags = Object.keys(patch).every((k) => k === "shared");
        set((s) => {
          const before = s.kids.find((k) => k.id === id);
          const kids = s.kids.map((k) => (k.id === id ? { ...k, ...patch, ...(onlyFlags ? {} : { updatedAt: now() }) } : k));
          const after = kids.find((k) => k.id === id);
          // a sibling-person follows their child's name, emoji and colour (unless it was changed by hand)
          return before && after && !onlyFlags ? { kids, relatives: followChild(s.relatives, before, after, now()) } : { kids };
        });
      },

      addMemories: (list) => set((s) => ({ memories: [...s.memories, ...list.map((m) => ({ ...m, createdAt: m.createdAt ?? now(), updatedAt: m.updatedAt ?? now() }))] })),

      updateMemory: (id, patch) =>
        set((s) => ({
          memories: s.memories.map((m) => {
            if (m.id !== id) return m;
            const next = { ...m, ...patch, updatedAt: now() };
            if (patch.tagIds) next.tagIds = uniqueIds(patch.tagIds);
            return next;
          }),
        })),

      saveMemory: (input) => {
        const id = input.id ?? (input.type === "milestone" && input.milestoneId ? milestoneMemoryId(input.childId, input.milestoneId) : uid("mem"));
        set((s) => {
          const ts = now();
          const old = s.memories.find((m) => m.id === id);
          const memory = buildMemory(input, id, old, ts);
          const keep = new Set(filesOf(memory.media));
          if (old) filesOf(old.media).forEach((f) => !keep.has(f) && deleteFile(f)); // pictures, videos and thumbnails you took out of it
          // ticking a milestone off clears any earlier "not yet"
          let answers = s.milestoneAnswers;
          if (input.type === "milestone" && input.milestoneId && answers[input.childId]?.[input.milestoneId]) {
            const { [input.milestoneId]: _gone, ...rest } = answers[input.childId];
            void _gone;
            answers = { ...answers, [input.childId]: rest };
          }
          return { memories: old ? s.memories.map((m) => (m.id === id ? memory : m)) : [...s.memories, memory], milestoneAnswers: answers };
        });
        return id;
      },

      removeMemory: (id) =>
        set((s) => {
          const m = s.memories.find((x) => x.id === id);
          if (!m) return {};
          deleteMedia(m);
          const paths = m.media.map((x) => x.path).filter((x): x is string => !!x);
          return {
            memories: s.memories.filter((x) => x.id !== id),
            kids: s.kids.map((k) => (k.avatarPhotoId === id ? { ...k, avatarPhotoId: undefined, updatedAt: now() } : k)),
            tombstones: addTomb(s, m.childId, { table: "memories", id, paths }),
          };
        }),

      answerNotYet: (childId, defId, today) => set((s) => ({ milestoneAnswers: { ...s.milestoneAnswers, [childId]: { ...(s.milestoneAnswers[childId] || {}), [defId]: today } } })),

      setMediaThumb: (memoryId, mediaId, thumb) =>
        set((s) => {
          const m = s.memories.find((x) => x.id === memoryId);
          if (!m || !m.media.some((x) => x.id === mediaId && !x.thumb)) {
            deleteFile(thumb); // the video was removed (or already has one) while the frame was being made
            return {};
          }
          return { memories: s.memories.map((x) => (x.id === memoryId ? { ...x, media: x.media.map((y) => (y.id === mediaId ? { ...y, thumb } : y)) } : x)) };
        }),

      addCustomDef: (childId, def) =>
        set((s) => ({ customDefs: { ...s.customDefs, [childId]: [...(s.customDefs[childId] || []), { ...def, custom: true, updatedAt: now() }] } })),

      deleteCustomDef: (childId, milestoneId) => {
        const logged = get().memories.find((m) => m.childId === childId && m.type === "milestone" && m.milestoneId === milestoneId);
        if (logged) get().removeMemory(logged.id);
        set((s) => ({
          customDefs: { ...s.customDefs, [childId]: (s.customDefs[childId] || []).filter((d) => d.id !== milestoneId) },
          tombstones: addTomb(s, childId, { table: "custom_defs", id: milestoneId }),
        }));
      },

      addRelative: (r) => set((s) => ({ relatives: [...s.relatives, { ...r, updatedAt: now() }] })),
      importFamily: (childId, relativeIds) => set((s) => ({ relatives: addToFamily(s.relatives, childId, relativeIds, now()) })),
      setupSiblings: () => set((s) => ({ relatives: setUpSiblings(s.relatives, s.kids, now(), () => uid("rel")) })),
      setRelativeChildren: (id, childIds) => set((s) => ({ relatives: setFamilies(s.relatives, id, childIds, now()) })),
      updateRelative: (id, patch) =>
        set((s) => {
          const relatives = s.relatives.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: now() } : r));
          const me = relatives.find((r) => r.id === id);
          const has = s.tags.some((t) => t.relatedFamilyMemberId === id);
          return { relatives, tags: me && has ? upsertTagIn(s.tags, personTag(me)) : s.tags }; // the tag always shows their current name
        }),

      /** Remove a family member; their person tag is taken off every memory too. */
      removeRelative: (id) =>
        set((s) => {
          const r = s.relatives.find((x) => x.id === id);
          if (r?.photoUri) deleteFile(r.photoUri);
          const gone = s.tags.filter((t) => t.relatedFamilyMemberId === id).map((t) => t.id);
          const strip = (ids: string[]) => ids.filter((x) => !gone.includes(x));
          return {
            relatives: s.relatives.filter((x) => x.id !== id),
            tags: s.tags.filter((t) => !gone.includes(t.id)),
            memories: s.memories.map((m) => (m.tagIds.some((x) => gone.includes(x)) ? { ...m, tagIds: strip(m.tagIds), updatedAt: now() } : m)),
          };
        }),

      upsertTags: (list) => set((s) => ({ tags: list.reduce((acc, t) => upsertTagIn(acc, t), s.tags) })),

      /** Drop tags nothing uses any more (person tags stay while the family member exists). */
      pruneTags: () =>
        set((s) => {
          const used = new Set<string>();
          for (const m of s.memories) m.tagIds.forEach((x) => used.add(x));
          const keep = s.tags.filter((t) => used.has(t.id) || (t.category === "person" && s.relatives.some((r) => r.id === t.relatedFamilyMemberId)));
          return keep.length === s.tags.length ? s : { tags: keep };
        }),

      setGrowSpeed: (growSpeed) => set({ growSpeed }),
      setNotif: (patch) => set((s) => ({ notif: { ...s.notif, ...patch } })),
      setSync: (patch) => set((s) => ({ sync: { ...s.sync, ...patch } })),
      setShareOpen: (shareOpen) => set({ shareOpen }),
      setPendingRecap: (pendingRecap) => set({ pendingRecap }),

      loadSample: () => {
        const d = buildSample();
        set((s) => ({
          kids: [...s.kids, ...d.kids],
          activeId: s.activeId || d.kids[0].id,
          memories: [...s.memories, ...d.memories],
          relatives: [...s.relatives, ...d.relatives],
          tags: d.tags.reduce((acc, t) => upsertTagIn(acc, t), s.tags),
        }));
      },

      resetAll: () => {
        get().memories.forEach(deleteMedia);
        get().relatives.forEach((r) => r.photoUri && deleteFile(r.photoUri));
        set({ kids: [], activeId: "", memories: [], relatives: [], customDefs: {}, tags: [], milestoneAnswers: {}, tombstones: [], syncMeta: {} });
      },
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      migrate: (persisted: unknown, version: number) => migrateStored(persisted as never, version) as never,
      storage: safeStorage,
      partialize: (s) => ({
        kids: s.kids,
        activeId: s.activeId,
        memories: s.memories,
        relatives: s.relatives,
        customDefs: s.customDefs,
        growSpeed: s.growSpeed,
        heightUnit: s.heightUnit,
        weightUnit: s.weightUnit,
        tags: s.tags,
        milestoneAnswers: s.milestoneAnswers,
        tombstones: s.tombstones,
        syncMeta: s.syncMeta,
        notif: s.notif,
      }),
      onRehydrateStorage: () => () => {
        useStore.setState({ hydrated: true });
        useStore.getState().pruneTags();
      },
    }
  )
);

/**
 * The child whose pages are SHOWN. When you pick another child, the chip, theme and everything that writes data (sheets, the + button)
 * switch at once, while the heavy page content (the timeline, charts, checklist…) catches up right behind in a lower-priority render that
 * never blocks a tap. Use this in page content; use useActiveChild() for anything that saves data.
 */
export function useShownChild(): Child | undefined {
  return useDeferredValue(useActiveChild());
}
/** True for the moment between choosing another child and their pages being ready. */
export function useChildSwitching(): boolean {
  const selected = useActiveChild();
  const shown = useDeferredValue(selected);
  return selected?.id !== shown?.id;
}

export function useActiveChild(): Child | undefined {
  return useStore((s) => s.kids.find((k) => k.id === s.activeId) ?? s.kids[0]);
}
