/*
 * Files kept by the website: in this browser's Cache Storage, served back at /__media/… by the site's helper (public/sw.js), so an <img>,
 * a <video>, the book's pages and the maps can all show them by address. Which files are kept is known up front (localFilesReady), so
 * "is it here?" can be answered straight away, as on the phone.
 */
const CACHE = "4d-media-v1";
const PREFIX = "/__media/";
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", m4a: "audio/mp4", mp3: "audio/mpeg", ogg: "audio/ogg", opus: "audio/ogg", wav: "audio/wav", aac: "audio/aac" };
const rid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const known = new Map<string, number>(); // path → size

const pathOf = (uri?: string): string | null => {
  if (!uri) return null;
  try {
    const u = new URL(uri, location.origin);
    return u.origin === location.origin && u.pathname.startsWith(PREFIX) ? u.pathname : null;
  } catch {
    return null;
  }
};

/** The site's helper is installed, and the list of kept files is read. */
export const localFilesReady: Promise<void> = (async () => {
  try {
    if ("serviceWorker" in navigator) {
      await navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const c = await caches.open(CACHE);
    for (const r of await c.keys()) {
      const p = new URL(r.url).pathname;
      const res = await c.match(r);
      known.set(p, Number(res?.headers.get("content-length") ?? 0));
    }
  } catch {
    /* no Cache Storage (a private window in some browsers): files simply aren't kept between visits */
  }
})();

async function put(blob: Blob, ext: string, name = rid()): Promise<string> {
  const path = `${PREFIX}${name}.${ext}`;
  const c = await caches.open(CACHE);
  await c.put(path, new Response(blob, { headers: { "content-type": blob.type || MIME[ext] || "application/octet-stream", "content-length": String(blob.size) } }));
  known.set(path, blob.size);
  return `${location.origin}${path}`;
}

export async function keepFile(uri: string, ext: string): Promise<string> {
  if (pathOf(uri)) return uri; // already kept
  const blob = await (await fetch(uri)).blob();
  return put(blob, ext);
}

export function removeFile(uri: string) {
  const p = pathOf(uri);
  if (!p) return;
  known.delete(p);
  caches.open(CACHE).then((c) => c.delete(p)).catch(() => undefined);
}

export const fileExists = (uri?: string): boolean => {
  const p = pathOf(uri);
  return !!p && known.has(p);
};

export const fileSize = (uri: string): number => known.get(pathOf(uri) ?? "") ?? 0;

export async function fileBytes(uri: string): Promise<Uint8Array> {
  return new Uint8Array(await (await fetch(uri)).arrayBuffer());
}

export async function saveFromUrl(url: string, name: string, ext: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't download it");
  return put(await res.blob(), ext, name);
}
