/*
 * "Open where I left off": which child was selected and which tab was showing, kept in its own tiny record.
 * It is deliberately separate from the big saved-data file: a few bytes written the moment you switch, so closing the app straight
 * afterwards can't lose it. Pure logic here (testable); the phone's storage is plugged in by resumeStorage.ts.
 */
export const TAB_NAMES = ["index", "milestones", "growth", "family", "book", "add"] as const;
export type TabName = (typeof TAB_NAMES)[number];
export const isTab = (x: unknown): x is TabName => typeof x === "string" && (TAB_NAMES as readonly string[]).includes(x);
export const tabPath = (t: TabName) => (t === "index" ? "/" : `/${t}`);

export interface Resume {
  childId?: string;
  tab?: TabName;
  /** The last notification tap that was acted on, so Android replaying it later (from the recents screen) can't override where you were. */
  handledNotification?: string;
}

/** Not the saved-data key (store.ts) — a separate, tiny record. */
export const RESUME_KEY = "4d-ages-resume-v1";

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** Reads the record without ever throwing: anything unreadable or unexpected is simply ignored. */
export function parseResume(raw: string | null | undefined): Resume {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Resume = {};
    if (typeof o.childId === "string" && o.childId) out.childId = o.childId;
    if (isTab(o.tab)) out.tab = o.tab;
    if (typeof o.handledNotification === "string" && o.handledNotification) out.handledNotification = o.handledNotification;
    return out;
  } catch {
    return {};
  }
}

export function createResume(kv: KeyValueStorage) {
  let current: Resume = {};
  return {
    async load(): Promise<Resume> {
      try {
        current = parseResume(await kv.getItem(RESUME_KEY));
      } catch {
        current = {};
      }
      return current;
    },
    get: (): Resume => current,
    /** Merges into what is known and writes straight away (not awaited: the app never waits for this). */
    save(patch: Partial<Resume>) {
      current = { ...current, ...patch };
      kv.setItem(RESUME_KEY, JSON.stringify(current)).catch(() => undefined);
    },
  };
}

/** Which child to open: the one you were last on; else the one the saved data says was selected; else the first. */
export function pickChild(kidIds: string[], remembered?: string, persistedActive?: string): string | undefined {
  if (remembered && kidIds.includes(remembered)) return remembered;
  if (persistedActive && kidIds.includes(persistedActive)) return persistedActive;
  return kidIds[0];
}

/** A notification tap is acted on once. Replays of the same tap (Android restoring the app from recents) are ignored. */
export const shouldHandleNotification = (id: string | undefined, handled: string | undefined) => !!id && id !== handled;
