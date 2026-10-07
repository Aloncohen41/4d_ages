/*
 * The saved-data file, with one optimisation: a change of nothing but the SELECTED CHILD doesn't rewrite it.
 * zustand's persist writes the whole state after every change — every memory, tag and setting — so switching child used to re-serialise and
 * rewrite all of it just to flip one id. The selection is already kept in its own tiny record (resume.ts), so the big file is only
 * written when something in it really changed. Any real change (a memory, a child, a setting…) is written exactly as before.
 */
export interface KeyValue {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
/** What zustand's persist hands over and expects back: the saved slice of the state, and the data version. */
export interface Stored<T> { state: T; version?: number }

/** Keys whose change alone is not worth rewriting the file for. */
const SELECTION_ONLY = new Set(["activeId"]);

/** True when `next` differs from `prev` in nothing but the selection (compared by identity: the store is immutable, so an unchanged slice is the same object). */
export function onlySelectionChanged(prev: Record<string, unknown>, next: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const k of keys) {
    if (SELECTION_ONLY.has(k)) continue;
    if (!Object.is(prev[k], next[k])) return false;
  }
  return true;
}

/**
 * A zustand "PersistStorage": reads and writes the JSON file like createJSONStorage did, but skips selection-only writes.
 * `beforeRead` lets the caller take its safety backup (backup.ts) before older data is migrated.
 */
// T is the saved slice of the state; the default (any) lets it fit whatever slice the store persists
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDataStorage<T = any>(kv: KeyValue, beforeRead?: (name: string, raw: string | null) => Promise<void>) {
  let lastWritten: Record<string, unknown> | null = null;
  return {
    getItem: async (name: string): Promise<Stored<T> | null> => {
      const raw = await kv.getItem(name);
      if (beforeRead) await beforeRead(name, raw);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Stored<T>;
      lastWritten = (parsed.state as unknown as Record<string, unknown>) ?? null; // what is on disk now: later changes are compared with this
      return parsed;
    },
    setItem: (name: string, value: Stored<T>): Promise<void> => {
      const next = value.state as unknown as Record<string, unknown>;
      if (lastWritten && onlySelectionChanged(lastWritten, next)) return Promise.resolve(); // nothing to save
      lastWritten = next;
      return kv.setItem(name, JSON.stringify(value));
    },
    removeItem: (name: string): Promise<void> => {
      lastWritten = null;
      return kv.removeItem(name);
    },
  };
}
