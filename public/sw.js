/*
 * The 4D Ages website's helper. Photos, videos and recordings you add on the website are kept in this browser (Cache Storage); this serves
 * them back at /__media/… addresses, so pictures, videos, the book's pages and the maps can show them like any other file. Videos can be
 * played from any point (it answers "range" requests). Everything else goes straight to the network as usual.
 */
const CACHE = "4d-media-v1";
const INBOX = "4d-share-inbox";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // shared to 4D Ages from the phone's gallery or another app (the installed website): kept, then the site opens to add them
  if (e.request.method === "POST" && url.origin === self.location.origin && url.pathname === "/share-target") {
    e.respondWith(receiveShare(e.request));
    return;
  }
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/__media/")) return;
  e.respondWith(serve(url.pathname, e.request.headers.get("range")));
});

async function serve(path, range) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(path);
  if (!hit) return new Response("", { status: 404 });
  if (!range) return hit;
  const blob = await hit.blob();
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  const size = blob.size;
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
  if (m && !m[1] && m[2]) { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
  end = Math.min(end, size - 1);
  if (start > end || start >= size) return new Response("", { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": hit.headers.get("content-type") || "application/octet-stream",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}

async function receiveShare(request) {
  try {
    const form = await request.formData();
    const inbox = await caches.open(INBOX);
    let i = 0;
    for (const f of form.getAll("media")) {
      if (!(f instanceof File)) continue;
      await inbox.put(`/__inbox/${Date.now()}-${i++}`, new Response(f, {
        headers: { "content-type": f.type || "application/octet-stream", "content-length": String(f.size), "x-name": encodeURIComponent(f.name || "file"), "x-modified": String(f.lastModified || 0) },
      }));
    }
    const words = [form.get("title"), form.get("text")].filter((x) => typeof x === "string" && x.trim()).join(" ").trim();
    if (words) await inbox.put("/__inbox/text", new Response(words));
  } catch (e) {
    /* nothing came through: the site simply opens */
  }
  return Response.redirect("/?shared=1", 303);
}

// tapping a reminder opens 4D Ages (the open tab if there is one)
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const open = tabs.find((c) => new URL(c.url).origin === self.location.origin);
    if (open) return open.focus();
    return self.clients.openWindow("/");
  })());
});
