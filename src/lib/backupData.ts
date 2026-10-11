import { ACCOUNT_FIELDS } from "./accounts";

/*
 * What a Google Drive backup holds, and how it is put back. Pure, for tests: driveBackup.ts does the uploading and downloading.
 *
 * The backup is one data file (the books: children, memories, family, classics, tags…) plus every photo, video and voice note it uses, each
 * uploaded once under its own file name. Restoring downloads the data file and any of those files the phone doesn't have, and points the
 * books at them.
 */

export const BACKUP_FORMAT = 1;
export const BACKUP_FOLDER = "4D Ages backup";
export const BACKUP_FILE = "4d-ages-backup.json";

export interface BackupFile {
  format: number;
  app: string; // "4D Ages 1.0.8"
  savedAt: number;
  storeVersion: number;
  data: Record<string, unknown>; // the account's books (ACCOUNT_FIELDS)
}

export const baseName = (uri: string) => decodeURIComponent(uri.split("?")[0].split("/").pop() ?? "");

/** Every file on the phone the books use (photos, videos, voice notes, thumbnails, family pictures). */
export function filesIn(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    if (value.startsWith("file://")) out.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) filesIn(v, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) filesIn(v, out);
  }
  return out;
}

/** A copy with every file address changed by `to` (an address `to` doesn't know is left as it was). */
export function remapFiles<T>(value: T, to: (uri: string) => string | undefined): T {
  if (typeof value === "string") return (value.startsWith("file://") ? to(value) ?? value : value) as T;
  if (Array.isArray(value)) return value.map((v) => remapFiles(v, to)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remapFiles(v, to)])) as T;
  return value;
}

/** The backup of this account's books. */
export function buildBackup(state: Record<string, unknown>, app: string, storeVersion: number, now: number): BackupFile {
  return { format: BACKUP_FORMAT, app, savedAt: now, storeVersion, data: Object.fromEntries(ACCOUNT_FIELDS.map((k) => [k, state[k]])) };
}

/** Reads a backup file, or throws a plain-language error. */
export function parseBackup(text: string): BackupFile {
  let b: BackupFile;
  try {
    b = JSON.parse(text) as BackupFile;
  } catch {
    throw new Error("The backup file couldn't be read.");
  }
  if (!b || typeof b !== "object" || !b.data || !Array.isArray((b.data as { kids?: unknown }).kids)) throw new Error("That isn't a 4D Ages backup.");
  if (b.format > BACKUP_FORMAT) throw new Error("This backup was made by a newer version of 4D Ages. Update the app, then restore it.");
  return b;
}

/**
 * The books from a backup, ready to put on the phone. Everything is marked as not yet uploaded, so it goes back to the account, and the
 * children you created are set to be saved to the account again first (if one was deleted there, it comes back rather than being taken off
 * the phone). Children shared with you by someone else stay as they are.
 */
export function prepareRestore(data: Record<string, unknown>): Record<string, unknown> {
  const unsynced = <T,>(list: unknown): T[] => (Array.isArray(list) ? list.map((x) => ({ ...(x as object), syncedTs: undefined })) : []) as T[];
  const kids = (Array.isArray(data.kids) ? data.kids : []).map((k: { role?: string; shared?: boolean }) => (k.role === "viewer" || k.role === "editor" ? k : { ...k, shared: false, syncedTs: undefined }));
  return {
    ...data,
    kids,
    memories: unsynced(data.memories),
    classics: unsynced(data.classics),
    relatives: unsynced(data.relatives),
    syncMeta: {}, // read everything in the account again
    tombstones: [],
  };
}
