import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import * as LegacyFS from "expo-file-system/legacy";
import { Directory, File, Paths } from "expo-file-system";
import { APP_NAME, APP_VERSION } from "../brand";
import { STORE_VERSION, useStore } from "./store";
import { migrateStored } from "./migrate";
import { BACKUP_FILE, BACKUP_FOLDER, baseName, buildBackup, filesIn, parseBackup, prepareRestore, remapFiles } from "./backupData";
import { googleReady } from "./supabase";

/*
 * Backing up to Google Drive, and restoring from it. The backup goes in a "4D Ages backup" folder in the parent's own Drive: one data file,
 * plus each photo and video uploaded once. The app can only see the files it made there (Google's "drive.file" access), nothing else in Drive.
 */

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
/** Which Drive file holds each of this phone's files (by file name), so each is uploaded once. */
const UPLOADED_KEY = "4d-ages-drive-files";

export class NeedsGoogle extends Error {
  constructor() {
    super("Connect Google Drive again: tap Back up now.");
  }
}

export const driveAvailable = () => googleReady;

/** A Drive access token. Asks the parent to pick an account and allow Drive only when `interactive` (a tap); in the background it never asks. */
async function token(interactive: boolean): Promise<{ accessToken: string; email: string } | null> {
  if (!googleReady) throw new Error("Google sign-in isn't set up in this build, so Drive backup isn't available.");
  let user = GoogleSignin.getCurrentUser();
  if (!user) {
    const quiet = await GoogleSignin.signInSilently().catch(() => null);
    if (quiet && quiet.type === "success") user = quiet.data;
  }
  if (!user) {
    if (!interactive) throw new NeedsGoogle();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return null;
    user = res.data;
  }
  if (!user.scopes?.includes(DRIVE_SCOPE)) {
    if (!interactive) throw new NeedsGoogle();
    const res = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
    if (!res || !isSuccessResponse(res)) return null;
    user = res.data;
  }
  const { accessToken } = await GoogleSignin.getTokens();
  return { accessToken, email: user.user.email };
}

async function api<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) } });
  if (res.status === 401) throw new NeedsGoogle();
  if (!res.ok) throw new Error(`Google Drive said no (${res.status}). ${(await res.text().catch(() => "")).slice(0, 160)}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

const q = (s: string) => encodeURIComponent(s);

/** The backup folder (made the first time). */
async function folderId(accessToken: string): Promise<string> {
  const found = await api<{ files: { id: string }[] }>(accessToken, `/files?q=${q(`name='${BACKUP_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)&spaces=drive`);
  if (found.files[0]) return found.files[0].id;
  const made = await api<{ id: string }>(accessToken, "/files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: BACKUP_FOLDER, mimeType: "application/vnd.google-apps.folder" }) });
  return made.id;
}

/** Every file in the backup folder, by name. */
async function listFolder(accessToken: string, folder: string): Promise<Map<string, { id: string; modifiedTime: string }>> {
  const out = new Map<string, { id: string; modifiedTime: string }>();
  let page = "";
  do {
    const res = await api<{ files: { id: string; name: string; modifiedTime: string }[]; nextPageToken?: string }>(accessToken,
      `/files?q=${q(`'${folder}' in parents and trashed=false`)}&fields=nextPageToken,files(id,name,modifiedTime)&pageSize=1000&spaces=drive${page ? `&pageToken=${page}` : ""}`);
    for (const f of res.files) if (!out.has(f.name) || out.get(f.name)!.modifiedTime < f.modifiedTime) out.set(f.name, f);
    page = res.nextPageToken ?? "";
  } while (page);
  return out;
}

/** Uploads one file from the phone into the folder (streamed from disk, so a long video never sits in memory). */
async function uploadFile(accessToken: string, folder: string, uri: string, name: string, mimeType: string, existingId?: string): Promise<string> {
  const id = existingId ?? (await api<{ id: string }>(accessToken, "/files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, parents: [folder] }) })).id;
  const res = await LegacyFS.uploadAsync(`${UPLOAD}/files/${id}?uploadType=media`, uri, {
    httpMethod: "PATCH", uploadType: LegacyFS.FileSystemUploadType.BINARY_CONTENT, headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": mimeType },
  });
  if (res.status === 401) throw new NeedsGoogle();
  if (res.status >= 300) throw new Error(`Google Drive didn't take ${name} (${res.status}).`);
  return id;
}

const mimeOf = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", webp: "image/webp", mp4: "video/mp4", mov: "video/quicktime", m4a: "audio/mp4", aac: "audio/aac", mp3: "audio/mpeg" } as Record<string, string>)[ext] ?? "application/octet-stream";
};

let running: Promise<void> | null = null;

/**
 * Backs up this account's books to Drive: the files not uploaded yet, then the data file. `interactive` when the parent tapped it (they may be
 * asked to pick an account and allow Drive); the automatic backup never asks and just records that Drive needs connecting again.
 */
export function backupNow(interactive: boolean, onProgress?: (text: string) => void): Promise<void> {
  if (running) return running;
  running = (async () => {
    const set = useStore.getState().setDriveBackup;
    try {
      const auth = await token(interactive);
      if (!auth) return; // the parent closed the account picker
      onProgress?.("Opening your Drive…");
      const folder = await folderId(auth.accessToken);
      const st = useStore.getState() as unknown as Record<string, unknown>;
      const backup = buildBackup(st, `${APP_NAME} ${APP_VERSION}`, STORE_VERSION, Date.now());
      const uploaded: Record<string, string> = JSON.parse((await AsyncStorage.getItem(UPLOADED_KEY).catch(() => null)) ?? "{}");
      const files = [...filesIn(backup.data)].filter((u) => new File(u).exists);
      const todo = files.filter((u) => !uploaded[baseName(u)]);
      let n = 0;
      for (const u of todo) {
        onProgress?.(`Uploading photos and videos: ${++n} of ${todo.length}`);
        const name = baseName(u);
        uploaded[name] = await uploadFile(auth.accessToken, folder, u, name, mimeOf(name));
        await AsyncStorage.setItem(UPLOADED_KEY, JSON.stringify(uploaded)); // so an interrupted backup carries on where it stopped
      }
      onProgress?.("Saving the books…");
      const dataFile = new File(Paths.cache, BACKUP_FILE);
      if (dataFile.exists) dataFile.delete();
      dataFile.write(JSON.stringify(backup));
      const existing = (await listFolder(auth.accessToken, folder)).get(BACKUP_FILE)?.id;
      await uploadFile(auth.accessToken, folder, dataFile.uri, BACKUP_FILE, "application/json", existing);
      set({ lastAt: Date.now(), account: auth.email, error: undefined });
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

/** When the backup on Drive was made, or null if there isn't one. Asks to connect Drive if needed (a tap). */
export async function findBackup(): Promise<{ savedAt: number; app: string; kids: number; memories: number; account: string } | null> {
  const auth = await token(true);
  if (!auth) return null;
  const folder = await folderId(auth.accessToken);
  const file = (await listFolder(auth.accessToken, folder)).get(BACKUP_FILE);
  if (!file) return null;
  const text = await fetch(`${API}/files/${file.id}?alt=media`, { headers: { Authorization: `Bearer ${auth.accessToken}` } }).then((r) => r.text());
  const b = parseBackup(text);
  return { savedAt: b.savedAt, app: b.app, kids: (b.data.kids as unknown[]).length, memories: Array.isArray(b.data.memories) ? (b.data.memories as unknown[]).length : 0, account: auth.email };
}

/**
 * Restores the books from the Drive backup onto this phone, replacing what's here: the data, and any photos and videos missing from the phone.
 * They then go back to the account as well (see prepareRestore).
 */
export async function restoreFromDrive(onProgress?: (text: string) => void): Promise<number> {
  const auth = await token(true);
  if (!auth) throw new Error("Restoring was cancelled.");
  onProgress?.("Opening your Drive…");
  const folder = await folderId(auth.accessToken);
  const all = await listFolder(auth.accessToken, folder);
  const file = all.get(BACKUP_FILE);
  if (!file) throw new Error("There's no 4D Ages backup in this Google account's Drive yet.");
  const text = await fetch(`${API}/files/${file.id}?alt=media`, { headers: { Authorization: `Bearer ${auth.accessToken}` } }).then((r) => r.text());
  const backup = parseBackup(text);
  const data = backup.storeVersion < STORE_VERSION ? migrateStored(backup.data as never, backup.storeVersion) as Record<string, unknown> : backup.data;

  // the photos and videos: the ones not on this phone are downloaded
  const dir = new Directory(Paths.document, "media");
  if (!dir.exists) dir.create({ intermediates: true });
  const wanted = [...filesIn(data)];
  const local = new Map<string, string>();
  let n = 0;
  for (const u of wanted) {
    const name = baseName(u);
    onProgress?.(`Downloading photos and videos: ${++n} of ${wanted.length}`);
    if (new File(u).exists) { local.set(u, u); continue; }
    const dest = new File(dir, name);
    if (!dest.exists) {
      const onDrive = all.get(name);
      if (!onDrive) continue; // never uploaded: the post keeps its words, without that picture
      const res = await LegacyFS.downloadAsync(`${API}/files/${onDrive.id}?alt=media`, dest.uri, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
      if (res.status >= 300) continue;
    }
    local.set(u, dest.uri);
  }
  const restored = prepareRestore(remapFiles(data, (u) => local.get(u)));
  useStore.setState({ ...(restored as object), preview: false });
  // what was just downloaded is already on Drive
  const uploaded: Record<string, string> = JSON.parse((await AsyncStorage.getItem(UPLOADED_KEY).catch(() => null)) ?? "{}");
  for (const u of local.values()) { const f = all.get(baseName(u)); if (f) uploaded[baseName(u)] = f.id; }
  await AsyncStorage.setItem(UPLOADED_KEY, JSON.stringify(uploaded));
  return (restored.kids as unknown[]).length;
}
