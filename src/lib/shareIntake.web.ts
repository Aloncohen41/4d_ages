/*
 * Sharing to the website: once it's installed on a phone (Add to home screen), 4D Ages is in the phone's Share menu, like the app. The
 * site's helper (public/sw.js) keeps the shared files in an inbox and opens the site at /?shared=1; here they're moved in with the other
 * files and handed to the same "whose is it, what is it" screen as on the phone.
 */
import type { SharedItem } from "./types";
import { keepFile, localFilesReady } from "./localFiles";
import { dateFromFileName, todayISO } from "./date";

const INBOX = "4d-share-inbox";

export interface ShareResult { items: SharedItem[]; skipped: string[]; text?: string }

export const isShareIntakeAvailable = () => typeof window !== "undefined" && "caches" in window;
export const hasInitialShare = () => typeof location !== "undefined" && new URLSearchParams(location.search).has("shared");

export function restartApp(): boolean {
  location.reload();
  return true;
}

const kindOf = (mime: string): SharedItem["kind"] | null =>
  mime.startsWith("image/") ? "photo" : mime.startsWith("video/") ? "video" : mime.startsWith("audio/") || mime === "application/ogg" ? "audio" : null;
const extOf = (name: string, mime: string) => (name.match(/\.([A-Za-z0-9]{2,5})$/)?.[1] ?? mime.split("/")[1]?.split(";")[0] ?? "bin").toLowerCase();

export async function readInitialShare(): Promise<ShareResult> {
  const out: ShareResult = { items: [], skipped: [] };
  if (!hasInitialShare()) return out;
  history.replaceState(null, "", location.pathname); // so a reload doesn't add them again
  try {
    await localFilesReady;
    const inbox = await caches.open(INBOX);
    for (const req of await inbox.keys()) {
      const res = await inbox.match(req);
      await inbox.delete(req);
      if (!res) continue;
      if (new URL(req.url).pathname === "/__inbox/text") { out.text = (await res.text()).slice(0, 2000); continue; }
      const mime = res.headers.get("content-type") ?? "";
      const name = decodeURIComponent(res.headers.get("x-name") ?? "file");
      const kind = kindOf(mime) ?? (/\.(opus|ogg|m4a|mp3|wav|aac|amr)$/i.test(name) ? "audio" : null);
      if (!kind) { out.skipped.push(name); continue; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const uri = await keepFile(url, extOf(name, mime));
      URL.revokeObjectURL(url);
      // the date it was taken: in the name (IMG_20250301…), else when the file was last changed
      const modified = Number(res.headers.get("x-modified") ?? 0);
      const fromName = dateFromFileName(name);
      const fromModified = modified ? new Date(modified).toISOString().slice(0, 10) : undefined;
      const date = [fromName, fromModified].find((d) => d && d >= "1990-01-01" && d <= todayISO()) ?? undefined;
      out.items.push({ uri, kind, mime, name, size: blob.size, ...(date ? { date } : {}) });
    }
  } catch {
    /* the inbox couldn't be read: nothing comes in */
  }
  return out;
}

/**
 * Files dragged onto the page (or chosen in the browser): kept with the website's other files and turned into what the "new post" screen
 * takes, the same way as files shared in. Anything that isn't a photo, a video or a sound recording is left out, by name.
 */
export async function filesToItems(files: File[]): Promise<ShareResult> {
  const out: ShareResult = { items: [], skipped: [] };
  await localFilesReady;
  for (const file of files) {
    const mime = file.type || "";
    const kind = kindOf(mime) ?? (/.(opus|ogg|m4a|mp3|wav|aac|amr)$/i.test(file.name) ? "audio" : null);
    if (!kind) { out.skipped.push(file.name); continue; }
    const url = URL.createObjectURL(file);
    try {
      const uri = await keepFile(url, extOf(file.name, mime));
      const fromName = dateFromFileName(file.name);
      const fromModified = file.lastModified ? new Date(file.lastModified).toISOString().slice(0, 10) : undefined;
      const date = [fromName, fromModified].find((d) => d && d >= "1990-01-01" && d <= todayISO()) ?? undefined;
      out.items.push({ uri, kind, mime, name: file.name, size: file.size, ...(date ? { date } : {}) });
    } catch {
      out.skipped.push(file.name);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return out;
}

/** The website is opened anew for each share (see above), so there's nothing to listen for while it's open. */
export function listenForShares(_onStart: (count: number) => void, _onItems: (r: ShareResult) => void): () => void {
  return () => undefined;
}
