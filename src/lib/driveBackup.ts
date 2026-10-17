import AsyncStorage from "@react-native-async-storage/async-storage";
import { NeedsGoogle, downloadBytes, driveToken, uploadBytes } from "./driveAuth";
import { APP_NAME, APP_VERSION } from "../brand";
import { STORE_VERSION, useStore } from "./store";
import { migrateStored } from "./migrate";
import { BACKUP_FILE, BACKUP_ZIP, LEGACY_FOLDER, buildBackup, prepareRestore, unzipBackup, zipBackup } from "./backupData";
import { googleReady } from "./supabase";
import { syncAll } from "./sync";

import { tr } from "./i18n";
/*
 * Backing up to Google Drive, and restoring from it. The backup is one file, "4D Ages backup.zip", in the parent's own Drive, replaced each
 * time: the books, compressed. Photos and videos aren't copied into Drive (they're kept in the account already, see backupData.ts). The app
 * can only see the files it made in Drive (Google's "drive.file" access), nothing else there.
 */

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
/** Set once the 1.0.8 backup folder (separate photo files) has been moved to the Drive bin. */
const LEGACY_CLEARED_KEY = "4d-ages-drive-legacy-cleared";

export { NeedsGoogle };

export const driveAvailable = () => googleReady;

/** A Drive access token (see driveAuth.ts; the website has its own). */
async function token(interactive: boolean): Promise<{ accessToken: string; email: string } | null> {
  if (!googleReady) throw new Error(tr("Google sign-in isn't set up in this build, so Drive backup isn't available."));
  return driveToken(interactive);
}

async function api<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) } });
  if (res.status === 401) throw new NeedsGoogle();
  if (!res.ok) throw new Error(`Google Drive said no (${res.status}). ${(await res.text().catch(() => "")).slice(0, 160)}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

const q = (s: string) => encodeURIComponent(s);

/** The app's backup file in Drive (the newest, if there were ever two), or undefined. */
async function findZip(accessToken: string): Promise<{ id: string; modifiedTime: string } | undefined> {
  const res = await api<{ files: { id: string; modifiedTime: string }[] }>(accessToken, `/files?q=${q(`name='${BACKUP_ZIP}' and trashed=false`)}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc&spaces=drive`);
  return res.files[0];
}

/** 1.0.8 kept a folder of separate files: moved to the Drive bin (recoverable there for 30 days) once the zip is safely saved. */
async function clearLegacy(accessToken: string) {
  if (await AsyncStorage.getItem(LEGACY_CLEARED_KEY).catch(() => null)) return;
  const res = await api<{ files: { id: string }[] }>(accessToken, `/files?q=${q(`name='${LEGACY_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)&spaces=drive`);
  for (const f of res.files) await api(accessToken, `/files/${f.id}?fields=id`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) });
  await AsyncStorage.setItem(LEGACY_CLEARED_KEY, "1");
  await AsyncStorage.removeItem("4d-ages-drive-files");
}

let running: Promise<void> | null = null;

/**
 * Backs up this account's books to Drive, replacing the last backup. `interactive` when the parent tapped it (they may be asked to pick an
 * account and allow Drive); the automatic backup never asks and just records that Drive needs connecting again.
 */
export function backupNow(interactive: boolean, onProgress?: (text: string) => void): Promise<void> {
  if (running) return running;
  running = (async () => {
    const set = useStore.getState().setDriveBackup;
    try {
      const auth = await token(interactive);
      if (!auth) return; // the parent closed the account picker
      onProgress?.(tr("Saving your books…"));
      const backup = buildBackup(useStore.getState() as unknown as Record<string, unknown>, `${APP_NAME} ${APP_VERSION}`, STORE_VERSION, Date.now());
      const existing = await findZip(auth.accessToken);
      const id = existing?.id ?? (await api<{ id: string }>(auth.accessToken, "/files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: BACKUP_ZIP, mimeType: "application/zip" }) })).id;
      const status = await uploadBytes(`${UPLOAD}/files/${id}?uploadType=media`, zipBackup(backup), auth.accessToken, BACKUP_ZIP);
      if (status === 401) throw new NeedsGoogle();
      if (status >= 300) throw new Error(`Google Drive didn't take the backup (${status}).`);
      set({ lastAt: Date.now(), account: auth.email, error: undefined });
      await clearLegacy(auth.accessToken).catch(() => undefined); // tidying up never fails a backup
    } catch (e) {
      if (e instanceof NeedsGoogle) set({ error: "needs-google" });
      else set({ error: e instanceof Error ? e.message : String(e) });
      if (interactive) throw e;
    } finally {
      running = null;
    }
  })();
  return running;
}

/** The backup in Drive: the newest zip, or 1.0.8's data file if that's all there is. */
async function readBackup(accessToken: string) {
  let id = (await findZip(accessToken))?.id;
  if (!id) {
    const old = await api<{ files: { id: string }[] }>(accessToken, `/files?q=${q(`name='${BACKUP_FILE}' and trashed=false`)}&fields=files(id)&orderBy=modifiedTime desc&spaces=drive`);
    id = old.files[0]?.id;
  }
  if (!id) return null;
  const got = await downloadBytes(`${API}/files/${id}?alt=media`, accessToken);
  if (got === 401) throw new NeedsGoogle();
  if (typeof got === "number") throw new Error(`Couldn't download the backup (${got}).`);
  return unzipBackup(got);
}

/** When the backup in Drive was made, or null if there isn't one. Asks to connect Drive if needed (a tap). */
export async function findBackup(): Promise<{ savedAt: number; app: string; kids: number; memories: number; account: string } | null> {
  const auth = await token(true);
  if (!auth) return null;
  const b = await readBackup(auth.accessToken);
  if (!b) return null;
  return { savedAt: b.savedAt, app: b.app, kids: (b.data.kids as unknown[]).length, memories: Array.isArray(b.data.memories) ? (b.data.memories as unknown[]).length : 0, account: auth.email };
}

/**
 * Restores the books from the Drive backup onto this phone, replacing what's here. They go back to the account too, and the photos and
 * videos come down from the account as each book syncs (see prepareRestore and downloadMissing in sync.ts).
 */
export async function restoreFromDrive(onProgress?: (text: string) => void): Promise<number> {
  const auth = await token(true);
  if (!auth) throw new Error(tr("Restoring was cancelled."));
  onProgress?.(tr("Downloading your backup…"));
  const backup = await readBackup(auth.accessToken);
  if (!backup) throw new Error(tr("There's no 4D Ages backup in this Google account's Drive yet."));
  const data = backup.storeVersion < STORE_VERSION ? (migrateStored(backup.data as never, backup.storeVersion) as Record<string, unknown>) : backup.data;
  const restored = prepareRestore(data);
  useStore.setState({ ...(restored as object), preview: false });
  syncAll().catch(() => undefined); // back to the account, and the photos come down
  return (restored.kids as unknown[]).length;
}
