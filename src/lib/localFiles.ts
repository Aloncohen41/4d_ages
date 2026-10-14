/*
 * Files kept by the app: the photos, videos and recordings you add, and the ones downloaded from your account. On the phone they live in
 * the app's own storage (expo-file-system); see localFiles.web.ts for the website.
 */
import { Directory, File, Paths } from "expo-file-system";

const rid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const mediaDir = () => {
  const dir = new Directory(Paths.document, "media");
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
};

/** Ready to use (on the phone, always). */
export const localFilesReady: Promise<void> = Promise.resolve();

/** A copy of a picked file in the app's own storage (so it survives cache cleaning); the copy is finished before this returns. */
export async function keepFile(uri: string, ext: string): Promise<string> {
  try {
    const dest = new File(mediaDir(), `${rid()}.${ext}`);
    await new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri; // fall back to the original location
  }
}

export function removeFile(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* already gone */
  }
}

export function fileExists(uri?: string): boolean {
  if (!uri) return false;
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

export function fileSize(uri: string): number {
  try {
    return new File(uri).size ?? 0;
  } catch {
    return 0;
  }
}

export async function fileBytes(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}

/** Downloads a file (from a link) into the app's storage, under this name. */
export async function saveFromUrl(url: string, name: string, ext: string): Promise<string> {
  const dest = new File(mediaDir(), `${name}.${ext}`);
  if (dest.exists) dest.delete();
  const file = await File.downloadFileAsync(url, dest);
  return file.uri;
}
