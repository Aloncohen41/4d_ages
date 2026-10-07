import { videosNeedingThumbs } from "../src/lib/thumbBackfill";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const mem = (id: string, media: any[]): any => ({ id, childId: "c", type: "photo", description: "", date: "2025-01-01", media, tagIds: [], createdAt: 1, emoji: "📷", palette: "peach", source: "Added" });
const list = [
  mem("a", [{ id: "1", uri: "file:///v1.mp4", kind: "video" }, { id: "2", uri: "file:///p.jpg", kind: "photo" }]),
  mem("b", [{ id: "3", uri: "file:///v2.mp4", kind: "video", thumb: "file:///t.jpg" }]),
  mem("c", [{ id: "4", uri: "", kind: "video" }]),
  mem("d", []),
  mem("e", [{ id: "5", uri: "file:///v3.mp4", kind: "video" }]),
];
ok("only videos that have a file but no thumbnail", videosNeedingThumbs(list).map((x) => `${x.memoryId}:${x.mediaId}`).join() === "a:1,e:5");
ok("photos, finished videos, videos still downloading and empty memories are ignored", !videosNeedingThumbs(list).some((x) => ["2", "3", "4"].includes(x.mediaId)));
ok("what was already tried this session is skipped (no endless retries)", videosNeedingThumbs(list, new Set(["a:1"])).map((x) => x.mediaId).join() === "5");
ok("nothing to do → empty", videosNeedingThumbs([]).length === 0 && videosNeedingThumbs([mem("z", [{ id: "9", uri: "u", kind: "video", thumb: "t" }])]).length === 0);
console.log(fails ? `${fails} FAILED` : "all thumbnail-backfill tests passed");
